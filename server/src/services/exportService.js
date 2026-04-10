import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import Habit from '../models/Habit.js';
import HabitLog from '../models/HabitLog.js';
import { toUTCMidnight } from '../utils/dateHelpers.js';
import { CATEGORY_DEFAULTS } from '../config/constants.js';
import sharedHabitService from './sharedHabitService.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function isCompleted(log, habit) {
  if (!log) return false;
  return typeof log.value === 'boolean' ? log.value : log.value >= habit.target;
}

// Uses $and to combine the createdDate/createdAt filter with the active-or-logged filter,
// so neither collides with any $or/$and the caller may have in baseFilter.
function buildVisibleHabitQuery(baseFilter, cutoffDateStr, loggedHabitIds, activeFilter) {
  const nextDayMidnight = new Date(toUTCMidnight(cutoffDateStr).getTime() + 86400000);
  const { $or: baseOr, $and: baseAnd, ...rest } = baseFilter;
  const conditions = [
    { $or: [
      { createdDate: { $lte: cutoffDateStr } },
      { createdDate: { $exists: false }, createdAt: { $lt: nextDayMidnight } },
    ] },
    { $or: [activeFilter, { _id: { $in: loggedHabitIds } }] },
  ];
  if (baseOr) conditions.push({ $or: baseOr });
  if (baseAnd) conditions.push(...baseAnd);
  return { ...rest, $and: conditions };
}

function getUTCDateString(createdAt) {
  if (!createdAt) return null;
  if (typeof createdAt === 'string') return createdAt.slice(0, 10);

  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isHabitActiveOnDate(habit, dateStr) {
  const createdDate = habit.createdDate || getUTCDateString(habit.createdAt);
  return !createdDate || dateStr >= createdDate;
}

class ExportService {
  async getExportData(userId, startDate, endDate) {
    const start = toUTCMidnight(startDate);
    const end = toUTCMidnight(endDate);
    const logs = await HabitLog.find({
      userId,
      date: { $gte: start, $lte: end },
    }).sort({ date: 1 });
    const loggedHabitIds = [...new Set(logs.map((log) => log.habitId.toString()))];

    const ownHabits = await Habit.find(
      buildVisibleHabitQuery({ userId }, endDate, loggedHabitIds, { isArchived: false })
    ).sort({ sortOrder: 1 });

    const sharedEntries = await sharedHabitService.getSharedHabitIdsForUser(userId);
    const sharedHabitIds = sharedEntries.map((entry) => entry.habitId);
    let sharedHabits = [];

    if (sharedHabitIds.length > 0) {
      sharedHabits = await Habit.find(
        buildVisibleHabitQuery(
          { _id: { $in: sharedHabitIds } },
          endDate,
          loggedHabitIds,
          { isArchived: false }
        )
      ).sort({ createdAt: -1 });
    }

    const habits = [...ownHabits, ...sharedHabits];
    const habitIdSet = new Set(habits.map((habit) => habit._id.toString()));
    const filteredLogs = logs.filter((log) => habitIdSet.has(log.habitId.toString()));

    // Build log lookup: habitId-dateStr → log
    const logMap = new Map();
    for (const log of filteredLogs) {
      const dateKey = log.date.toISOString().split('T')[0];
      logMap.set(`${log.habitId}-${dateKey}`, log);
    }

    // Build date array
    const dates = [];
    const s = new Date(startDate + 'T00:00:00Z');
    const e = new Date(endDate + 'T00:00:00Z');
    for (let d = new Date(s); d <= e; d = new Date(d.getTime() + 86400000)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    // Per-habit stats
    const habitStats = habits.map((habit) => {
      let daysTracked = 0;
      let daysCompleted = 0;
      for (const dateStr of dates) {
        if (!isHabitActiveOnDate(habit, dateStr)) continue;
        const dayOfWeek = new Date(dateStr + 'T00:00:00Z').getUTCDay();
        if (!habit.frequency.includes(dayOfWeek)) continue;
        daysTracked++;
        const log = logMap.get(`${habit._id}-${dateStr}`);
        if (isCompleted(log, habit)) daysCompleted++;
      }
      const completionRate = daysTracked > 0 ? Math.round((daysCompleted / daysTracked) * 100) : 0;
      const catConfig = CATEGORY_DEFAULTS[habit.category] || { label: habit.category, color: '#6B7280' };
      return { habit, daysTracked, daysCompleted, completionRate, catConfig };
    });

    return { habits, logs: filteredLogs, logMap, dates, habitStats, start, end };
  }

  // ─── EXCEL EXPORT ────────────────────────────────────────────
  async generateExcel(userId, startDate, endDate) {
    const { habits, logMap, dates, habitStats } = await this.getExportData(userId, startDate, endDate);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Habit Tracker';
    wb.created = new Date();

    // ── Sheet 1: Summary ──
    const summary = wb.addWorksheet('Summary', {
      properties: { tabColor: { argb: '6366F1' } },
    });

    summary.columns = [
      { header: 'Habit', key: 'name', width: 22 },
      { header: 'Category', key: 'category', width: 14 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Target', key: 'target', width: 8 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Days Tracked', key: 'tracked', width: 13 },
      { header: 'Days Completed', key: 'completed', width: 15 },
      { header: 'Completion %', key: 'rate', width: 13 },
      { header: 'Current Streak', key: 'currentStreak', width: 14 },
      { header: 'Best Streak', key: 'bestStreak', width: 12 },
    ];

    // Style header row
    const headerRow = summary.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '6366F1' } };
    headerRow.alignment = { horizontal: 'center' };

    for (const stat of habitStats) {
      const row = summary.addRow({
        name: stat.habit.name,
        category: stat.catConfig.label,
        type: stat.habit.type === 'boolean' ? 'Yes/No' : 'Count',
        target: stat.habit.target,
        unit: stat.habit.unit || '-',
        tracked: stat.daysTracked,
        completed: stat.daysCompleted,
        rate: stat.completionRate / 100,
        currentStreak: stat.habit.currentStreak,
        bestStreak: stat.habit.longestStreak,
      });

      // Conditional formatting on completion % cell
      const rateCell = row.getCell('rate');
      rateCell.numFmt = '0%';
      if (stat.completionRate >= 75) {
        rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
        rateCell.font = { color: { argb: '065F46' }, bold: true };
      } else if (stat.completionRate >= 50) {
        rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
        rateCell.font = { color: { argb: '92400E' }, bold: true };
      } else {
        rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
        rateCell.font = { color: { argb: '991B1B' }, bold: true };
      }
    }

    // ── Sheet 2: Daily Log ──
    const daily = wb.addWorksheet('Daily Log', {
      properties: { tabColor: { argb: '22C55E' } },
    });

    daily.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Day', key: 'day', width: 10 },
      { header: 'Week #', key: 'week', width: 8 },
      { header: 'Habit', key: 'habit', width: 22 },
      { header: 'Category', key: 'category', width: 14 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Value', key: 'value', width: 8 },
      { header: 'Target', key: 'target', width: 8 },
      { header: 'Completed', key: 'completed', width: 11 },
      { header: 'Notes', key: 'notes', width: 25 },
    ];

    const dailyHeader = daily.getRow(1);
    dailyHeader.font = { bold: true, color: { argb: 'FFFFFF' } };
    dailyHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '22C55E' } };
    dailyHeader.alignment = { horizontal: 'center' };

    for (const dateStr of dates) {
      const d = new Date(dateStr + 'T00:00:00Z');
      const dayName = DAY_NAMES[d.getUTCDay()];
      const weekNum = getWeekNumber(d);

      for (const habit of habits) {
        if (!isHabitActiveOnDate(habit, dateStr)) continue;
        const log = logMap.get(`${habit._id}-${dateStr}`);
        const completed = isCompleted(log, habit);
        const catLabel = CATEGORY_DEFAULTS[habit.category]?.label || habit.category;

        daily.addRow({
          date: dateStr,
          day: dayName,
          week: weekNum,
          habit: habit.name,
          category: catLabel,
          type: habit.type === 'boolean' ? 'Yes/No' : 'Count',
          value: log?.value ?? '',
          target: habit.target,
          completed: completed ? 1 : 0,
          notes: log?.notes || '',
        });
      }
    }

    // Auto-filter on daily log
    daily.autoFilter = { from: 'A1', to: 'J1' };

    // ── Sheet 3: Weekly View ──
    const weekly = wb.addWorksheet('Weekly View', {
      properties: { tabColor: { argb: 'F59E0B' } },
    });

    // Build columns: Date | Day | ...habit names
    const weeklyColumns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Day', key: 'day', width: 6 },
    ];
    for (const habit of habits) {
      weeklyColumns.push({ header: habit.name, key: `h_${habit._id}`, width: 14 });
    }
    weekly.columns = weeklyColumns;

    // Style header
    const weeklyHeader = weekly.getRow(1);
    weeklyHeader.font = { bold: true, color: { argb: 'FFFFFF' } };
    weeklyHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F59E0B' } };
    weeklyHeader.alignment = { horizontal: 'center' };

    let currentWeek = null;

    for (const dateStr of dates) {
      const d = new Date(dateStr + 'T00:00:00Z');
      const weekNum = getWeekNumber(d);
      const dayShort = DAY_SHORT[d.getUTCDay()];

      // Insert week separator row
      if (currentWeek !== null && weekNum !== currentWeek) {
        const sepRow = weekly.addRow({ date: '', day: '' });
        sepRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F4F6' } };
      }
      currentWeek = weekNum;

      const rowData = { date: dateStr, day: dayShort };
      for (const habit of habits) {
        if (!isHabitActiveOnDate(habit, dateStr)) {
          rowData[`h_${habit._id}`] = '-';
          continue;
        }
        const log = logMap.get(`${habit._id}-${dateStr}`);
        const dayOfWeek = d.getUTCDay();
        if (!habit.frequency.includes(dayOfWeek)) {
          rowData[`h_${habit._id}`] = '-';
        } else if (!log) {
          rowData[`h_${habit._id}`] = '';
        } else if (habit.type === 'boolean') {
          rowData[`h_${habit._id}`] = log.value ? '\u2713' : '\u2717';
        } else {
          rowData[`h_${habit._id}`] = log.value;
        }
      }

      const row = weekly.addRow(rowData);

      // Color completed cells
      for (let c = 3; c <= 2 + habits.length; c++) {
        const cell = row.getCell(c);
        const val = cell.value;
        if (val === '\u2713') {
          cell.font = { color: { argb: '16A34A' }, bold: true };
        } else if (val === '\u2717') {
          cell.font = { color: { argb: 'DC2626' } };
        } else if (val === '-') {
          cell.font = { color: { argb: 'D1D5DB' } };
        }
        cell.alignment = { horizontal: 'center' };
      }
    }

    return wb.xlsx.writeBuffer();
  }

  // ─── PDF EXPORT ──────────────────────────────────────────────
  async generatePDF(userId, startDate, endDate) {
    const { habits, logMap, dates, habitStats } = await this.getExportData(userId, startDate, endDate);

    // Group habits by category
    const categoryGroups = {};
    for (const stat of habitStats) {
      const cat = stat.habit.category || 'other';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(stat);
    }

    // Overall stats
    const totalTracked = habitStats.reduce((s, h) => s + h.daysTracked, 0);
    const totalCompleted = habitStats.reduce((s, h) => s + h.daysCompleted, 0);
    const overallRate = totalTracked > 0 ? Math.round((totalCompleted / totalTracked) * 100) : 0;
    const bestHabit = habitStats.length > 0
      ? habitStats.reduce((a, b) => a.completionRate > b.completionRate ? a : b)
      : null;

    // Most consistent day of week
    const dayCompletions = Array(7).fill(0);
    const dayScheduled = Array(7).fill(0);
    for (const dateStr of dates) {
      const dow = new Date(dateStr + 'T00:00:00Z').getUTCDay();
      for (const habit of habits) {
        if (!isHabitActiveOnDate(habit, dateStr)) continue;
        if (!habit.frequency.includes(dow)) continue;
        dayScheduled[dow]++;
        const log = logMap.get(`${habit._id}-${dateStr}`);
        if (isCompleted(log, habit)) dayCompletions[dow]++;
      }
    }
    let bestDayIdx = 0;
    let bestDayRate = 0;
    for (let i = 0; i < 7; i++) {
      const rate = dayScheduled[i] > 0 ? dayCompletions[i] / dayScheduled[i] : 0;
      if (rate > bestDayRate) { bestDayRate = rate; bestDayIdx = i; }
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = 595.28;
      const marginL = 50;
      const marginR = 50;
      const contentW = pageW - marginL - marginR;

      // ── PAGE 1: COVER ──
      doc.moveDown(4);
      doc.fontSize(28).font('Helvetica-Bold').fillColor('#1e1e1e')
        .text('Habit Tracker Report', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(13).font('Helvetica').fillColor('#666')
        .text(`${startDate}  to  ${endDate}`, { align: 'center' });
      doc.moveDown(3);

      // Stats grid
      const statsY = doc.y;
      const statsBoxW = contentW / 2 - 10;
      const statsBoxH = 60;

      const drawStatBox = (x, y, label, value, color) => {
        doc.roundedRect(x, y, statsBoxW, statsBoxH, 6).fillAndStroke('#F9FAFB', '#E5E7EB');
        doc.fontSize(22).font('Helvetica-Bold').fillColor(color)
          .text(value, x, y + 10, { width: statsBoxW, align: 'center' });
        doc.fontSize(9).font('Helvetica').fillColor('#6B7280')
          .text(label, x, y + 38, { width: statsBoxW, align: 'center' });
      };

      drawStatBox(marginL, statsY, 'Total Habits', `${habits.length}`, '#6366F1');
      drawStatBox(marginL + statsBoxW + 20, statsY, 'Overall Completion', `${overallRate}%`, overallRate >= 75 ? '#16A34A' : overallRate >= 50 ? '#D97706' : '#DC2626');
      drawStatBox(marginL, statsY + statsBoxH + 15, 'Best Habit', bestHabit ? (bestHabit.habit.name || '').substring(0, 20) : '-', '#6366F1');
      drawStatBox(marginL + statsBoxW + 20, statsY + statsBoxH + 15, 'Best Day', `${DAY_NAMES[bestDayIdx]} (${Math.round(bestDayRate * 100)}%)`, '#6366F1');

      doc.y = statsY + 2 * (statsBoxH + 15) + 20;
      doc.moveDown(1);
      doc.fontSize(8).fillColor('#999')
        .text(`Generated on ${new Date().toISOString().split('T')[0]}`, { align: 'center' });

      // ── PAGE 2+: SUMMARY TABLE BY CATEGORY ──
      doc.addPage();
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e1e1e').text('Habit Summary');
      doc.moveDown(0.8);

      const col = { name: marginL, type: 220, rate: 300, streak: 400 };

      for (const [cat, stats] of Object.entries(categoryGroups)) {
        const catConfig = CATEGORY_DEFAULTS[cat] || { label: cat, color: '#6B7280' };

        // Category header with accent
        if (doc.y > 700) { doc.addPage(); }
        const catY = doc.y;
        doc.rect(marginL, catY, 4, 16).fill(catConfig.color);
        doc.fontSize(11).font('Helvetica-Bold').fillColor(catConfig.color)
          .text(`  ${catConfig.label}`, marginL + 8, catY + 1);
        doc.moveDown(0.6);

        // Column headers
        const hdrY = doc.y;
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#6B7280');
        doc.text('Habit', col.name, hdrY);
        doc.text('Type', col.type, hdrY);
        doc.text('Completion', col.rate, hdrY);
        doc.text('Streak', col.streak, hdrY);
        doc.moveTo(marginL, hdrY + 13).lineTo(pageW - marginR, hdrY + 13).stroke('#E5E7EB');
        let y = hdrY + 18;

        for (const stat of stats) {
          if (y > 740) { doc.addPage(); y = 50; }
          const rateColor = stat.completionRate >= 75 ? '#16A34A' : stat.completionRate >= 50 ? '#D97706' : '#DC2626';

          doc.fontSize(9).font('Helvetica').fillColor('#1e1e1e');
          doc.text(stat.habit.name.substring(0, 28), col.name, y, { width: 165 });
          doc.text(stat.habit.type === 'boolean' ? 'Yes/No' : 'Count', col.type, y);
          doc.fontSize(9).font('Helvetica-Bold').fillColor(rateColor);
          doc.text(`${stat.completionRate}% (${stat.daysCompleted}/${stat.daysTracked})`, col.rate, y);
          doc.fontSize(9).font('Helvetica').fillColor('#1e1e1e');
          doc.text(`${stat.habit.currentStreak}d / best ${stat.habit.longestStreak}d`, col.streak, y);
          y += 16;
        }
        doc.y = y + 8;
      }

      // ── NEXT PAGES: DAILY GRID ──
      doc.addPage();
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e1e1e').text('Daily Log');
      doc.moveDown(0.5);

      // Calculate column widths
      const dateColW = 65;
      const habitColW = habits.length > 0
        ? Math.min(65, (contentW - dateColW) / habits.length)
        : 65;

      // Show max habits that fit
      const maxHabits = Math.floor((contentW - dateColW) / habitColW);
      const visibleHabits = habits.slice(0, maxHabits);

      // Grid header
      const drawGridHeader = () => {
        const gy = doc.y;
        doc.rect(marginL, gy, contentW, 28).fill('#F3F4F6');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#374151');
        doc.text('Date', marginL + 4, gy + 10, { width: dateColW });
        visibleHabits.forEach((h, i) => {
          const x = marginL + dateColW + i * habitColW;
          doc.text(h.name.substring(0, 8), x + 2, gy + 3, { width: habitColW - 4, align: 'center' });
          doc.fontSize(6).fillColor('#9CA3AF');
          doc.text(h.type === 'boolean' ? 'Y/N' : h.unit || 'cnt', x + 2, gy + 16, { width: habitColW - 4, align: 'center' });
          doc.fontSize(7).fillColor('#374151');
        });
        return gy + 32;
      };

      let gridY = drawGridHeader();

      for (const dateStr of dates) {
        if (gridY > 750) {
          doc.addPage();
          doc.y = 50;
          gridY = drawGridHeader();
        }

        const d = new Date(dateStr + 'T00:00:00Z');
        const dayShort = DAY_SHORT[d.getUTCDay()];

        // Alternate row background
        const rowIdx = dates.indexOf(dateStr);
        if (rowIdx % 2 === 0) {
          doc.rect(marginL, gridY, contentW, 14).fill('#FAFAFA');
        }

        doc.fontSize(7).font('Helvetica').fillColor('#374151');
        doc.text(`${dayShort} ${dateStr.slice(5)}`, marginL + 4, gridY + 3, { width: dateColW });

        visibleHabits.forEach((habit, i) => {
          const x = marginL + dateColW + i * habitColW;
          const dow = d.getUTCDay();
          const log = logMap.get(`${habit._id}-${dateStr}`);

          if (!isHabitActiveOnDate(habit, dateStr) || !habit.frequency.includes(dow)) {
            doc.fontSize(7).fillColor('#D1D5DB').text('-', x + 2, gridY + 3, { width: habitColW - 4, align: 'center' });
          } else if (!log) {
            doc.fontSize(7).fillColor('#DC2626').text('\u2717', x + 2, gridY + 3, { width: habitColW - 4, align: 'center' });
          } else if (habit.type === 'boolean') {
            const color = log.value ? '#16A34A' : '#DC2626';
            const symbol = log.value ? '\u2713' : '\u2717';
            doc.fontSize(7).fillColor(color).text(symbol, x + 2, gridY + 3, { width: habitColW - 4, align: 'center' });
          } else {
            const done = log.value >= habit.target;
            doc.fontSize(7).fillColor(done ? '#16A34A' : '#D97706')
              .text(`${log.value}`, x + 2, gridY + 3, { width: habitColW - 4, align: 'center' });
          }
        });

        gridY += 14;
      }

      // Footer
      doc.fontSize(8).fillColor('#999')
        .text('Generated by Habit Tracker', marginL, 780, { align: 'center', width: contentW });

      doc.end();
    });
  }
}

export default new ExportService();
