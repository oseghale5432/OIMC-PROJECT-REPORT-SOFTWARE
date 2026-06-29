/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { YTDTask, StaffMember, MonthProgress, TaskItem } from './types';

const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

export class GoogleSheetsService {
  /**
   * Searches the user's Google Drive for an existing progress tracker sheet
   */
  static async findExistingSheet(accessToken: string): Promise<{ id: string; name: string } | null> {
    try {
      const q = encodeURIComponent("name = '2026 Progress Tracker Report' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
      const res = await fetch(`${DRIVE_BASE}/files?q=${q}&fields=files(id,name)`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        throw new Error('Failed to query Google Drive');
      }

      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return { id: data.files[0].id, name: data.files[0].name };
      }
      return null;
    } catch (error) {
      console.error('Error finding existing sheet:', error);
      return null;
    }
  }

  /**
   * Creates a new Google Spreadsheet and initializes all tabs and default data
   */
  static async createNewSpreadsheet(
    accessToken: string,
    defaultTasks: YTDTask[],
    defaultStaff: StaffMember[],
    progressReports: MonthProgress[]
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    try {
      // 1. Create Spreadsheet with worksheets
      const spreadsheetPayload = {
        properties: {
          title: '2026 Progress Tracker Report',
        },
        sheets: [
          { properties: { title: 'YTD_Tasks' } },
          { properties: { title: 'Staff_Profiles' } },
          { properties: { title: 'Progress_Reports' } },
        ],
      };

      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(spreadsheetPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to create spreadsheet: ${errText}`);
      }

      const spreadsheet = await res.json();
      const spreadsheetId = spreadsheet.spreadsheetId;
      const spreadsheetUrl = spreadsheet.spreadsheetUrl;

      // 2. Populate Default YTD Tasks
      await this.saveYTDTasksToSheet(accessToken, spreadsheetId, defaultTasks);

      // 3. Populate Default Staff Profiles
      await this.saveStaffProfilesToSheet(accessToken, spreadsheetId, defaultStaff);

      // 4. Populate Default Progress Reports
      await this.saveProgressReportsToSheet(accessToken, spreadsheetId, progressReports);

      return { spreadsheetId, spreadsheetUrl };
    } catch (error) {
      console.error('Error creating spreadsheet:', error);
      throw error;
    }
  }

  /**
   * Saves YTD Tasks to Google Sheets
   */
  static async saveYTDTasksToSheet(accessToken: string, spreadsheetId: string, tasks: YTDTask[]): Promise<void> {
    const range = 'YTD_Tasks!A1:K';
    const headers = [
      'Task ID',
      'Department',
      'Lead / Managed By',
      'Co-Worker',
      'Contractor / Dept Head',
      'Task Description',
      'Start Date',
      'Due Date',
      'Days Remaining',
      'Status',
      'Remark',
    ];

    const rows = tasks.map((t) => [
      t.id,
      t.department,
      t.lead,
      t.coWorker,
      t.contractorHead,
      t.description,
      t.startDate,
      t.dueDate,
      t.daysRemaining.toString(),
      t.status,
      t.remark,
    ]);

    const values = [headers, ...rows];

    await this.updateRange(accessToken, spreadsheetId, range, values);
  }

  /**
   * Saves Staff Profiles to Google Sheets
   */
  static async saveStaffProfilesToSheet(accessToken: string, spreadsheetId: string, staff: StaffMember[]): Promise<void> {
    const range = 'Staff_Profiles!A1:I';
    const headers = [
      'Email',
      'Name',
      'Department',
      'Activity',
      'Label',
      'Is New (TRUE/FALSE)',
      'Role (admin/staff)',
      'Password',
      'Is First Login (TRUE/FALSE)'
    ];

    const rows = staff.map((s) => [
      s.email,
      s.name,
      s.department,
      s.activity,
      s.label,
      s.isNew ? 'TRUE' : 'FALSE',
      s.role || 'staff',
      s.password || '',
      s.isFirstLogin === false ? 'FALSE' : 'TRUE',
    ]);

    const values = [headers, ...rows];

    await this.updateRange(accessToken, spreadsheetId, range, values);
  }

  /**
   * Saves all progress reports to Google Sheets.
   * To keep it fast, we write all reports as a flat list of records.
   */
  static async saveProgressReportsToSheet(accessToken: string, spreadsheetId: string, reports: MonthProgress[]): Promise<void> {
    const range = 'Progress_Reports!A1:AH';
    const headers = [
      'Report ID',
      'Staff Email',
      'Month',
      'Activity',
      ...Array.from({ length: 15 }, (_, i) => `Task_${i + 1}_Desc`),
      ...Array.from({ length: 15 }, (_, i) => `Task_${i + 1}_Completed`),
    ];

    const rows = reports.map((r) => {
      const row = [r.id, r.staffEmail, r.month, r.activity];
      
      // Pad task descriptions
      for (let i = 0; i < 15; i++) {
        const t = r.tasks[i];
        if (t) {
          const prefix = t.ytdTaskId ? `[YTD:${t.ytdTaskId}]` : '';
          row.push(`${prefix}${t.description}`);
        } else {
          row.push('');
        }
      }

      // Pad task completed states (1 for completed, 0 for incomplete, -1 for no task)
      for (let i = 0; i < 15; i++) {
        const comp = r.tasks[i]?.completed;
        let strVal = '';
        if (comp === true) strVal = '1';
        else if (comp === false) strVal = '0';
        else strVal = '-1';
        row.push(strVal);
      }

      return row;
    });

    const values = [headers, ...rows];

    await this.updateRange(accessToken, spreadsheetId, range, values);
  }

  /**
   * Fetches all database structures from a linked Google Spreadsheet
   */
  static async fetchAllDataFromSheet(
    accessToken: string,
    spreadsheetId: string
  ): Promise<{
    ytdTasks: YTDTask[];
    staff: StaffMember[];
    progressReports: MonthProgress[];
  }> {
    try {
      // Fetch ranges in batch to save requests
      const ranges = ['YTD_Tasks!A1:K200', 'Staff_Profiles!A1:I100', 'Progress_Reports!A1:AH2000'];
      const res = await fetch(`${API_BASE}/${spreadsheetId}/values:batchGet?ranges=${ranges.join('&ranges=')}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        throw new Error('Failed to batch fetch values from Google Spreadsheet');
      }

      const data = await res.json();
      const valueRanges = data.valueRanges || [];

      const ytdTasksRaw = valueRanges[0]?.values || [];
      const staffRaw = valueRanges[1]?.values || [];
      const reportsRaw = valueRanges[2]?.values || [];

      // Parse YTD Tasks
      const ytdTasks: YTDTask[] = [];
      if (ytdTasksRaw.length > 1) {
        const rows = ytdTasksRaw.slice(1);
        rows.forEach((row: string[]) => {
          if (!row[0]) return; // Skip empty rows
          ytdTasks.push({
            id: row[0] || Math.random().toString(36).substr(2, 9),
            department: row[1] || '',
            lead: row[2] || '',
            coWorker: row[3] || '',
            contractorHead: row[4] || '',
            description: row[5] || '',
            startDate: row[6] || '',
            dueDate: row[7] || '',
            daysRemaining: parseInt(row[8] || '0', 10),
            status: row[9] || '',
            remark: row[10] || '',
          });
        });
      }

      // Parse Staff
      const staff: StaffMember[] = [];
      if (staffRaw.length > 1) {
        const rows = staffRaw.slice(1);
        rows.forEach((row: string[]) => {
          if (!row[0]) return;
          staff.push({
            email: row[0],
            name: row[1] || '',
            department: row[2] || '',
            activity: row[3] || '',
            label: row[4] || `${row[1]} (${row[2]})`,
            isNew: row[5] === 'TRUE',
            role: (row[6] as 'admin' | 'staff') || 'staff',
            password: row[7] || '',
            isFirstLogin: row[8] !== 'FALSE',
          });
        });
      }

      // Parse Progress Reports
      const progressReports: MonthProgress[] = [];
      if (reportsRaw.length > 1) {
        const rows = reportsRaw.slice(1);
        rows.forEach((row: string[]) => {
          if (!row[0] || !row[1]) return;
          const id = row[0];
          const staffEmail = row[1];
          const month = row[2] || '';
          const activity = row[3] || '';

          const tasks: TaskItem[] = [];
          for (let i = 0; i < 15; i++) {
            let desc = row[4 + i] || '';
            const completedRaw = row[19 + i] || '';
            
            let completed: boolean | null = null;
            if (completedRaw === '1') completed = true;
            else if (completedRaw === '0') completed = false;
            
            let ytdTaskId: string | undefined;
            if (desc.startsWith('[YTD:')) {
              const match = desc.match(/^\[YTD:([^\]]+)\](.*)/);
              if (match) {
                ytdTaskId = match[1];
                desc = match[2];
              }
            }
            
            tasks.push({ description: desc, completed, ytdTaskId });
          }

          progressReports.push({
            id,
            staffEmail,
            month,
            activity,
            tasks,
          });
        });
      }

      return {
        ytdTasks: ytdTasks.length > 0 ? ytdTasks : [],
        staff: staff.length > 0 ? staff : [],
        progressReports: progressReports.length > 0 ? progressReports : [],
      };
    } catch (error) {
      console.error('Error fetching data from spreadsheet:', error);
      throw error;
    }
  }

  /**
   * Helper to write values into a specific range
   */
  private static async updateRange(
    accessToken: string,
    spreadsheetId: string,
    range: string,
    values: string[][]
  ): Promise<void> {
    const url = `${API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to update range ${range}: ${errText}`);
    }
  }
}
