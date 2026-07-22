import { config } from 'dotenv';
import { setDefaultResultOrder } from 'node:dns';
import { createClient } from '@supabase/supabase-js';
import * as googleSheets from '../server/googleSheets.js';
import type { MonthProgress, PaymentRequest, StaffMember, YTDTask, AppNotification } from '../server/types.js';

config({ path: '.env.local' });
config();
setDefaultResultOrder('ipv4first');

// Initialize Supabase Client
const sbUrl = process.env.SUPABASE_URL?.trim();
const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!sbUrl || !sbServiceKey) {
  throw new Error('Missing Supabase environment credentials in .env.local.');
}

const supabase = createClient(sbUrl, sbServiceKey, {
  auth: { persistSession: false }
});

async function readCollection<T>(tableName: string): Promise<T[]> {
  const { data, error } = await supabase
    .from(tableName)
    .select('data');
  if (error) {
    throw error;
  }
  return (data || []).map((row: any) => row.data as T);
}

async function sync() {
  console.log(`Reading data from Supabase database project: ${sbUrl}...`);
  const [ytdTasks, staff, progressReports, payments, notifications, pushTokens] = await Promise.all([
    readCollection<YTDTask>('ytd_tasks'),
    readCollection<StaffMember>('staff'),
    readCollection<MonthProgress>('progress_reports'),
    readCollection<PaymentRequest>('payments'),
    readCollection<AppNotification>('notifications'),
    readCollection<{ email: string; token: string }>('push_tokens'),
  ]);

  console.log(`Writing data to Google Sheets spreadsheet ID: ${googleSheets.getSpreadsheetId()}...`);
  
  await Promise.all([
    googleSheets.saveYTDTasks(ytdTasks),
    googleSheets.saveStaffProfiles(staff),
    googleSheets.saveProgressReports(progressReports),
    googleSheets.savePayments(payments),
    googleSheets.saveNotifications(notifications),
    Promise.all(pushTokens.map((entry) => googleSheets.savePushToken(entry.email, entry.token))),
  ]);

  console.log(
    `Sync complete: ${ytdTasks.length} tasks, ${staff.length} staff, ` +
      `${progressReports.length} reports, ${payments.length} payments, ` +
      `${notifications.length} notifications, ${pushTokens.length} push tokens.`
  );
}

sync().catch((err) => {
  console.error('Synchronization failed:', err);
  process.exitCode = 1;
});
