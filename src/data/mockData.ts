/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StaffMember, YTDTask, MonthProgress } from '../types';

export const DEFAULT_STAFF: StaffMember[] = [
  { 
    email: 'oseghale5432@gmail.com', 
    name: 'Super Admin', 
    department: 'MANAGEMENT', 
    activity: 'SUPER ADMIN', 
    label: 'Super Admin', 
    isNew: false, 
    role: 'admin' 
  }
];

export const DEFAULT_YTD_TASKS: YTDTask[] = [];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function getCurrentLagosMonth() {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: 'Africa/Lagos',
  }).format(new Date());
}

export const generateDefaultProgressReports = (): MonthProgress[] => {
  return [];
};

export function isTaskCompleted(task: YTDTask): boolean {
  if (!task) return false;
  const status = (task.status || '').toLowerCase();
  return status.includes('complete') || status === 'done' || !!task.completedMonth;
}

export function getTaskStartMonth(task: YTDTask): string {
  if (task.completedMonth && isTaskCompleted(task)) {
    return task.completedMonth;
  }
  if (!task.startDate) return getCurrentLagosMonth();
  try {
    const parts = task.startDate.split('-');
    if (parts.length === 3) {
      const monthIdx = parseInt(parts[1], 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        return MONTHS[monthIdx];
      }
    }
  } catch (e) {
    // fallback
  }
  return getCurrentLagosMonth();
}

export function autoCarryOverYTDTasks(tasks: YTDTask[]): { updatedTasks: YTDTask[]; changed: boolean } {
  if (!tasks || !Array.isArray(tasks)) return { updatedTasks: [], changed: false };
  const currentMonthName = getCurrentLagosMonth();
  const currentMonthIdx = MONTHS.indexOf(currentMonthName);
  const currentYear = new Date().getFullYear();
  let changed = false;

  const updatedTasks = tasks.map((task) => {
    const completed = isTaskCompleted(task);

    if (completed) {
      if (!task.completedMonth) {
        changed = true;
        return {
          ...task,
          completedMonth: getTaskStartMonth(task),
          completedAt: task.completedAt || new Date().toISOString(),
        };
      }
      return task;
    }

    // Task is active / uncompleted. Check its start month & year
    let startMonthIdx = -1;
    let startYear = currentYear;
    if (task.startDate) {
      const parts = task.startDate.split('-');
      if (parts.length === 3) {
        startYear = parseInt(parts[0], 10);
        startMonthIdx = parseInt(parts[1], 10) - 1;
      }
    }

    const isPriorMonth =
      startYear < currentYear || (startYear === currentYear && startMonthIdx !== -1 && startMonthIdx < currentMonthIdx);

    if (isPriorMonth) {
      changed = true;
      const prevMonthName = (startMonthIdx >= 0 && startMonthIdx < 12) ? MONTHS[startMonthIdx] : 'July';
      const newStartDate = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
      const newDueDate = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const due = new Date(newDueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = due.getTime() - today.getTime();
      const newDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...task,
        startDate: newStartDate,
        dueDate: newDueDate,
        daysRemaining: newDaysRemaining,
        carriedOverFrom: task.carriedOverFrom || prevMonthName,
      };
    }

    return task;
  });

  return { updatedTasks, changed };
}

