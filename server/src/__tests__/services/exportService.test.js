import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.unstable_mockModule('pdfkit', () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule('exceljs', () => ({
  default: {
    Workbook: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/Habit.js', () => ({
  default: {
    find: jest.fn(),
  },
}));

jest.unstable_mockModule('../../models/HabitLog.js', () => ({
  default: {
    find: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/sharedHabitService.js', () => ({
  default: {
    getSharedHabitIdsForUser: jest.fn(),
  },
}));

const { default: Habit } = await import('../../models/Habit.js');
const { default: HabitLog } = await import('../../models/HabitLog.js');
const { default: sharedHabitService } = await import('../../services/sharedHabitService.js');
const { default: exportService } = await import('../../services/exportService.js');

describe('ExportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sharedHabitService.getSharedHabitIdsForUser.mockResolvedValue([]);
  });

  describe('getExportData', () => {
    it('includes archived own habits when they have logs in the range', async () => {
      HabitLog.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            habitId: { toString: () => 'archived1' },
            date: new Date('2025-01-10T00:00:00.000Z'),
            value: true,
          },
        ]),
      });
      Habit.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            _id: { toString: () => 'archived1' },
            name: 'Archived habit',
            category: 'other',
            frequency: [5],
            target: 1,
            currentStreak: 0,
            longestStreak: 2,
            type: 'boolean',
          },
        ]),
      });

      const result = await exportService.getExportData('user1', '2025-01-01', '2025-01-31');

      const call = Habit.find.mock.calls[0][0];
      expect(call.userId).toBe('user1');
      expect(call.$and).toBeDefined();
      // Should include the active-or-logged filter
      const activeOrLogged = call.$and.find((c) => c.$or?.some((o) => o.isArchived !== undefined));
      expect(activeOrLogged).toBeDefined();
      expect(activeOrLogged.$or).toEqual(
        expect.arrayContaining([
          { isArchived: false },
          { _id: { $in: ['archived1'] } },
        ])
      );
      expect(result.habits).toHaveLength(1);
      expect(result.logs).toHaveLength(1);
    });

    it('includes shared habits in export data', async () => {
      HabitLog.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            habitId: { toString: () => 'shared1' },
            date: new Date('2025-01-12T00:00:00.000Z'),
            value: 3,
          },
        ]),
      });
      sharedHabitService.getSharedHabitIdsForUser.mockResolvedValue([
        { habitId: 'shared1', ownerId: 'owner1', role: 'member' },
      ]);
      Habit.find
        .mockReturnValueOnce({
          sort: jest.fn().mockResolvedValue([]),
        })
        .mockReturnValueOnce({
          sort: jest.fn().mockResolvedValue([
            {
              _id: { toString: () => 'shared1' },
              name: 'Shared habit',
              category: 'fitness',
              frequency: [0, 1, 2, 3, 4, 5, 6],
              target: 5,
              currentStreak: 0,
              longestStreak: 1,
              type: 'count',
            },
          ]),
        });

      const result = await exportService.getExportData('user1', '2025-01-01', '2025-01-31');

      expect(result.habits).toHaveLength(1);
      expect(result.habits[0].name).toBe('Shared habit');
      expect(result.logs).toHaveLength(1);
    });

    it('computes correct completion rate and stats', async () => {
      HabitLog.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            habitId: { toString: () => 'h1' },
            date: new Date('2025-01-06T00:00:00.000Z'), // Monday
            value: true,
          },
        ]),
      });
      Habit.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            _id: { toString: () => 'h1' },
            name: 'Exercise',
            type: 'boolean',
            target: 1,
            frequency: [1, 2, 3, 4, 5], // Mon-Fri
            category: 'fitness',
            currentStreak: 5,
            longestStreak: 10,
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
          },
        ]),
      });

      const result = await exportService.getExportData('u1', '2025-01-06', '2025-01-07');

      expect(result.dates).toEqual(['2025-01-06', '2025-01-07']);
      expect(result.habitStats).toHaveLength(1);
      expect(result.habitStats[0].daysTracked).toBe(2); // Mon + Tue
      expect(result.habitStats[0].daysCompleted).toBe(1); // Only Monday logged
      expect(result.habitStats[0].completionRate).toBe(50);
    });

    it('does not count scheduled days before the habit was created', async () => {
      HabitLog.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            habitId: { toString: () => 'h1' },
            date: new Date('2025-01-07T00:00:00.000Z'),
            value: true,
          },
        ]),
      });
      Habit.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            _id: { toString: () => 'h1' },
            name: 'Exercise',
            type: 'boolean',
            target: 1,
            frequency: [1, 2, 3, 4, 5],
            category: 'fitness',
            currentStreak: 1,
            longestStreak: 1,
            createdAt: new Date('2025-01-07T00:00:00.000Z'),
          },
        ]),
      });

      const result = await exportService.getExportData('u1', '2025-01-06', '2025-01-07');

      expect(result.habitStats[0].daysTracked).toBe(1);
      expect(result.habitStats[0].daysCompleted).toBe(1);
      expect(result.habitStats[0].completionRate).toBe(100);
    });

    it('handles count-type habits with target', async () => {
      HabitLog.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          { habitId: { toString: () => 'h2' }, date: new Date('2025-01-06T00:00:00Z'), value: 25 },
          { habitId: { toString: () => 'h2' }, date: new Date('2025-01-07T00:00:00Z'), value: 10 },
        ]),
      });
      Habit.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            _id: { toString: () => 'h2' },
            name: 'Read Pages',
            type: 'count',
            target: 20,
            frequency: [0, 1, 2, 3, 4, 5, 6],
            category: 'learning',
            currentStreak: 3,
            longestStreak: 7,
          },
        ]),
      });

      const result = await exportService.getExportData('u1', '2025-01-06', '2025-01-07');

      expect(result.habitStats[0].daysCompleted).toBe(1); // Only 25 >= 20
    });

    it('returns 0 completion rate when no days tracked', async () => {
      HabitLog.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      Habit.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            _id: { toString: () => 'h1' },
            name: 'Weekday Only',
            type: 'boolean',
            target: 1,
            frequency: [1, 2, 3, 4, 5], // Mon-Fri
            category: 'health',
            currentStreak: 0,
            longestStreak: 0,
          },
        ]),
      });

      // Saturday and Sunday only
      const result = await exportService.getExportData('u1', '2025-01-04', '2025-01-05');

      expect(result.habitStats[0].daysTracked).toBe(0);
      expect(result.habitStats[0].completionRate).toBe(0);
    });

    it('filters logs to only include habits in the result set', async () => {
      HabitLog.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          { habitId: { toString: () => 'h1' }, date: new Date('2025-01-06T00:00:00Z'), value: true },
          { habitId: { toString: () => 'unknown' }, date: new Date('2025-01-06T00:00:00Z'), value: true },
        ]),
      });
      Habit.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            _id: { toString: () => 'h1' },
            name: 'Exercise',
            type: 'boolean',
            target: 1,
            frequency: [0, 1, 2, 3, 4, 5, 6],
            category: 'fitness',
            currentStreak: 0,
            longestStreak: 0,
          },
        ]),
      });

      const result = await exportService.getExportData('u1', '2025-01-06', '2025-01-06');

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].habitId.toString()).toBe('h1');
    });

    it('does not fetch shared habits when none exist', async () => {
      HabitLog.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      Habit.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });

      const result = await exportService.getExportData('u1', '2025-01-06', '2025-01-07');

      // Habit.find should only be called once (own habits), not twice (shared)
      expect(Habit.find).toHaveBeenCalledTimes(1);
      expect(result.habits).toHaveLength(0);
    });
  });
});
