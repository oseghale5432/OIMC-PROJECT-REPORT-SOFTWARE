/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TaskDailyUpdate, YTDTask } from '../types';

const DAILY_UPDATES_STORAGE_KEY = 'oi_task_daily_updates';

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
 * e.g., "Tuesday, October 13, 2026"
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
    // Keep the most recent 1000 updates to preserve storage efficiency
    const trimmed = logs.slice(-1000);
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
 * Retrieves all updates for a specified date (YYYY-MM-DD).
 * Gathers entries from:
 * 1. Explicit log entries in localStorage
 * 2. Task embedded `history` entries
 * 3. Fallback discovery from task `updatedAt`, `lastUpdatedDate`, `completedAt`, or `startDate` matching the date
 */
export function getDailyUpdatesForDate(
  targetDate: string,
  tasks: YTDTask[],
  customLogs?: TaskDailyUpdate[]
): TaskDailyUpdate[] {
  const logs = customLogs || loadDailyUpdateLogs();
  const updatesMap = new Map<string, TaskDailyUpdate>();

  // 1. From global logs
  logs.forEach((log) => {
    if (log.date === targetDate) {
      updatesMap.set(log.id, log);
    }
  });

  // 2. From task embedded history
  tasks.forEach((t) => {
    if (Array.isArray(t.history)) {
      t.history.forEach((h) => {
        if (h.date === targetDate) {
          updatesMap.set(h.id, h);
        }
      });
    }
  });

  // 3. Fallback inference: if a task has lastUpdatedDate, completedAt, or startDate matching targetDate
  tasks.forEach((t) => {
    const hasLogForTask = Array.from(updatesMap.values()).some((u) => u.taskId === t.id);
    if (!hasLogForTask) {
      const isCompletedOnDate = t.completedAt && t.completedAt.startsWith(targetDate);
      const isUpdatedOnDate =
        (t.lastUpdatedDate === targetDate) ||
        (t.updatedAt && t.updatedAt.startsWith(targetDate));
      const isCreatedOnDate =
        (t.createdAt && t.createdAt.startsWith(targetDate)) ||
        (t.startDate === targetDate);

      if (isCompletedOnDate) {
        updatesMap.set(`synth_comp_${t.id}`, {
          id: `synth_comp_${t.id}`,
          taskId: t.id,
          taskDescription: t.description,
          department: t.department,
          lead: t.lead,
          coWorker: t.coWorker,
          contractorHead: t.contractorHead,
          action: 'COMPLETED',
          previousStatus: 'Work commenced',
          newStatus: t.status || 'Completed',
          newRemark: t.remark,
          updatedBy: t.lead || 'Staff',
          date: targetDate,
          timestamp: t.completedAt || `${targetDate}T12:00:00Z`,
        });
      } else if (isUpdatedOnDate) {
        updatesMap.set(`synth_upd_${t.id}`, {
          id: `synth_upd_${t.id}`,
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
          date: targetDate,
          timestamp: t.updatedAt || `${targetDate}T12:00:00Z`,
        });
      } else if (isCreatedOnDate) {
        updatesMap.set(`synth_new_${t.id}`, {
          id: `synth_new_${t.id}`,
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
          date: targetDate,
          timestamp: t.createdAt || `${targetDate}T09:00:00Z`,
        });
      }
    }
  });

  // Sort updates chronologically
  return Array.from(updatesMap.values()).sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

/**
 * Downloads a structured, Excel-compatible CSV of all task updates on the given date.
 */
export function downloadDailyReportCSV(
  targetDate: string,
  updates: TaskDailyUpdate[],
  allTasks: YTDTask[]
): void {
  const displayDate = formatLagosDateForDisplay(targetDate);
  const rows: string[][] = [];

  // Header banner
  rows.push(['ORANGE ISLAND DEVELOPMENT COMPANY (OIMC)']);
  rows.push(['2026 YTD TASKS - DAILY PROGRESS & UPDATE REPORT']);
  rows.push([`Report Date: ${displayDate} (${targetDate})`]);
  rows.push([`Generated On: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' })} (WAT)`]);
  rows.push([`Total Task Updates Logged: ${updates.length}`]);
  rows.push([]); // blank line

  // Column Headers
  rows.push([
    'Time (WAT)',
    'Task ID',
    'Department',
    'Lead / Managed By',
    'Co-Worker',
    'Contractor / Dept Head',
    'Task Description',
    'Update Action',
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
      rows.push([
        formatLagosTime(u.timestamp),
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
    rows.push(['No specific updates were logged for this date.']);
  }

  // Convert to CSV with standard escaping and UTF-8 BOM for Microsoft Excel
  const csvContent =
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const val = cell === undefined || cell === null ? '' : String(cell);
            // Escape double quotes by doubling them
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(',')
      )
      .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `OIMC_2026_YTD_Daily_Report_${targetDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Opens a print-optimized, executive PDF document in a new window or trigger print dialog.
 */
export function openDailyReportPrintPDF(
  targetDate: string,
  updates: TaskDailyUpdate[],
  allTasks: YTDTask[],
  generatedBy: string,
  mode: 'UPDATES_ONLY' | 'ALL_ACTIVE_SNAPSHOT' = 'UPDATES_ONLY'
): void {
  const displayDate = formatLagosDateForDisplay(targetDate);
  const nowDisplay = new Date().toLocaleString('en-US', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const totalUpdates = updates.length;
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
  const remarksUpdatedCount = updates.filter((u) => u.action === 'REMARK_UPDATE').length;

  // Gather active snapshot tasks if requested
  const activeTasks = allTasks.filter((t) => {
    const isCompleted = t.status.toLowerCase().includes('complete') || t.status.toLowerCase() === 'done';
    return !isCompleted;
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to view and download the executive PDF report.');
    return;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>OIMC 2026 YTD Task Daily Report - ${escapeHtml(targetDate)}</title>
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
      font-size: 18px;
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
      <strong>Executive Daily Report Generated</strong> — Ready to Save as PDF or Print
    </div>
    <button class="print-btn" onclick="window.print()">Save as PDF / Print Report</button>
  </div>

  <div class="header-container">
    <div>
      <div class="company-title">Orange Island Development Company (OIMC)</div>
      <div class="report-title">2026 YTD Task - Daily Progress & Update Report</div>
      <div class="report-meta">
        Generated by: <strong>${escapeHtml(generatedBy || 'Admin')}</strong> | Generated at: ${escapeHtml(nowDisplay)}
      </div>
    </div>
    <div class="header-badge">
      <div class="badge-label">Report Date</div>
      <div class="badge-date">${escapeHtml(targetDate)}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card highlight">
      <div class="kpi-value orange">${totalUpdates}</div>
      <div class="kpi-label">Updates Logged Today</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value green">${completedCount}</div>
      <div class="kpi-label">Marked Completed</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value blue">${inProgressCount}</div>
      <div class="kpi-label">Progress / Commenced</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${createdCount}</div>
      <div class="kpi-label">New Tasks Created</div>
    </div>
  </div>

  <div class="section-heading">
    <span>Detailed Record of Updates (${escapeHtml(displayDate)})</span>
    <span style="font-size: 9px; color: #64748b; font-weight: normal;">Showing ${totalUpdates} item(s)</span>
  </div>

  ${
    updates.length > 0
      ? `
  <table>
    <thead>
      <tr>
        <th style="width: 55px;">Time</th>
        <th style="width: 80px;">Dept</th>
        <th>Task Description</th>
        <th style="width: 95px;">Lead / Co-Worker</th>
        <th style="width: 100px;">Contractor Head</th>
        <th style="width: 110px;">Update Status</th>
        <th>Remarks / Notes</th>
        <th style="width: 65px;">Updated By</th>
      </tr>
    </thead>
    <tbody>
      ${updates
        .map((u) => {
          let actionBadge = `<span class="badge badge-neutral">${escapeHtml(u.action.replace('_', ' '))}</span>`;
          if (u.action === 'COMPLETED') {
            actionBadge = `<span class="badge badge-success">Completed</span>`;
          } else if (u.action === 'CREATED') {
            actionBadge = `<span class="badge badge-orange">New Task</span>`;
          } else if (u.action === 'STATUS_CHANGE') {
            actionBadge = `<span class="badge badge-info">Status Update</span>`;
          }

          const statusDisplay =
            u.previousStatus && u.previousStatus !== u.newStatus
              ? `<div class="status-change">${escapeHtml(u.previousStatus)} <span class="status-arrow">→</span> <strong>${escapeHtml(u.newStatus || '')}</strong></div>`
              : `<div class="status-pill">${escapeHtml(u.newStatus || 'Updated')}</div>`;

          return `
            <tr>
              <td><span style="font-family: monospace; font-size: 9px;">${escapeHtml(formatLagosTime(u.timestamp))}</span></td>
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
              <td style="color: #334155; font-style: italic;">
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
    <div style="font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 4px;">No specific updates recorded for ${escapeHtml(targetDate)}</div>
    <div style="font-size: 10px; color: #64748b;">All active 2026 YTD tasks remain in ongoing execution. Below is the active task status snapshot for management reference.</div>
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
    // Automatically trigger print dialog after document rendering completes
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
