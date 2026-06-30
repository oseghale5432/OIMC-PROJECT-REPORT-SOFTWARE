import * as crypto from 'crypto';

const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

type SessionUser = {
  email: string;
  displayName: string;
  role: 'admin' | 'staff';
  uid: string;
};

type StaffMember = {
  email: string;
  name: string;
  department: string;
  activity: string;
  label: string;
  isNew: boolean;
  role?: 'admin' | 'staff';
  password?: string;
  isFirstLogin?: boolean;
};

type YTDTask = {
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
};

type TaskItem = {
  description: string;
  completed: boolean | null;
  ytdTaskId?: string;
};

type MonthProgress = {
  id: string;
  staffEmail: string;
  month: string;
  activity: string;
  tasks: TaskItem[];
};

function sendJson(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function readJson(req: any) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (!req.body) return {};
  return JSON.parse(req.body);
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getCookie(req: any, name: string) {
  const header = req.headers?.cookie || '';
  const parts = header.split(';').map((part: string) => part.trim());
  const match = parts.find((part: string) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

function timingSafeEqualText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifySessionToken(token: string): SessionUser | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = base64url(
    crypto.createHmac('sha256', requireEnv('SESSION_SECRET')).update(payload).digest()
  );
  if (!timingSafeEqualText(signature, expected)) return null;
  try {
    const decoded = JSON.parse(fromBase64url(payload).toString('utf8'));
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      email: decoded.email,
      displayName: decoded.displayName,
      role: decoded.role === 'admin' ? 'admin' : 'staff',
      uid: decoded.uid,
    };
  } catch {
    return null;
  }
}

function getSessionUser(req: any): SessionUser | null {
  const token = getCookie(req, 'oi_session');
  return token ? verifySessionToken(token) : null;
}

function isAdmin(user: SessionUser) {
  return user.role === 'admin' || user.email.toLowerCase() === 'oseghale5432@gmail.com';
}

async function getServiceAccountAccessToken() {
  const email = requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = requireEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const unsignedJwt = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  )}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsignedJwt)
    .sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsignedJwt}.${signature}`,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Google service account auth failed: ${await tokenRes.text()}`);
  const tokenData = await tokenRes.json();
  return tokenData.access_token as string;
}

async function sheetsFetch(path: string, init: RequestInit = {}) {
  const spreadsheetId = requireEnv('GOOGLE_SHEETS_SPREADSHEET_ID');
  const token = await getServiceAccountAccessToken();
  const res = await fetch(`${API_BASE}/${spreadsheetId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Google Sheets request failed: ${await res.text()}`);
  return res.json();
}

async function updateRange(range: string, values: string[][]) {
  await sheetsFetch(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values }),
  });
}

async function fetchWorkbook() {
  const ranges = ['YTD_Tasks!A1:K200', 'Staff_Profiles!A1:I500', 'Progress_Reports!A1:AH5000'];
  const query = ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&');
  const data = await sheetsFetch(`/values:batchGet?${query}`);
  const valueRanges = data.valueRanges || [];
  return {
    ytdTasks: parseYTDTasks(valueRanges[0]?.values || []),
    staff: parseStaff(valueRanges[1]?.values || []),
    progressReports: parseProgressReports(valueRanges[2]?.values || []),
    spreadsheetId: requireEnv('GOOGLE_SHEETS_SPREADSHEET_ID'),
  };
}

async function saveYTDTasks(tasks: YTDTask[]) {
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

async function saveProgressReports(reports: MonthProgress[]) {
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
      const match = description.match(/^\[YTD:([^\]]+)\](.*)/);
      const ytdTaskId = match?.[1];
      if (match) description = match[2];
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

function sanitizeStaff(staff: StaffMember[]) {
  return staff.map(({ password, ...safeStaff }) => safeStaff);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: 'Not signed in.' });

    const body = await readJson(req);
    const targetEmail = body.email?.trim().toLowerCase();
    if (!targetEmail || !Array.isArray(body.reports)) return sendJson(res, 400, { error: 'Invalid progress payload.' });
    if (!isAdmin(user) && user.email.toLowerCase() !== targetEmail) {
      return sendJson(res, 403, { error: 'You can only edit your own workbook.' });
    }

    const workbook = await fetchWorkbook();
    const existingReportIds = new Set(workbook.progressReports.map((report) => report.id));
    const updatedReports = workbook.progressReports.map((report) => {
      const replacement = body.reports.find((r: MonthProgress) =>
        r.id === report.id && r.staffEmail.toLowerCase() === targetEmail
      );
      return replacement || report;
    }).concat(
      body.reports.filter((report: MonthProgress) =>
        report.staffEmail.toLowerCase() === targetEmail && !existingReportIds.has(report.id)
      )
    );

    let updatedTasks = workbook.ytdTasks;
    if (body.ytdTasks) {
      if (isAdmin(user)) {
        updatedTasks = body.ytdTasks;
      } else {
        updatedTasks = workbook.ytdTasks.map((task) => {
          const replacement = body.ytdTasks?.find((t: YTDTask) => t.id === task.id);
          return replacement ? { ...task, status: replacement.status, remark: replacement.remark } : task;
        });
      }
      await saveYTDTasks(updatedTasks);
    }

    await saveProgressReports(updatedReports);

    return sendJson(res, 200, {
      ytdTasks: updatedTasks,
      staff: sanitizeStaff(workbook.staff),
      progressReports: updatedReports,
      spreadsheetId: requireEnv('GOOGLE_SHEETS_SPREADSHEET_ID'),
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Failed to save progress.' });
  }
}
