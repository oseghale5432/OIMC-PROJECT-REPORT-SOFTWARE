import * as crypto from 'crypto';

const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const HASH_ITERATIONS = 120000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

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

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function timingSafeEqualText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyPassword(password: string, storedPassword: string | undefined) {
  if (!storedPassword) return password === 'password123';
  if (!storedPassword.startsWith('pbkdf2$')) return timingSafeEqualText(password, storedPassword);

  const [, iterationsRaw, salt, expectedHash] = storedPassword.split('$');
  const iterations = Number(iterationsRaw);
  if (!iterations || !salt || !expectedHash) return false;

  const actualHash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
  return timingSafeEqualText(actualHash, expectedHash);
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, 32, 'sha256').toString('hex');
  return `pbkdf2$${HASH_ITERATIONS}$${salt}$${hash}`;
}

function createSession(user: { email: string; displayName: string; role: 'admin' | 'staff'; uid: string }) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = base64url(JSON.stringify({ ...user, exp: expiresAt }));
  const signature = base64url(
    crypto.createHmac('sha256', requireEnv('SESSION_SECRET')).update(payload).digest()
  );
  return {
    token: `${payload}.${signature}`,
    maxAgeSeconds: SESSION_TTL_SECONDS,
  };
}

function sessionCookie(value: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `oi_session=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${maxAgeSeconds}`;
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

async function fetchStaffProfiles() {
  const data = await sheetsFetch(`/values/${encodeURIComponent('Staff_Profiles!A1:I500')}`);
  return parseStaff(data.values || []);
}

async function saveStaffProfiles(staff: StaffMember[]) {
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

  await sheetsFetch(`/values/${encodeURIComponent('Staff_Profiles!A1:I')}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [headers, ...rows] }),
  });
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

function sanitizeStaff(staff: StaffMember[]) {
  return staff.map(({ password, ...safeStaff }) => safeStaff);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readJson(req);
    if (!body.newPassword || body.newPassword.length < 6) {
      return sendJson(res, 400, { error: 'Your new password must be at least 6 characters long.' });
    }

    const targetEmail = (body.email || '').trim().toLowerCase();
    if (!targetEmail) return sendJson(res, 400, { error: 'Email is required.' });

    const staffList = await fetchStaffProfiles();
    const staff = staffList.find((s) => s.email.toLowerCase() === targetEmail);
    if (!staff) return sendJson(res, 404, { error: 'Staff account not found.' });

    if (!verifyPassword(body.currentPassword || '', staff.password)) {
      return sendJson(res, 401, { error: 'Current password could not be verified.' });
    }

    const updatedStaff = staffList.map((s) =>
      s.email.toLowerCase() === targetEmail
        ? { ...s, password: hashPassword(body.newPassword), isFirstLogin: false }
        : s
    );
    await saveStaffProfiles(updatedStaff);

    const user = {
      email: staff.email,
      displayName: staff.name,
      role: staff.role || 'staff',
      uid: `local-${staff.email}`,
    };
    const session = createSession(user);
    res.setHeader('Set-Cookie', sessionCookie(session.token, session.maxAgeSeconds));
    return sendJson(res, 200, {
      user,
      workbook: {
        ytdTasks: [],
        staff: sanitizeStaff(updatedStaff),
        progressReports: [],
      },
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Password change failed.' });
  }
}
