# Testing

How tests are organized, how to run them, what coverage we hold ourselves to, and how to mock ESM modules in Jest. The client has no test suite today; everything in this doc is about the server.

---

## Stack

- **Jest 30** with ESM (`NODE_OPTIONS='--experimental-vm-modules'`).
- `jest.unstable_mockModule` for ESM dynamic mocking — no Babel, no transpilation, no `__mocks__/` folder.
- A setup file at `server/src/__tests__/setupEnv.js` injects fake env vars so `config/env.js` doesn't `process.exit(1)` on missing `MONGODB_URI` / `JWT_SECRET` during tests.

---

## Running

```bash
cd server
npm test                  # all tests
npm run test:watch        # watch mode
npm run test:coverage     # with coverage report
npm run test:report       # coverage + open HTML report

# focused run
npx jest path/to/file.test.js
```

If a test fails with "Cannot use import statement outside a module", the `--experimental-vm-modules` flag isn't being passed. Run via the `npm` scripts, not bare `npx jest`.

---

## Folder structure

Tests mirror the source tree under `server/src/__tests__/`:

```
__tests__/
├── controllers/          one file per controller (8 files)
├── middleware/           auth, authorize, error, rateLimiter, upload, validate (6 files)
├── services/             auth, cache, email, export, habit, log, push, shared, streak, user, weeklySummary, …
├── jobs/                 cron job tests
├── utils/                AppError, catchAsync, dateHelpers, responseFormatter
├── validators/           rule arrays + helper assertions
└── setupEnv.js           env vars for the test process
```

When you add a source file, add a test file in the parallel location. Don't co-locate tests next to source — the test runner config and coverage globs assume the mirrored layout.

---

## Coverage thresholds

Defined in `server/jest.config.js`. Currently enforced:

| Path | Branches | Functions | Lines | Statements |
|------|:--------:|:---------:|:-----:|:----------:|
| `src/utils/` | 100% | 100% | 100% | 100% |
| `src/controllers/` | 100% | 100% | 100% | 100% |
| `src/middleware/` | 90% | 100% | 100% | 100% |
| `src/services/authService.js` | 100% | 100% | 100% | 100% |
| `src/services/cacheService.js` | 100% | 100% | 100% | 100% |
| `src/services/habitService.js` | 100% | 100% | 100% | 100% |
| `src/services/streakService.js` | 100% | 100% | 100% | 100% |
| `src/services/userService.js` | 100% | 100% | 100% | 100% |

`routes/`, `validators/`, `index.js`, `config/db.js`, and `config/swagger.js` are **excluded** from coverage collection — they're declarative and exercised indirectly.

New code in a covered path must come with tests that hold the threshold. **Don't lower the threshold** to make CI pass — that's how coverage gates rot.

---

## Mocking ESM modules

The required pattern with `--experimental-vm-modules`:

```js
import { jest } from '@jest/globals';

// 1. Mock first — must use unstable_mockModule and the FULL specifier
jest.unstable_mockModule('../../models/Habit.js', () => ({
  default: {
    findById: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    bulkWrite: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/cacheService.js', () => ({
  default: {
    get: jest.fn(() => null),
    set: jest.fn(),
    delByPrefix: jest.fn(),
  },
}));

// 2. THEN dynamically import the module under test and its mocked deps
const Habit = (await import('../../models/Habit.js')).default;
const habitService = (await import('../../services/habitService.js')).default;

describe('habitService.create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a habit and invalidates cache', async () => {
    Habit.countDocuments.mockResolvedValue(2);
    Habit.create.mockResolvedValue({ _id: 'h1', name: 'Run' });

    const result = await habitService.create('u1', { name: 'Run' });

    expect(Habit.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Run',
      userId: 'u1',
      sortOrder: 2,
    }));
    expect(result.name).toBe('Run');
  });
});
```

Rules:
- **Mock before import.** ESM resolves imports synchronously; mocking after import has no effect.
- Use the **full path with `.js` extension**, matching how the source imports it.
- Use dynamic `await import(...)` for both the module under test and any mocked dep you need to inspect.

---

## What to test at each layer

| Layer | Test focus | What to skip |
|-------|------------|--------------|
| `utils/` | Pure functions, every branch. | n/a — these are 100%-covered. |
| `models/` | Hooks (e.g. password hashing), instance methods (`comparePassword`, `createPasswordResetToken`, `toJSON`). | Mongoose's own validation — trust the library. |
| `services/` | Happy path + every `AppError` branch + cache invalidation. | Mongoose query plans — mock the model. |
| `controllers/` | Each handler: it calls the service and shapes the response. One happy path per handler; failure paths come from service mocks throwing `AppError`. | The middleware chain itself. |
| `middleware/` | Each branch: auth header missing, token invalid, password changed after iat, role mismatch, validation result populated. | Express internals. |
| `routes/` | Excluded from coverage. Don't write route tests — they'd duplicate controller + middleware coverage. |  |
| `validators/` | Excluded from coverage. Validator rule arrays are declarative. |  |
| `jobs/` | The scheduling wiring + the per-iteration function. Mock the underlying service. |  |

---

## Common test setup patterns

### Reusable mocks

If multiple test files mock the same dep with the same shape, extract the mock factory into a `__tests__/helpers/<dep>Mock.js` and import it. Don't duplicate the same `jest.unstable_mockModule(...)` across 10 files.

### Request/response stubs for controllers

```js
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) => ({
  user: { _id: 'u1' },
  params: {},
  query: {},
  body: {},
  headers: {},
  ...overrides,
});
```

### Async error assertions

`AppError` is the only error type controllers/services throw. Assert on both the message and the status code:

```js
await expect(habitService.getById('bad', 'u1'))
  .rejects.toMatchObject({ message: 'Habit not found', statusCode: 404 });
```

---

## When tests get slow

The suite should run in under ~15s on a modern laptop. If it crosses ~30s, look for:

- **Real DB connections leaking** — check for `await connectDB()` in any test file. Tests must mock Mongoose, not connect to Mongo.
- **Open handles** — `--detectOpenHandles` (already on by default in `npm test`) prints any leaks. Usually a `setInterval` or unclosed server.
- **`--forceExit`** — already on by default. If you remove it, Jest will hang on leaks instead of forcing exit, which is sometimes useful for debugging.

---

## Adding a test — checklist

1. Mirror the source path under `__tests__/`. New service `services/foo.js` → new test `__tests__/services/foo.test.js`.
2. Mock every imported dep that touches Mongo, the filesystem, or the network. Use `jest.unstable_mockModule` before the dynamic import of the module under test.
3. Cover every `AppError` branch. The coverage gate will flag misses, but it's faster to write them up-front.
4. Run `npm run test:coverage` and confirm the file hits its threshold. If not, the `coverage/index.html` report shows uncovered lines and branches.
