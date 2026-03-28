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

      expect(Habit.find).toHaveBeenCalledWith({
        userId: 'user1',
        $or: [{ isArchived: false }, { _id: { $in: ['archived1'] } }],
      });
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
  });
});
