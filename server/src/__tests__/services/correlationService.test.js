import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Fixed "today" so the date math is deterministic: 2024-02-15 (Thursday) UTC.
const FIXED_TODAY = new Date('2024-02-15T00:00:00.000Z');

jest.unstable_mockModule('../../models/Habit.js', () => ({
  default: { find: jest.fn() },
}));

jest.unstable_mockModule('../../models/HabitLog.js', () => ({
  default: { find: jest.fn() },
}));

jest.unstable_mockModule('../../services/cacheService.js', () => ({
  default: {
    get: jest.fn(),
    set: jest.fn(),
    delByPrefix: jest.fn(),
  },
}));

jest.unstable_mockModule('../../utils/dateHelpers.js', () => ({
  toDateString: (date) => date.toISOString().split('T')[0],
  addDays: (date, days) => {
    const r = new Date(date);
    r.setUTCDate(r.getUTCDate() + days);
    return r;
  },
  getTodayUTC: jest.fn(() => new Date(FIXED_TODAY)),
  getTodayInTimezone: jest.fn(() => new Date(FIXED_TODAY)),
  getDayOfWeek: (date) => new Date(date).getUTCDay(),
}));

const { default: Habit } = await import('../../models/Habit.js');
const { default: HabitLog } = await import('../../models/HabitLog.js');
const { default: cache } = await import('../../services/cacheService.js');
const dateHelpers = await import('../../utils/dateHelpers.js');
const { default: correlationService } = await import('../../services/correlationService.js');

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function makeHabit(id, name, { type = 'boolean', target = 1, frequency = ALL_DAYS } = {}) {
  return { _id: id, name, type, target, frequency, icon: 'X', color: '#000' };
}

function makeLog(habitId, dateStr, value) {
  return { habitId, date: new Date(`${dateStr}T00:00:00.000Z`), value };
}

// Generate inclusive YYYY-MM-DD strings from start to end (UTC).
function dateRange(startStr, endStr) {
  const out = [];
  const start = new Date(`${startStr}T00:00:00.000Z`);
  const end = new Date(`${endStr}T00:00:00.000Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().split('T')[0]);
  }
  return out;
}

// Set up mock for Habit.find(...).select(...).lean() chain.
function mockHabits(habits) {
  Habit.find.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(habits),
    }),
  });
}

// Set up mock for HabitLog.find(...).select(...).lean() chain.
function mockLogs(logs) {
  HabitLog.find.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(logs),
    }),
  });
}

describe('CorrelationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.get.mockReturnValue(undefined);
  });

  describe('_cacheKey', () => {
    it('formats userId + windowDays into a colon-separated key', () => {
      expect(correlationService._cacheKey('u1', 60)).toBe('insights:u1:60');
    });
  });

  describe('_invalidateCache', () => {
    it('delegates to cache.delByPrefix with the per-user prefix', () => {
      correlationService._invalidateCache('u1');
      expect(cache.delByPrefix).toHaveBeenCalledWith('insights:u1');
    });
  });

  describe('_emptyResult', () => {
    it('returns the guard envelope with an empty insights array and the given reason', () => {
      const result = correlationService._emptyResult(60, 'need_more_habits');
      expect(result).toMatchObject({
        windowDays: 60,
        guards: {
          minOverlapDays: expect.any(Number),
          minCompletedDays: expect.any(Number),
          minLiftPp: expect.any(Number),
        },
        insights: [],
        reason: 'need_more_habits',
      });
    });

    it('defaults reason to null when not provided', () => {
      const result = correlationService._emptyResult(60);
      expect(result.reason).toBeNull();
    });
  });

  describe('getInsights — input validation', () => {
    it.each([
      ['non-integer', 30.5],
      ['below min', 13],
      ['above max', 366],
      ['string', '60'],
    ])('throws AppError 400 when windowDays is %s', async (_label, value) => {
      await expect(correlationService.getInsights('u1', { windowDays: value })).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('getInsights — cache', () => {
    it('returns the cached value without hitting the DB', async () => {
      const cached = { windowDays: 60, guards: {}, insights: [] };
      cache.get.mockReturnValueOnce(cached);

      const result = await correlationService.getInsights('u1', { windowDays: 60 });

      expect(result).toBe(cached);
      expect(Habit.find).not.toHaveBeenCalled();
      expect(HabitLog.find).not.toHaveBeenCalled();
    });
  });

  describe('getInsights — habit count', () => {
    it('returns need_more_habits when user has zero non-archived habits', async () => {
      mockHabits([]);

      const result = await correlationService.getInsights('u1', { windowDays: 60 });

      expect(result.reason).toBe('need_more_habits');
      expect(result.insights).toEqual([]);
      expect(cache.set).toHaveBeenCalled();
      expect(HabitLog.find).not.toHaveBeenCalled();
    });

    it('returns need_more_habits when user has exactly one habit', async () => {
      mockHabits([makeHabit('h1', 'Solo')]);

      const result = await correlationService.getInsights('u1', { windowDays: 60 });

      expect(result.reason).toBe('need_more_habits');
      expect(HabitLog.find).not.toHaveBeenCalled();
    });
  });

  describe('getInsights — timezone routing', () => {
    it('uses getTodayInTimezone when timezone is provided', async () => {
      mockHabits([makeHabit('h1', 'A'), makeHabit('h2', 'B')]);
      mockLogs([]);

      await correlationService.getInsights('u1', { windowDays: 30, timezone: 'America/Los_Angeles' });

      expect(dateHelpers.getTodayInTimezone).toHaveBeenCalledWith('America/Los_Angeles');
      expect(dateHelpers.getTodayUTC).not.toHaveBeenCalled();
    });

    it('uses getTodayUTC when timezone is null', async () => {
      mockHabits([makeHabit('h1', 'A'), makeHabit('h2', 'B')]);
      mockLogs([]);

      await correlationService.getInsights('u1', { windowDays: 30 });

      expect(dateHelpers.getTodayUTC).toHaveBeenCalled();
      expect(dateHelpers.getTodayInTimezone).not.toHaveBeenCalled();
    });
  });

  describe('getInsights — empty results', () => {
    it('returns no_pairs_pass_guards when habits exist but no logs match', async () => {
      mockHabits([makeHabit('h1', 'A'), makeHabit('h2', 'B')]);
      mockLogs([]);

      const result = await correlationService.getInsights('u1', { windowDays: 30 });

      expect(result.reason).toBe('no_pairs_pass_guards');
      expect(result.insights).toEqual([]);
    });

    it('ignores logs for habits not in the active set', async () => {
      mockHabits([makeHabit('h1', 'A'), makeHabit('h2', 'B')]);
      mockLogs([makeLog('h_ghost', '2024-02-10', true)]);

      const result = await correlationService.getInsights('u1', { windowDays: 30 });

      expect(result.insights).toEqual([]);
    });
  });

  describe('getInsights — boolean math', () => {
    // Scenario: window of 14 days (Feb 2 – Feb 15), both habits all-days scheduled.
    // Habit A completed on Feb 2 – Feb 8 (7 days), missed Feb 9 – Feb 15 (7 days).
    // Habit B completed on the same 7 days as A.
    // P(B|A) = 7/7 = 1.0;  P(B|¬A) = 0/7 = 0.0;  lift = +100pp — passes.
    // Both directions are symmetric and pass.
    it('emits both directional insights for a strongly correlated pair', async () => {
      const aDoneDates = dateRange('2024-02-02', '2024-02-08');

      mockHabits([makeHabit('h_a', 'Exercise'), makeHabit('h_b', 'Meditate')]);
      mockLogs([
        ...aDoneDates.map((d) => makeLog('h_a', d, true)),
        ...aDoneDates.map((d) => makeLog('h_b', d, true)),
      ]);

      const result = await correlationService.getInsights('u1', { windowDays: 14 });

      expect(result.insights).toHaveLength(2);
      // Both should be max-positive lift.
      for (const ins of result.insights) {
        expect(ins.liftPp).toBe(100);
        expect(ins.fromDoneCount).toBe(7);
        expect(ins.fromMissedCount).toBe(7);
        expect(ins.overlapDays).toBe(14);
      }
    });

    it('emits a negative-lift insight as a trade-off', async () => {
      // A and "junk" anti-correlated. A on Feb 2 – Feb 8, junk on Feb 9 – Feb 15.
      const aDates = dateRange('2024-02-02', '2024-02-08');
      const jDates = dateRange('2024-02-09', '2024-02-15');

      mockHabits([makeHabit('h_a', 'Exercise'), makeHabit('h_j', 'Junk food')]);
      mockLogs([
        ...aDates.map((d) => makeLog('h_a', d, true)),
        ...jDates.map((d) => makeLog('h_j', d, true)),
      ]);

      const result = await correlationService.getInsights('u1', { windowDays: 14 });

      // Both A→J and J→A direction should pass with max negative lift.
      expect(result.insights.length).toBeGreaterThan(0);
      for (const ins of result.insights) {
        expect(ins.liftPp).toBe(-100);
      }
    });

    it('treats log.value === false as not completed (not just missing)', async () => {
      // A done on 7 days, A explicitly false on 7 days → A-missed group counts both
      // explicit-false logs and absent days. Make the explicit-false days the same as
      // the absent days so the totals are unchanged.
      const aDates = dateRange('2024-02-02', '2024-02-08');
      const aFalseDates = dateRange('2024-02-09', '2024-02-15');

      mockHabits([makeHabit('h_a', 'A'), makeHabit('h_b', 'B')]);
      mockLogs([
        ...aDates.map((d) => makeLog('h_a', d, true)),
        ...aFalseDates.map((d) => makeLog('h_a', d, false)), // not completed
        ...aDates.map((d) => makeLog('h_b', d, true)),
      ]);

      const result = await correlationService.getInsights('u1', { windowDays: 14 });
      expect(result.insights).toHaveLength(2);
      expect(result.insights[0].liftPp).toBe(100);
    });
  });

  describe('getInsights — count habit completion', () => {
    it('uses value >= target as the completion criterion', async () => {
      const aDates = dateRange('2024-02-02', '2024-02-08'); // 7 days
      const bDates = dateRange('2024-02-02', '2024-02-08');

      mockHabits([
        makeHabit('h_a', 'Pages read', { type: 'count', target: 10 }),
        makeHabit('h_b', 'Meditate', { type: 'boolean' }),
      ]);
      mockLogs([
        // A: some hit target, some don't. Hits target on Feb 2-8 (value=12). Misses Feb 9-15.
        ...aDates.map((d) => makeLog('h_a', d, 12)),
        ...dateRange('2024-02-09', '2024-02-15').map((d) => makeLog('h_a', d, 3)), // below target
        ...bDates.map((d) => makeLog('h_b', d, true)),
      ]);

      const result = await correlationService.getInsights('u1', { windowDays: 14 });
      expect(result.insights.length).toBeGreaterThan(0);
      // A→B direction: aDone=7 (hit target), aMissed=7 (below target), bGivenADone=7, bGivenAMissed=0.
      const aToB = result.insights.find((i) => i.from.name === 'Pages read' && i.to.name === 'Meditate');
      expect(aToB).toBeDefined();
      expect(aToB.liftPp).toBe(100);
    });
  });

  describe('getInsights — guards', () => {
    it('filters out pairs with overlap days below the threshold', async () => {
      // Habits scheduled on disjoint days of week → zero overlap days in the window.
      const monOnly = [1];
      const tueOnly = [2];

      mockHabits([
        makeHabit('h_a', 'A', { frequency: monOnly }),
        makeHabit('h_b', 'B', { frequency: tueOnly }),
      ]);
      mockLogs(
        dateRange('2024-01-01', '2024-02-15')
          .flatMap((d) => [makeLog('h_a', d, true), makeLog('h_b', d, true)])
      );

      const result = await correlationService.getInsights('u1', { windowDays: 60 });
      expect(result.insights).toEqual([]);
    });

    it('filters out pairs where the "from completed" group has < 5 days', async () => {
      // A done only 4 days in a 14-day window → aDoneCount = 4, fails guard.
      const aDates = dateRange('2024-02-02', '2024-02-05'); // 4 days
      const bDates = dateRange('2024-02-02', '2024-02-15'); // every day

      mockHabits([makeHabit('h_a', 'A'), makeHabit('h_b', 'B')]);
      mockLogs([
        ...aDates.map((d) => makeLog('h_a', d, true)),
        ...bDates.map((d) => makeLog('h_b', d, true)),
      ]);

      const result = await correlationService.getInsights('u1', { windowDays: 14 });
      // A→B fails (only 4 A-done days). B→A also: bDone=14, bMissed=0 → fails missed guard.
      expect(result.insights).toEqual([]);
    });

    it('filters out pairs where the "from missed" group has < 5 days', async () => {
      // A done 13 of 14 days → aMissed = 1, fails guard.
      const aDates = dateRange('2024-02-02', '2024-02-14'); // 13 days

      mockHabits([makeHabit('h_a', 'A'), makeHabit('h_b', 'B')]);
      mockLogs(aDates.map((d) => makeLog('h_a', d, true)));

      const result = await correlationService.getInsights('u1', { windowDays: 14 });
      expect(result.insights).toEqual([]);
    });

    it('filters out pairs whose absolute lift is below the threshold', async () => {
      // Construct a modest correlation with lift ~10pp (below 15pp threshold).
      // Window 30 days. A done 15 days, A missed 15 days.
      // B done on 8/15 A-done days = 53.3%, B done on 6/15 A-missed days = 40% → lift +13pp.
      const window = dateRange('2024-01-17', '2024-02-15'); // 30 days
      const aDoneDates = window.slice(0, 15);
      const aMissedDates = window.slice(15);
      const bDoneOnADone = aDoneDates.slice(0, 8);
      const bDoneOnAMissed = aMissedDates.slice(0, 6);

      mockHabits([makeHabit('h_a', 'A'), makeHabit('h_b', 'B')]);
      mockLogs([
        ...aDoneDates.map((d) => makeLog('h_a', d, true)),
        ...bDoneOnADone.map((d) => makeLog('h_b', d, true)),
        ...bDoneOnAMissed.map((d) => makeLog('h_b', d, true)),
      ]);

      const result = await correlationService.getInsights('u1', { windowDays: 30 });
      // A→B direction lift is 13pp, filtered.
      const aToB = result.insights.find((i) => i.from.name === 'A' && i.to.name === 'B');
      expect(aToB).toBeUndefined();
    });
  });

  describe('getInsights — ordering and shape', () => {
    it('sorts insights by absolute lift descending', async () => {
      // Pair 1 (A,B): strong positive (+100pp).
      // Pair 2 (A,C): weaker negative. We'll engineer ~-30pp.
      const window = dateRange('2024-01-17', '2024-02-15'); // 30 days, Thursday Jan 17 - Thursday Feb 15
      const aDone = window.slice(0, 15);
      const aMissed = window.slice(15);
      // B perfectly correlated with A.
      const bDone = [...aDone];
      // C: present on ~3 of A-done days, ~12 of A-missed days → lift = (3/15 - 12/15)*100 = -60pp.
      const cDone = [...aDone.slice(0, 3), ...aMissed.slice(0, 12)];

      mockHabits([makeHabit('h_a', 'A'), makeHabit('h_b', 'B'), makeHabit('h_c', 'C')]);
      mockLogs([
        ...aDone.map((d) => makeLog('h_a', d, true)),
        ...bDone.map((d) => makeLog('h_b', d, true)),
        ...cDone.map((d) => makeLog('h_c', d, true)),
      ]);

      const result = await correlationService.getInsights('u1', { windowDays: 30 });

      expect(result.insights.length).toBeGreaterThan(0);
      // Strongest absolute first.
      const lifts = result.insights.map((i) => Math.abs(i.liftPp));
      for (let i = 1; i < lifts.length; i++) {
        expect(lifts[i - 1]).toBeGreaterThanOrEqual(lifts[i]);
      }
      // Top must be the A↔B pair (perfect correlation, +100pp).
      expect(Math.abs(result.insights[0].liftPp)).toBe(100);
    });

    it('caches the computed result', async () => {
      mockHabits([makeHabit('h_a', 'A'), makeHabit('h_b', 'B')]);
      mockLogs([]);

      await correlationService.getInsights('u1', { windowDays: 30 });

      expect(cache.set).toHaveBeenCalledWith(
        'insights:u1:30',
        expect.objectContaining({ windowDays: 30 }),
        expect.any(Number),
      );
    });
  });
});
