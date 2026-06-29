/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface YTDTask {
  id: string;
  department: string;
  lead: string;
  coWorker: string;
  contractorHead: string;
  description: string;
  startDate: string;
  dueDate: string;
  daysRemaining: number;
  status: string;
  remark: string;
}

export interface StaffMember {
  email: string;
  name: string;
  department: string;
  activity: string;
  label: string; // e.g., "Uwa (Projects)"
  isNew: boolean;
  role?: 'admin' | 'staff';
  password?: string;
  isFirstLogin?: boolean;
}

export interface TaskItem {
  description: string;
  completed: boolean | null; // true (1), false (0), null (-1 or no task)
  ytdTaskId?: string; // ID of the linked YTD Task
}

export interface MonthProgress {
  id: string; // `${email}_${month}`
  staffEmail: string;
  month: string; // e.g., "January", "February", etc.
  activity: string;
  tasks: TaskItem[]; // exactly 15 tasks
}

export interface SpreadsheetConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  isSynced: boolean;
  lastSyncedAt: string | null;
}
