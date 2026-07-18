import { requireEnv } from './http';
import type { MonthProgress, PaymentRequest, StaffMember, TaskItem, YTDTask } from './types';

const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
let cachedToken: { value: string; expiresAt: number } | null = null;
const RETRY_DELAYS_MS = [1000, 2500, 5000, 10000];

function isRetryableNetworkError(error: any) {
  const code = error?.cause?.code || error?.code;
  return (
    error instanceof TypeError ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'EAI_AGAIN'
  );
}

async function fetchWithRetry(url: string, init: RequestInit = {}) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.status < 500 || attempt === RETRY_DELAYS_MS.length) return response;
      lastError = new Error(`Google API temporarily returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error) || attempt === RETRY_DELAYS_MS.length) throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }

  throw lastError;
}

function base64url(input: string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getServiceAccountAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.value;
  }

  const email = requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const rawPrivateKey = requireEnv('GOOGLE_PRIVATE_KEY');
  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  );
  const unsignedJwt = `${header}.${claim}`;

  const crypto = await import('crypto');
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsignedJwt)
    .sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const res = await fetchWithRetry('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsignedJwt}.${signature}`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google service account auth failed: ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.value;
}

export function getSpreadsheetId() {
  return requireEnv('GOOGLE_SHEETS_SPREADSHEET_ID');
}

async function sheetsFetch(path: string, init: RequestInit = {}) {
  const token = await getServiceAccountAccessToken();
  const res = await fetchWithRetry(`${API_BASE}/${getSpreadsheetId()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Google Sheets request failed: ${await res.text()}`);
  }

  return res.json();
}

async function updateRange(range: string, values: string[][]) {
  await sheetsFetch(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values }),
  });
}

async function ensureSheet(title: string) {
  const metadata = await sheetsFetch('?fields=sheets.properties.title');
  const exists = (metadata.sheets || []).some((sheet: any) => sheet.properties?.title === title);
  if (!exists) {
    await sheetsFetch(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    });
  }
}

export async function savePushToken(email: string, token: string) {
  await ensureSheet('Push_Tokens');

  const existing = await sheetsFetch(`/values/${encodeURIComponent('Push_Tokens!A1:B5000')}`);
  const rows: string[][] = existing.values || [];
  const header = rows[0] || ['Email', 'Push Token'];
  const bodyRows = rows.slice(1);

  const normalizedEmail = email.trim().toLowerCase();
  const updatedRows = bodyRows.filter((row: string[]) => row[0]?.toLowerCase() !== normalizedEmail);
  updatedRows.push([normalizedEmail, token]);

  await updateRange('Push_Tokens!A1:B', [header, ...updatedRows]);
}

export async function getPushTokens() {
  await ensureSheet('Push_Tokens');
  const data = await sheetsFetch(`/values/${encodeURIComponent('Push_Tokens!A1:B5000')}`);
  const rows: string[][] = data.values || [];
  const result: Array<{ email: string; token: string }> = [];

  for (const row of rows.slice(1)) {
    const email = row[0] || '';
    const token = row[1] || '';
    if (email && token) {
      result.push({ email: email.trim().toLowerCase(), token: token.trim() });
    }
  }

  return result;
}

export async function fetchPayments(): Promise<PaymentRequest[]> {
  await ensureSheet('Payments');
  const data = await sheetsFetch(`/values/${encodeURIComponent('Payments!A1:L5000')}`);
  return parsePayments(data.values || []);
}

export async function savePayments(payments: PaymentRequest[]) {
  await ensureSheet('Payments');
  const headers = [
    'Request ID', 'Code', 'Payment', 'Description', 'Amount',
    'Requested By Email', 'Requested By Name', 'Status',
    'Submitted At', 'Updated At', 'Updated By', 'Reserved',
  ];
  const rows = payments.map((payment) => [
    payment.id,
    payment.code,
    payment.payment,
    payment.description,
    String(payment.amount),
    payment.requestedByEmail,
    payment.requestedByName,
    payment.status,
    payment.submittedAt,
    payment.updatedAt,
    payment.updatedBy,
    '',
  ]);
  await updateRange('Payments!A1:L', [headers, ...rows]);
}

function parsePayments(raw: string[][]): PaymentRequest[] {
  return raw.slice(1).filter((row) => row[0]).map((row) => ({
    id: row[0],
    code: row[1] || '',
    payment: row[2] || '',
    description: row[3] || '',
    amount: Number(row[4] || 0),
    requestedByEmail: row[5] || '',
    requestedByName: row[6] || '',
    status: (row[7] || 'Pending Approval') as PaymentRequest['status'],
    submittedAt: row[8] || '',
    updatedAt: row[9] || '',
    updatedBy: row[10] || '',
  }));
}

export async function fetchWorkbook() {
  const ranges = ['YTD_Tasks!A1:K200', 'Staff_Profiles!A1:I500', 'Progress_Reports!A1:AH5000'];
  const query = ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&');
  const data = await sheetsFetch(`/values:batchGet?${query}`);
  const valueRanges = data.valueRanges || [];

  return {
    ytdTasks: parseYTDTasks(valueRanges[0]?.values || []),
    staff: parseStaff(valueRanges[1]?.values || []),
    progressReports: parseProgressReports(valueRanges[2]?.values || []),
  };
}

export async function saveYTDTasks(tasks: YTDTask[]) {
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
    String(t.daysRemaining),
    t.status,
    t.remark,
  ]);

  await updateRange('YTD_Tasks!A1:K', [headers, ...rows]);
}

export async function saveStaffProfiles(staff: StaffMember[]) {
  const headers = [
    'Email',
    'Name',
    'Department',
    'Activity',
    'Label',
    'Is New (TRUE/FALSE)',
    'Role (admin/staff)',
    'Password Hash',
    'Is First Login (TRUE/FALSE)',
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

  await updateRange('Staff_Profiles!A1:I', [headers, ...rows]);
}

export async function saveProgressReports(reports: MonthProgress[]) {
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
    for (let i = 0; i < 15; i++) {
      const task = r.tasks[i];
      const prefix = task?.ytdTaskId ? `[YTD:${task.ytdTaskId}]` : '';
      row.push(task ? `${prefix}${task.description}` : '');
    }
    for (let i = 0; i < 15; i++) {
      const completed = r.tasks[i]?.completed;
      row.push(completed === true ? '1' : completed === false ? '0' : '-1');
    }
    return row;
  });

  await updateRange('Progress_Reports!A1:AH', [headers, ...rows]);
}

function parseYTDTasks(raw: string[][]): YTDTask[] {
  return raw.slice(1).filter((row) => row[0]).map((row) => ({
    id: row[0],
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
  }));
}

function parseStaff(raw: string[][]): StaffMember[] {
  return raw.slice(1).filter((row) => row[0]).map((row) => ({
    email: row[0],
    name: row[1] || '',
    department: row[2] || '',
    activity: row[3] || '',
    label: row[4] || `${row[1] || row[0]} (${row[2] || 'Staff'})`,
    isNew: row[5] === 'TRUE',
    role: row[6] === 'admin' ? 'admin' : 'staff',
    password: row[7] || '',
    isFirstLogin: row[8] !== 'FALSE',
  }));
}

function parseProgressReports(raw: string[][]): MonthProgress[] {
  return raw.slice(1).filter((row) => row[0] && row[1]).map((row) => {
    const tasks: TaskItem[] = [];
    for (let i = 0; i < 15; i++) {
      let description = row[4 + i] || '';
      const completedRaw = row[19 + i] || '';
      let completed: boolean | null = null;
      if (completedRaw === '1') completed = true;
      if (completedRaw === '0') completed = false;

      let ytdTaskId: string | undefined;
      const match = description.match(/^\[YTD:([^\]]+)\](.*)/);
      if (match) {
        ytdTaskId = match[1];
        description = match[2];
      }

      tasks.push({ description, completed, ytdTaskId });
    }

    return {
      id: row[0],
      staffEmail: row[1],
      month: row[2] || '',
      activity: row[3] || '',
      tasks,
    };
  });
}

export function sanitizeStaff(staff: StaffMember[]) {
  return staff.map(({ password, ...safeStaff }) => safeStaff);
}
