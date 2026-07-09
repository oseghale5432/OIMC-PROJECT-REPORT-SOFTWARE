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
