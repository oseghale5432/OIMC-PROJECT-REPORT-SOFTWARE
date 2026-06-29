/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StaffMember, YTDTask, MonthProgress } from '../types';

export const DEFAULT_STAFF: StaffMember[] = [
  { 
    email: 'oseghale5432@gmail.com', 
    name: 'Admin Boss', 
    department: 'MANAGEMENT', 
    activity: 'SUPER ADMIN', 
    label: 'Admin Boss (Super Admin)', 
    isNew: false, 
    role: 'admin' 
  }
];

export const DEFAULT_YTD_TASKS: YTDTask[] = [];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const generateDefaultProgressReports = (): MonthProgress[] => {
  return [];
};
