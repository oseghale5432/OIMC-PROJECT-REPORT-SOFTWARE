import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { MonthProgress, PaymentRequest, StaffMember, YTDTask, AppNotification } from './types';
import * as googleSheets from './googleSheets.js';

let supabaseClientInstance: SupabaseClient | null = null;

function sanitizeSupabaseUrl(rawUrl: string): string {
  let urlStr = rawUrl.trim();
  const dashMatch = urlStr.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dashMatch && dashMatch[1]) {
    return `https://${dashMatch[1]}.supabase.co`;
  }
  try {
    const parsed = new URL(urlStr);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return urlStr.replace(/\/+$/, '');
  }
}

function getSupabaseClient(): SupabaseClient {
  if (supabaseClientInstance) return supabaseClientInstance;

  const rawUrl = process.env.SUPABASE_URL?.trim();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!rawUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabaseUrl = sanitizeSupabaseUrl(rawUrl);

  supabaseClientInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
  return supabaseClientInstance;
}

async function runWithFallback<T>(supabaseOp: () => Promise<T>, sheetsOp: () => Promise<T>): Promise<T> {
  try {
    return await supabaseOp();
  } catch (error: any) {
    console.error('Supabase operation failed. Falling back to Google Sheets:', error);
    return await sheetsOp();
  }
}

async function runWithBackup(
  supabaseWrite: () => Promise<unknown>,
  sheetsWrite: () => Promise<unknown>
): Promise<void> {
  let supabaseSucceeded = false;
  let supabaseError: any = null;
  try {
    await supabaseWrite();
    supabaseSucceeded = true;
  } catch (error: any) {
    supabaseError = error;
    console.error('Supabase write operation failed. Writing to Google Sheets backup...', error);
  }

  try {
    await sheetsWrite();
  } catch (sheetsError) {
    console.error('Google Sheets backup write failed:', sheetsError);
    if (!supabaseSucceeded) {
      throw supabaseError || sheetsError;
    }
  }

  if (!supabaseSucceeded && supabaseError) {
    throw supabaseError;
  }
}

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function readCollection<T>(tableName: string): Promise<T[]> {
  const { data, error } = await getSupabaseClient()
    .from(tableName)
    .select('*');
  if (error) {
    throw new Error(`Supabase error reading from "${tableName}": ${error.message}`);
  }
  return (data || [])
    .map((row: any) => {
      if (!row) return null;
      if (row.data && typeof row.data === 'object') {
        return { ...row, ...row.data } as T;
      }
      return row as T;
    })
    .filter(Boolean) as T[];
}

async function replaceCollection<T>(
  tableName: string,
  values: T[],
  idFor: (value: T) => string
) {
  const supabase = getSupabaseClient();

  if (values.length > 0) {
    const payloads = values.map((val) => ({
      id: idFor(val),
      data: clean(val),
      ...clean(val),
    }));

    for (let i = 0; i < payloads.length; i += 100) {
      const chunk = payloads.slice(i, i + 100);
      const { error: upsertError } = await supabase
        .from(tableName)
        .upsert(chunk);
      if (upsertError) {
        console.error(`Supabase upsert error on "${tableName}":`, upsertError);
        throw upsertError;
      }
    }
  }
}

export function getDatabaseId() {
  try {
    const url = new URL(process.env.SUPABASE_URL || '');
    return url.hostname.split('.')[0] || 'supabase';
  } catch {
    return 'supabase';
  }
}

export function ensureStaffDefaults(staffList: StaffMember[]): StaffMember[] {
  const list = [...(staffList || [])];
  const superAdminEmail = 'oseghale5432@gmail.com';
  const adminIndex = list.findIndex(s => s.email?.trim().toLowerCase() === superAdminEmail);

  if (adminIndex === -1) {
    list.push({
      email: superAdminEmail,
      name: 'Super Admin',
      department: 'MANAGEMENT',
      activity: 'SUPER ADMIN',
      label: 'Super Admin',
      isNew: false,
      role: 'admin',
      password: 'admin123',
      isFirstLogin: false,
    });
  } else {
    const admin = list[adminIndex];
    if (admin.name === 'Admin Boss') admin.name = 'Super Admin';
    if (!admin.label || admin.label.includes('Admin Boss')) admin.label = 'Super Admin';
    if (!admin.password) {
      admin.password = 'admin123';
      admin.isFirstLogin = false;
    }
  }
  return list;
}

export function recoverStaffFromReportsAndTasks(
  staffList: StaffMember[],
  reports: MonthProgress[],
  tasks: YTDTask[]
): StaffMember[] {
  const staffMap = new Map<string, StaffMember>();

  // 1. Add all existing staff profiles
  (staffList || []).forEach((s) => {
    if (s && s.email) {
      staffMap.set(s.email.trim().toLowerCase(), {
        ...s,
        email: s.email.trim().toLowerCase(),
      });
    }
  });

  // 2. Auto-recover staff emails & activities from progress reports
  (reports || []).forEach((r) => {
    if (r && r.staffEmail) {
      const email = r.staffEmail.trim().toLowerCase();
      if (!staffMap.has(email)) {
        const rawName = email.split('@')[0].replace(/[._-]/g, ' ');
        const derivedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        staffMap.set(email, {
          email,
          name: derivedName,
          department: 'STAFF',
          activity: r.activity || 'Staff Member',
          label: `${derivedName} (STAFF)`,
          isNew: false,
          role: 'staff',
          isFirstLogin: false,
        });
      }
    }
  });

  // 3. Auto-recover lead departments from YTD tasks
  (tasks || []).forEach((t) => {
    if (t && t.lead) {
      const leadName = t.lead.trim();
      if (leadName) {
        const match = Array.from(staffMap.values()).find(
          (s) => s.name.toLowerCase() === leadName.toLowerCase()
        );
        if (match && t.department && match.department === 'STAFF') {
          match.department = t.department;
          match.label = `${match.name} (${t.department})`;
        }
      }
    }
  });

  return ensureStaffDefaults(Array.from(staffMap.values()));
}

export async function fetchWorkbook() {
  const workbook = await runWithFallback(
    async () => {
      const [ytdTasks, staff, progressReports] = await Promise.all([
        readCollection<YTDTask>('ytd_tasks'),
        readCollection<StaffMember>('staff'),
        readCollection<MonthProgress>('progress_reports'),
      ]);

      // If Supabase staff list has only Super Admin (length <= 1), pull from Google Sheets database backup!
      if (!staff || staff.length <= 1) {
        try {
          const sheetsWb = await googleSheets.fetchWorkbook();
          if (sheetsWb && Array.isArray(sheetsWb.staff) && sheetsWb.staff.length > 1) {
            console.log(`Restoring ${sheetsWb.staff.length} staff profiles from Google Sheets backup into Supabase...`);
            // Automatically populate restored staff back into Supabase database table!
            saveStaffProfiles(sheetsWb.staff).catch((e) => console.error('Failed to sync restored staff to Supabase:', e));
            return {
              ytdTasks: ytdTasks.length > 0 ? ytdTasks : sheetsWb.ytdTasks,
              staff: sheetsWb.staff,
              progressReports: progressReports.length > 0 ? progressReports : sheetsWb.progressReports,
            };
          }
        } catch (sheetsErr) {
          console.warn('Could not read Google Sheets fallback:', sheetsErr);
        }
      }

      const recalculatedTasks = ytdTasks.map((task) => ({
        ...task,
        daysRemaining: googleSheets.calculateDaysRemaining(task.dueDate),
      }));
      return { ytdTasks: recalculatedTasks, staff, progressReports };
    },
    () => googleSheets.fetchWorkbook()
  );

  const fullStaff = recoverStaffFromReportsAndTasks(
    workbook.staff,
    workbook.progressReports,
    workbook.ytdTasks
  );

  return {
    ...workbook,
    staff: fullStaff,
  };
}

export async function saveYTDTasks(tasks: YTDTask[]) {
  const recalculatedTasks = tasks.map((task) => ({
    ...task,
    daysRemaining: googleSheets.calculateDaysRemaining(task.dueDate),
  }));
  await runWithBackup(
    () => replaceCollection('ytd_tasks', recalculatedTasks, (task) => task.id),
    () => googleSheets.saveYTDTasks(recalculatedTasks)
  );
}

export async function saveStaffProfiles(staff: StaffMember[]) {
  await runWithBackup(
    () => replaceCollection(
      'staff',
      staff.map((member) => ({ ...member, email: member.email.trim().toLowerCase() })),
      (member) => member.email
    ),
    () => googleSheets.saveStaffProfiles(staff)
  );
}

export async function saveProgressReports(reports: MonthProgress[]) {
  await runWithBackup(
    () => replaceCollection('progress_reports', reports, (report) => report.id),
    () => googleSheets.saveProgressReports(reports)
  );
}

export async function fetchPayments(): Promise<PaymentRequest[]> {
  return runWithFallback(
    () => readCollection<PaymentRequest>('payments'),
    () => googleSheets.fetchPayments()
  );
}

export async function savePayments(payments: PaymentRequest[]) {
  await runWithBackup(
    () => replaceCollection('payments', payments, (payment) => payment.id),
    () => googleSheets.savePayments(payments)
  );
}

export async function savePushToken(email: string, token: string) {
  const normalizedEmail = email.trim().toLowerCase();
  await runWithBackup(
    async () => {
      const { error } = await getSupabaseClient()
        .from('push_tokens')
        .upsert({
          id: normalizedEmail,
          data: {
            email: normalizedEmail,
            token: token.trim(),
            updatedAt: new Date().toISOString(),
          },
        });
      if (error) throw error;
    },
    () => googleSheets.savePushToken(email, token)
  );
}

export async function getPushTokens() {
  return runWithFallback(
    async () => {
      const tokens = await readCollection<{ email: string; token: string }>('push_tokens');
      return tokens.filter((entry) => entry.email && entry.token);
    },
    () => googleSheets.getPushTokens()
  );
}

export function sanitizeStaff(staff: StaffMember[]) {
  return staff.map(({ password, ...safeStaff }) => safeStaff);
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  return runWithFallback(
    () => readCollection<AppNotification>('notifications'),
    () => googleSheets.fetchNotifications()
  );
}

export async function addNotification(notification: AppNotification) {
  await runWithBackup(
    async () => {
      const { error } = await getSupabaseClient()
        .from('notifications')
        .upsert({
          id: notification.id,
          data: clean(notification),
        });
      if (error) throw error;
    },
    () => googleSheets.addNotification(notification)
  );
}

export async function markNotificationAsRead(id: string) {
  await runWithBackup(
    async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('notifications')
        .select('data')
        .eq('id', id)
        .single();
      if (error) throw error;
      if (data) {
        const updated = { ...(data.data as AppNotification), isRead: true };
        const { error: updateError } = await supabase
          .from('notifications')
          .upsert({ id, data: updated });
        if (updateError) throw updateError;
      }
    },
    () => googleSheets.markNotificationAsRead(id)
  );
}

export async function markAllNotificationsAsRead(userEmail: string, isAdmin: boolean, isAccounts: boolean) {
  await runWithBackup(
    async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('notifications')
        .select('*');
      if (error) throw error;
      if (!data) return;

      const updates = [];
      for (const row of data) {
        const notif = row.data as AppNotification;
        const isRecipient =
          !notif.recipientEmail ||
          notif.recipientEmail === 'all' ||
          (notif.recipientEmail === 'admin' && isAdmin) ||
          (notif.recipientEmail === 'accounts' && isAccounts) ||
          notif.recipientEmail.toLowerCase() === userEmail.toLowerCase();
        if (isRecipient && !notif.isRead) {
          updates.push({
            id: row.id,
            data: { ...notif, isRead: true },
          });
        }
      }
      if (updates.length > 0) {
        const { error: updateError } = await supabase
          .from('notifications')
          .upsert(updates);
        if (updateError) throw updateError;
      }
    },
    () => googleSheets.markAllNotificationsAsRead(userEmail, isAdmin, isAccounts)
  );
}
