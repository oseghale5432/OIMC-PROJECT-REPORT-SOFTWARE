/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TaskDailyUpdate, YTDTask } from '../types';

const DAILY_UPDATES_STORAGE_KEY = 'oi_task_daily_updates';

export const ALL_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export type ReportFilterType = 'ALL' | 'COMPLETED_ONLY' | 'IN_PROGRESS';

export interface ReportPeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isRange: boolean;
  label?: string;
}

/**
 * Normalizes input parameter to a ReportPeriod object
 */
export function normalizePeriod(period: ReportPeriod | string): ReportPeriod {
  if (typeof period === 'string') {
    return {
      startDate: period,
      endDate: period,
      isRange: false,
    };
  }
  return {
    ...period,
    isRange: period.isRange || period.startDate !== period.endDate,
  };
}

/**
 * Returns the current date in YYYY-MM-DD format based on Lagos (Africa/Lagos) timezone.
 */
export function getCurrentLagosDate(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Formats a YYYY-MM-DD date string into a friendly, professional display format.
 * e.g., "Tuesday, 13 October 2026"
 */
export function formatLagosDateForDisplay(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Lagos',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Formats a YYYY-MM-DD date string into a concise display format.
 * e.g., "13 Oct 2026"
 */
export function formatLagosDateShort(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Africa/Lagos',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Formats an ISO string to a human-readable time (e.g., "11:45 AM").
 */
export function formatLagosTime(isoStr: string): string {
  if (!isoStr) return '';
  try {
    const date = new Date(isoStr);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Lagos',
    }).format(date);
  } catch {
    return '';
  }
}

/**
 * Strictly escapes special HTML characters to prevent XSS when rendering printable HTML.
 */
export function escapeHtml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Loads all recorded daily task updates from localStorage.
 */
export function loadDailyUpdateLogs(): TaskDailyUpdate[] {
  try {
    const raw = localStorage.getItem(DAILY_UPDATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load daily update logs:', err);
    return [];
  }
}

/**
 * Saves daily task updates to localStorage.
 */
export function saveDailyUpdateLogs(logs: TaskDailyUpdate[]): void {
  try {
    const trimmed = logs.slice(-1500);
    localStorage.setItem(DAILY_UPDATES_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('Failed to save daily update logs:', err);
  }
}

/**
 * Records a single task update into the audit logs and returns the created update entry.
 */
export function recordTaskUpdate(
  task: YTDTask,
  action: TaskDailyUpdate['action'],
  details: {
    previousStatus?: string;
    newStatus?: string;
    previousRemark?: string;
    newRemark?: string;
    updatedBy?: string;
  }
): TaskDailyUpdate {
  const date = getCurrentLagosDate();
  const timestamp = new Date().toISOString();

  const updateEntry: TaskDailyUpdate = {
    id: `upd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    taskId: task.id,
    taskDescription: task.description || '',
    department: task.department || '',
    lead: task.lead || '',
    coWorker: task.coWorker || '',
    contractorHead: task.contractorHead || '',
    action,
    previousStatus: details.previousStatus,
    newStatus: details.newStatus || task.status,
    previousRemark: details.previousRemark,
    newRemark: details.newRemark !== undefined ? details.newRemark : task.remark,
    updatedBy: details.updatedBy || 'Admin',
    date,
    timestamp,
  };

  const logs = loadDailyUpdateLogs();
  logs.push(updateEntry);
  saveDailyUpdateLogs(logs);

  return updateEntry;
}

/**
 * Returns an array of month names covered between startDate and endDate.
 */
export function getMonthsInRange(startDateStr: string, endDateStr: string): string[] {
  try {
    const startMonthIdx = parseInt(startDateStr.split('-')[1], 10) - 1;
    const endMonthIdx = parseInt(endDateStr.split('-')[1], 10) - 1;
    if (isNaN(startMonthIdx) || isNaN(endMonthIdx)) return ALL_MONTH_NAMES;
    if (startMonthIdx <= endMonthIdx) {
      return ALL_MONTH_NAMES.slice(startMonthIdx, endMonthIdx + 1);
    }
    return ALL_MONTH_NAMES;
  } catch {
    return ALL_MONTH_NAMES;
  }
}

/**
 * Helper to check if a task is completed based on status or completedMonth.
 */
export function isTaskCompleted(task: YTDTask): boolean {
  if (!task) return false;
  const status = (task.status || '').toLowerCase();
  return status.includes('complete') || status === 'done' || !!task.completedMonth;
}

/**
 * Retrieves all updates / projects for a specified date range.
 * Supports filtering by 'ALL', 'COMPLETED_ONLY', or 'IN_PROGRESS'.
 */
export function getUpdatesForDateRange(
  startDate: string,
  endDate: string,
  tasks: YTDTask[],
  filterType: ReportFilterType = 'ALL',
  customLogs?: TaskDailyUpdate[]
): TaskDailyUpdate[] {
  const logs = customLogs || loadDailyUpdateLogs();
  const updatesMap = new Map<string, TaskDailyUpdate>();
  const monthsInRange = new Set(getMonthsInRange(startDate, endDate));

  // 1. Gather from localStorage audit logs within range
  logs.forEach((log) => {
    if (log.date >= startDate && log.date <= endDate) {
      updatesMap.set(log.id, log);
    }
  });

  // 2. Gather from task embedded history within range
  tasks.forEach((t) => {
    if (Array.isArray(t.history)) {
      t.history.forEach((h) => {
        if (h.date >= startDate && h.date <= endDate) {
          updatesMap.set(h.id, h);
        }
      });
    }
  });

  // 3. Fallback inference & Completed project inclusion
  tasks.forEach((t) => {
    const isCompleted = isTaskCompleted(t);
    const completedDate = t.completedAt ? t.completedAt.split('T')[0] : '';
    const updatedDate = t.lastUpdatedDate || (t.updatedAt ? t.updatedAt.split('T')[0] : '');
    const createdDate = t.startDate || (t.createdAt ? t.createdAt.split('T')[0] : '');

    // Check if task completion falls in date range or in months range
    const completedInRange =
      (completedDate && completedDate >= startDate && completedDate <= endDate) ||
      (isCompleted && t.completedMonth && monthsInRange.has(t.completedMonth));

    const updatedInRange = updatedDate && updatedDate >= startDate && updatedDate <= endDate;
    const createdInRange = createdDate && createdDate >= startDate && createdDate <= endDate;

    // A. Completed tasks matching range
    if (completedInRange) {
      const synthId = `comp_${t.id}`;
      if (!updatesMap.has(synthId)) {
        updatesMap.set(synthId, {
          id: synthId,
          taskId: t.id,
          taskDescription: t.description,
          department: t.department,
          lead: t.lead,
          coWorker: t.coWorker,
          contractorHead: t.contractorHead,
          action: 'COMPLETED',
          previousStatus: 'Work commenced',
          newStatus: t.status || 'Completed',
          newRemark: t.remark || (t.completedMonth ? `Completed in ${t.completedMonth}` : 'Completed'),
          updatedBy: t.lead || 'Staff',
          date: completedDate || (createdDate >= startDate && createdDate <= endDate ? createdDate : endDate),
          timestamp: t.completedAt || `${endDate}T12:00:00Z`,
        });
      }
    }

    // B. Updated tasks in range
    if (updatedInRange && !isCompleted) {
      const synthId = `upd_${t.id}`;
      if (!updatesMap.has(synthId)) {
        updatesMap.set(synthId, {
          id: synthId,
          taskId: t.id,
          taskDescription: t.description,
          department: t.department,
          lead: t.lead,
          coWorker: t.coWorker,
          contractorHead: t.contractorHead,
          action: 'STATUS_CHANGE',
          newStatus: t.status,
          newRemark: t.remark,
          updatedBy: t.lead || 'Admin',
          date: updatedDate,
          timestamp: t.updatedAt || `${updatedDate}T12:00:00Z`,
        });
      }
    }

    // C. Created tasks in range
    if (createdInRange && !updatesMap.has(`comp_${t.id}`) && !updatesMap.has(`upd_${t.id}`)) {
      const synthId = `new_${t.id}`;
      if (!updatesMap.has(synthId)) {
        updatesMap.set(synthId, {
          id: synthId,
          taskId: t.id,
          taskDescription: t.description,
          department: t.department,
          lead: t.lead,
          coWorker: t.coWorker,
          contractorHead: t.contractorHead,
          action: 'CREATED',
          newStatus: t.status,
          newRemark: t.remark,
          updatedBy: 'Admin',
          date: createdDate,
          timestamp: t.createdAt || `${createdDate}T09:00:00Z`,
        });
      }
    }
  });

  // Convert to array
  let results = Array.from(updatesMap.values());

  // Apply Scope / Filter Filter
  if (filterType === 'COMPLETED_ONLY') {
    results = results.filter((u) => {
      const isCompletedAction = u.action === 'COMPLETED';
      const isCompletedStatus =
        (u.newStatus || '').toLowerCase().includes('complete') || (u.newStatus || '').toLowerCase() === 'done';
      return isCompletedAction || isCompletedStatus;
    });

    // Also include any tasks from allTasks that are marked completed if they match the months in range
    tasks.forEach((t) => {
      if (isTaskCompleted(t)) {
        const inMonth = t.completedMonth && monthsInRange.has(t.completedMonth);
        const inDate = t.completedAt && t.completedAt.split('T')[0] >= startDate && t.completedAt.split('T')[0] <= endDate;
        if ((inMonth || inDate) && !results.some((r) => r.taskId === t.id)) {
          results.push({
            id: `comp_direct_${t.id}`,
            taskId: t.id,
            taskDescription: t.description,
            department: t.department,
            lead: t.lead,
            coWorker: t.coWorker,
            contractorHead: t.contractorHead,
            action: 'COMPLETED',
            newStatus: t.status || 'Completed',
            newRemark: t.remark || (t.completedMonth ? `Completed in ${t.completedMonth}` : 'Completed'),
            updatedBy: t.lead || 'Staff',
            date: t.completedAt ? t.completedAt.split('T')[0] : endDate,
            timestamp: t.completedAt || `${endDate}T12:00:00Z`,
          });
        }
      }
    });
  } else if (filterType === 'IN_PROGRESS') {
    results = results.filter((u) => {
      const isCompleted =
        u.action === 'COMPLETED' ||
        (u.newStatus || '').toLowerCase().includes('complete') ||
        (u.newStatus || '').toLowerCase() === 'done';
      return !isCompleted;
    });
  }

  // Sort chronologically (most recent first)
  return results.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

/**
 * Backward compatibility helper for single date.
 */
export function getDailyUpdatesForDate(
  targetDate: string,
  tasks: YTDTask[],
  customLogs?: TaskDailyUpdate[]
): TaskDailyUpdate[] {
  return getUpdatesForDateRange(targetDate, targetDate, tasks, 'ALL', customLogs);
}

/**
 * Downloads a structured, Excel-compatible CSV of all task updates / completed projects for a date or date range.
 */
export function downloadDailyReportCSV(
  periodParam: ReportPeriod | string,
  updates: TaskDailyUpdate[],
  allTasks: YTDTask[],
  filterType: ReportFilterType = 'ALL'
): void {
  const period = normalizePeriod(periodParam);
  const rows: string[][] = [];

  const periodHeader = period.isRange
    ? `Report Period: ${formatLagosDateShort(period.startDate)} to ${formatLagosDateShort(period.endDate)} (${period.startDate} to ${period.endDate})`
    : `Report Date: ${formatLagosDateForDisplay(period.startDate)} (${period.startDate})`;

  const filterHeader =
    filterType === 'COMPLETED_ONLY'
      ? 'Scope: COMPLETED PROJECTS & TASKS ONLY'
      : filterType === 'IN_PROGRESS'
      ? 'Scope: ONGOING & IN-PROGRESS TASKS'
      : 'Scope: ALL UPDATES & ACTIVITY';

  // Header banner
  rows.push(['ORANGE ISLAND DEVELOPMENT COMPANY (OIMC)']);
  rows.push(['2026 YTD TASKS - PROJECT PROGRESS & UPDATE REPORT']);
  rows.push([periodHeader]);
  rows.push([filterHeader]);
  rows.push([`Generated On: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' })} (WAT)`]);
  rows.push([`Total Items in Report: ${updates.length}`]);
  rows.push([]); // blank line

  // Column Headers
  rows.push([
    'Date / Time (WAT)',
    'Task ID',
    'Department',
    'Lead / Managed By',
    'Co-Worker',
    'Contractor / Dept Head',
    'Task Description',
    'Action / Status',
    'Previous Status',
    'Current Status',
    'Remarks / Progress Notes',
    'Due Date',
    'Days Remaining',
    'Updated By',
  ]);

  if (updates.length > 0) {
    updates.forEach((u) => {
      const matchedTask = allTasks.find((t) => t.id === u.taskId);
      const displayTime = period.isRange
        ? `${u.date} ${formatLagosTime(u.timestamp)}`
        : formatLagosTime(u.timestamp);

      rows.push([
        displayTime,
        u.taskId,
        u.department,
        u.lead,
        u.coWorker || '',
        u.contractorHead || '',
        u.taskDescription,
        u.action.replace('_', ' '),
        u.previousStatus || '-',
        u.newStatus || matchedTask?.status || '-',
        u.newRemark || matchedTask?.remark || '',
        matchedTask?.dueDate || '',
        matchedTask?.daysRemaining !== undefined ? String(matchedTask.daysRemaining) : '',
        u.updatedBy,
      ]);
    });
  } else {
    rows.push(['No tasks or updates recorded for this selected period and filter.']);
  }

  // Convert to CSV with standard escaping and UTF-8 BOM for Microsoft Excel
  const csvContent =
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const val = cell === undefined || cell === null ? '' : String(cell);
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(',')
      )
      .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const filenameSuffix =
    filterType === 'COMPLETED_ONLY'
      ? '_Completed_Projects'
      : filterType === 'IN_PROGRESS'
      ? '_In_Progress'
      : '';

  const dateSuffix = period.isRange
    ? `${period.startDate}_to_${period.endDate}`
    : period.startDate;

  link.setAttribute('href', url);
  link.setAttribute('download', `OIMC_2026_YTD_Report${filenameSuffix}_${dateSuffix}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Opens a print-optimized, executive PDF document in a new window or trigger print dialog.
 */
export function openDailyReportPrintPDF(
  periodParam: ReportPeriod | string,
  updates: TaskDailyUpdate[],
  allTasks: YTDTask[],
  generatedBy: string,
  mode: 'UPDATES_ONLY' | 'ALL_ACTIVE_SNAPSHOT' = 'UPDATES_ONLY',
  filterType: ReportFilterType = 'ALL'
): void {
  const period = normalizePeriod(periodParam);

  const displayDateOrPeriod = period.isRange
    ? `${formatLagosDateShort(period.startDate)} – ${formatLagosDateShort(period.endDate)}`
    : formatLagosDateForDisplay(period.startDate);

  const periodSubtitle = period.isRange
    ? `From ${period.startDate} to ${period.endDate}`
    : `Date: ${period.startDate}`;

  const nowDisplay = new Date().toLocaleString('en-US', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const totalItems = updates.length;
  const completedCount = updates.filter(
    (u) =>
      u.action === 'COMPLETED' ||
      (u.newStatus && (u.newStatus.toLowerCase().includes('complete') || u.newStatus.toLowerCase() === 'done'))
  ).length;

  const inProgressCount = updates.filter(
    (u) =>
      u.action === 'STATUS_CHANGE' &&
      u.newStatus &&
      !u.newStatus.toLowerCase().includes('complete') &&
      !u.newStatus.toLowerCase().includes('not started')
  ).length;

  const createdCount = updates.filter((u) => u.action === 'CREATED').length;

  // Active snapshot tasks
  const activeTasks = allTasks.filter((t) => {
    const isCompleted = t.status.toLowerCase().includes('complete') || t.status.toLowerCase() === 'done';
    return !isCompleted;
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to view and download the executive PDF report.');
    return;
  }

  const scopeLabel =
    filterType === 'COMPLETED_ONLY'
      ? 'Completed Projects & Tasks'
      : filterType === 'IN_PROGRESS'
      ? 'Ongoing & In-Progress Tasks'
      : 'All Updates & Progress';

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>OIMC 2026 YTD Report - ${escapeHtml(displayDateOrPeriod)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 15mm 10mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 20px;
      font-size: 11px;
      line-height: 1.4;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #f97316;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .company-title {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      text-transform: uppercase;
      margin: 0 0 2px 0;
    }
    .report-title {
      font-size: 14px;
      font-weight: 700;
      color: #ea580c;
      margin: 0 0 4px 0;
    }
    .report-meta {
      font-size: 10px;
      color: #64748b;
    }
    .header-badge {
      background: #0f172a;
      color: #f8fafc;
      padding: 8px 14px;
      border-radius: 6px;
      text-align: right;
    }
    .header-badge .badge-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
    }
    .header-badge .badge-date {
      font-size: 12px;
      font-weight: 700;
      color: #f97316;
    }

    /* Executive KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
      text-align: center;
    }
    .kpi-card.highlight {
      background: #fff7ed;
      border-color: #fdba74;
    }
    .kpi-value {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
      margin-bottom: 4px;
    }
    .kpi-value.green { color: #16a34a; }
    .kpi-value.orange { color: #ea580c; }
    .kpi-value.blue { color: #2563eb; }
    .kpi-label {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.3px;
    }

    /* Table Styles */
    .section-heading {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 10px;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 8px 6px;
      font-weight: 600;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    td {
      padding: 8px 6px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .badge-success { background: #dcfce7; color: #15803d; }
    .badge-warning { background: #fef3c7; color: #b45309; }
    .badge-info { background: #dbeafe; color: #1d4ed8; }
    .badge-neutral { background: #f1f5f9; color: #475569; }
    .badge-orange { background: #ffedd5; color: #c2410c; }

    .status-pill {
      font-weight: 600;
      font-size: 9px;
    }
    .status-change {
      font-size: 9px;
      color: #64748b;
    }
    .status-arrow {
      color: #ea580c;
      font-weight: bold;
    }

    .footer-signatures {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .signature-box {
      width: 45%;
    }
    .signature-line {
      border-bottom: 1px solid #94a3b8;
      height: 35px;
      margin-bottom: 4px;
    }
    .signature-caption {
      font-size: 9px;
      color: #64748b;
    }

    .no-print-bar {
      background: #0f172a;
      color: white;
      padding: 12px 20px;
      margin: -20px -20px 20px -20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .print-btn {
      background: #f97316;
      color: white;
      border: none;
      padding: 8px 16px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
    }
    .print-btn:hover {
      background: #ea580c;
    }

    @media print {
      .no-print-bar {
        display: none !important;
      }
      body {
        padding: 0;
      }
      tr {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div>
      <strong>Executive Report Generated</strong> — Ready to Save as PDF or Print
    </div>
    <button class="print-btn" onclick="window.print()">Save as PDF / Print Report</button>
  </div>

  <div class="header-container">
    <div>
      <div class="company-title">Orange Island Development Company (OIMC)</div>
      <div class="report-title">2026 YTD Task — ${escapeHtml(scopeLabel)}</div>
      <div class="report-meta">
        Generated by: <strong>${escapeHtml(generatedBy || 'Admin')}</strong> | Generated at: ${escapeHtml(nowDisplay)}
      </div>
    </div>
    <div class="header-badge">
      <div class="badge-label">${period.isRange ? 'Report Period' : 'Report Date'}</div>
      <div class="badge-date">${escapeHtml(displayDateOrPeriod)}</div>
      <div style="font-size: 8.5px; color: #cbd5e1; margin-top: 1px;">${escapeHtml(periodSubtitle)}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card highlight">
      <div class="kpi-value orange">${totalItems}</div>
      <div class="kpi-label">Total Items in Scope</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value green">${completedCount}</div>
      <div class="kpi-label">Completed Projects</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value blue">${inProgressCount}</div>
      <div class="kpi-label">In Progress / Commenced</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${createdCount}</div>
      <div class="kpi-label">New Tasks Created</div>
    </div>
  </div>

  <div class="section-heading">
    <span>Itemized Project Details (${escapeHtml(displayDateOrPeriod)})</span>
    <span style="font-size: 9px; color: #64748b; font-weight: normal;">Showing ${totalItems} item(s)</span>
  </div>

  ${
    updates.length > 0
      ? `
  <table>
    <thead>
      <tr>
        <th style="width: 70px;">${period.isRange ? 'Date' : 'Time'}</th>
        <th style="width: 80px;">Dept</th>
        <th>Task Description</th>
        <th style="width: 95px;">Lead / Co-Worker</th>
        <th style="width: 95px;">Contractor Head</th>
        <th style="width: 100px;">Status</th>
        <th>Remarks / Accomplishments</th>
        <th style="width: 65px;">Updated By</th>
      </tr>
    </thead>
    <tbody>
      ${updates
        .map((u) => {
          let actionBadge = `<span class="badge badge-neutral">${escapeHtml(u.action.replace('_', ' '))}</span>`;
          if (
            u.action === 'COMPLETED' ||
            (u.newStatus && (u.newStatus.toLowerCase().includes('complete') || u.newStatus.toLowerCase() === 'done'))
          ) {
            actionBadge = `<span class="badge badge-success">Completed</span>`;
          } else if (u.action === 'CREATED') {
            actionBadge = `<span class="badge badge-orange">New Task</span>`;
          } else if (u.action === 'STATUS_CHANGE') {
            actionBadge = `<span class="badge badge-info">In Progress</span>`;
          }

          const statusDisplay =
            u.previousStatus && u.previousStatus !== u.newStatus
              ? `<div class="status-change">${escapeHtml(u.previousStatus)} <span class="status-arrow">→</span> <strong>${escapeHtml(u.newStatus || '')}</strong></div>`
              : `<div class="status-pill">${escapeHtml(u.newStatus || 'Updated')}</div>`;

          const timeDisplay = period.isRange
            ? `<div style="font-weight: 700;">${escapeHtml(u.date)}</div><div style="font-size: 8.5px; color: #64748b;">${escapeHtml(formatLagosTime(u.timestamp))}</div>`
            : `<span style="font-family: monospace; font-size: 9px;">${escapeHtml(formatLagosTime(u.timestamp))}</span>`;

          return `
            <tr>
              <td>${timeDisplay}</td>
              <td><strong>${escapeHtml(u.department)}</strong></td>
              <td>${escapeHtml(u.taskDescription)}</td>
              <td>
                <div><strong>${escapeHtml(u.lead)}</strong></div>
                ${u.coWorker ? `<div style="color: #64748b; font-size: 8.5px;">+ ${escapeHtml(u.coWorker)}</div>` : ''}
              </td>
              <td>${escapeHtml(u.contractorHead || '-')}</td>
              <td>
                <div style="margin-bottom: 3px;">${actionBadge}</div>
                ${statusDisplay}
              </td>
              <td style="color: #334155;">
                ${u.newRemark ? escapeHtml(u.newRemark) : '<span style="color: #94a3b8;">No remark</span>'}
              </td>
              <td><span style="font-size: 8.5px; color: #64748b;">${escapeHtml(u.updatedBy)}</span></td>
            </tr>
          `;
        })
        .join('')}
    </tbody>
  </table>
  `
      : `
  <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 24px; text-align: center; border-radius: 6px; margin-bottom: 20px;">
    <div style="font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 4px;">No specific records found for ${escapeHtml(displayDateOrPeriod)}</div>
    <div style="font-size: 10px; color: #64748b;">Try widening the date range or selecting another filter option. Below is the active task status snapshot for reference.</div>
  </div>
  `
  }

  ${
    mode === 'ALL_ACTIVE_SNAPSHOT' || updates.length === 0
      ? `
  <div class="section-heading" style="margin-top: 25px;">
    <span>Current Active YTD Tasks Snapshot (${activeTasks.length} Active Tasks)</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 80px;">Dept</th>
        <th>Task Description</th>
        <th style="width: 100px;">Lead / Co-Worker</th>
        <th style="width: 100px;">Contractor Head</th>
        <th style="width: 90px;">Due Date</th>
        <th style="width: 60px;">Days Left</th>
        <th style="width: 90px;">Current Status</th>
      </tr>
    </thead>
    <tbody>
      ${activeTasks
        .map(
          (t) => `
        <tr>
          <td><strong>${escapeHtml(t.department)}</strong></td>
          <td>${escapeHtml(t.description)}</td>
          <td>${escapeHtml(t.lead)}</td>
          <td>${escapeHtml(t.contractorHead || '-')}</td>
          <td>${escapeHtml(t.dueDate)}</td>
          <td>
            <span style="font-weight: 700; color: ${t.daysRemaining < 0 ? '#dc2626' : t.daysRemaining <= 7 ? '#d97706' : '#16a34a'};">
              ${t.daysRemaining}d
            </span>
          </td>
          <td><span class="badge badge-neutral">${escapeHtml(t.status || 'Active')}</span></td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
  `
      : ''
  }

  <div class="footer-signatures">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-caption">
        <strong>Prepared by:</strong> ${escapeHtml(generatedBy || 'Project Administrator')}
        <br />Progress Tracker System Administrator, OIMC
      </div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-caption">
        <strong>Reviewed & Received by:</strong> Executive Management / COO / GM
        <br />Orange Island Development Company
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
