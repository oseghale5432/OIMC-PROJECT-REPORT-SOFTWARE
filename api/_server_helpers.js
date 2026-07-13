import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export async function readJson(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (!req.body) return {};
  return JSON.parse(req.body);
}

export function sendJson(res, status, data) {
  res.statusCode = status;
  if (typeof res.status === 'function') res.status(status);
  res.setHeader('Content-Type', 'application/json');
  if (typeof res.json === 'function') return res.json(data);
  const body = JSON.stringify(data);
  if (typeof res.send === 'function') return res.send(body);
  if (typeof res.end === 'function') return res.end(body);
}

export function methodNotAllowed(res) {
  sendJson(res, 405, { error: 'Method not allowed' });
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getCookie(req, name) {
  const headerValue = req.headers && req.headers.cookie;
  const header = Array.isArray(headerValue) ? headerValue.join(';') : headerValue;
  if (!header) return null;
  const cookies = header.split(';').map((p) => p.trim());
  const match = cookies.find((p) => p.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function sessionCookie(value, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `oi_session=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `oi_session=; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=0`;
}

// security helpers
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const HASH_ITERATIONS = 120000;

function base64url_buf(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

function timingSafeEqualText(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, 32, 'sha256').toString('hex');
  return `pbkdf2$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password, storedPassword) {
  if (!storedPassword) return password === 'password123';
  if (!storedPassword.startsWith('pbkdf2$')) return timingSafeEqualText(password, storedPassword);
  const [, iterationsRaw, salt, expectedHash] = storedPassword.split('$');
  const iterations = Number(iterationsRaw);
  if (!iterations || !salt || !expectedHash) return false;
  const actualHash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
  return timingSafeEqualText(actualHash, expectedHash);
}

export function isHashedPassword(value) {
  return !!value && value.startsWith('pbkdf2$');
}

export function createSession(user) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = base64url_buf(JSON.stringify({ ...user, exp: expiresAt }));
  const signature = base64url_buf(crypto.createHmac('sha256', requireEnv('SESSION_SECRET')).update(payload).digest());
  return { token: `${payload}.${signature}`, maxAgeSeconds: SESSION_TTL_SECONDS };
}

export function verifySessionToken(token) {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = base64url_buf(crypto.createHmac('sha256', requireEnv('SESSION_SECRET')).update(payload).digest());
  if (!timingSafeEqualText(signature, expected)) return null;
  try {
    const decoded = JSON.parse(fromBase64url(payload).toString('utf8'));
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return { email: decoded.email, displayName: decoded.displayName, role: decoded.role === 'admin' ? 'admin' : 'staff', uid: decoded.uid };
  } catch (e) {
    return null;
  }
}

export function getSessionUser(req) {
  const token = getCookie(req, 'oi_session');
  return token ? verifySessionToken(token) : null;
}

export function isAdmin(user) {
  return user && (user.role === 'admin' || (user.email && String(user.email).toLowerCase() === 'oseghale5432@gmail.com'));
}

// Google Sheets helpers (minimal)
const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
let cachedToken = null;

async function getServiceAccountAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.value;
  const email = requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const rawPrivateKey = requireEnv('GOOGLE_PRIVATE_KEY');
  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url_buf(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url_buf(JSON.stringify({ iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now }));
  const unsignedJwt = `${header}.${claim}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsignedJwt).sign(privateKey, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsignedJwt}.${signature}` }) });
  if (!res.ok) throw new Error(`Google service account auth failed: ${await res.text()}`);
  const data = await res.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

export function getSpreadsheetId() { return requireEnv('GOOGLE_SHEETS_SPREADSHEET_ID'); }

async function sheetsFetch(pathSuffix, init = {}) {
  const token = await getServiceAccountAccessToken();
  const res = await fetch(`${API_BASE}/${getSpreadsheetId()}${pathSuffix}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`Google Sheets request failed: ${await res.text()}`);
  return res.json();
}

async function updateRange(range, values) {
  await sheetsFetch(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values }) });
}

async function ensureSheet(title) {
  const metadata = await sheetsFetch('?fields=sheets.properties.title');
  const exists = (metadata.sheets || []).some((sheet) => sheet.properties?.title === title);
  if (!exists) await sheetsFetch(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }) });
}

export async function savePushToken(email, token) {
  await ensureSheet('Push_Tokens');
  const existing = await sheetsFetch(`/values/${encodeURIComponent('Push_Tokens!A1:B5000')}`);
  const rows = existing.values || [];
  const header = rows[0] || ['Email', 'Push Token'];
  const bodyRows = rows.slice(1);
  const normalizedEmail = email.trim().toLowerCase();
  const updatedRows = bodyRows.filter((row) => row[0]?.toLowerCase() !== normalizedEmail);
  updatedRows.push([normalizedEmail, token]);
  await updateRange('Push_Tokens!A1:B', [header, ...updatedRows]);
}

export async function getPushTokens() {
  await ensureSheet('Push_Tokens');
  const data = await sheetsFetch(`/values/${encodeURIComponent('Push_Tokens!A1:B5000')}`);
  const rows = data.values || [];
  const result = [];
  for (const row of rows.slice(1)) {
    const email = row[0] || '';
    const token = row[1] || '';
    if (email && token) result.push({ email: email.trim().toLowerCase(), token: token.trim() });
  }
  return result;
}

export async function fetchWorkbook() {
  const ranges = ['YTD_Tasks!A1:K200', 'Staff_Profiles!A1:I500', 'Progress_Reports!A1:AH5000'];
  const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  const data = await sheetsFetch(`/values:batchGet?${query}`);
  const valueRanges = data.valueRanges || [];
  return { ytdTasks: parseYTDTasks(valueRanges[0]?.values || []), staff: parseStaff(valueRanges[1]?.values || []), progressReports: parseProgressReports(valueRanges[2]?.values || []) };
}

export async function saveStaffProfiles(staff) {
  const headers = ['Email','Name','Department','Activity','Label','Is New (TRUE/FALSE)','Role (admin/staff)','Password Hash','Is First Login (TRUE/FALSE)'];
  const rows = staff.map((s) => [s.email,s.name,s.department,s.activity,s.label,s.isNew ? 'TRUE' : 'FALSE',s.role || 'staff',s.password || '',s.isFirstLogin === false ? 'FALSE' : 'TRUE']);
  await updateRange('Staff_Profiles!A1:I', [headers, ...rows]);
}

function parseYTDTasks(raw) { return raw.slice(1).filter((row) => row[0]).map((row) => ({ id: row[0], department: row[1] || '', lead: row[2] || '', coWorker: row[3] || '', contractorHead: row[4] || '', description: row[5] || '', startDate: row[6] || '', dueDate: row[7] || '', daysRemaining: parseInt(row[8] || '0', 10), status: row[9] || '', remark: row[10] || '' })); }

function parseStaff(raw) { return raw.slice(1).filter((row) => row[0]).map((row) => ({ email: row[0], name: row[1] || '', department: row[2] || '', activity: row[3] || '', label: row[4] || `${row[1] || row[0]} (${row[2] || 'Staff'})`, isNew: row[5] === 'TRUE', role: row[6] === 'admin' ? 'admin' : 'staff', password: row[7] || '', isFirstLogin: row[8] !== 'FALSE' })); }

function parseProgressReports(raw) {
  return raw.slice(1).filter((row) => row[0] && row[1]).map((row) => {
    const tasks = [];
    for (let i = 0; i < 15; i++) {
      let description = row[4 + i] || '';
      const completedRaw = row[19 + i] || '';
      let completed = null;
      if (completedRaw === '1') completed = true;
      if (completedRaw === '0') completed = false;
      let ytdTaskId;
      const match = description.match(/^\[YTD:([^\]]+)\](.*)/);
      if (match) { ytdTaskId = match[1]; description = match[2]; }
      tasks.push({ description, completed, ytdTaskId });
    }
    return { id: row[0], staffEmail: row[1], month: row[2] || '', activity: row[3] || '', tasks };
  });
}

export function sanitizeStaff(staff) { return staff.map(({ password, ...safeStaff }) => safeStaff); }

function getServiceAccountEmail() { const value = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL; if (!value) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL'); return value; }
function getPrivateKey() { const value = process.env.GOOGLE_PRIVATE_KEY; if (!value) throw new Error('Missing GOOGLE_PRIVATE_KEY'); return value.replace(/\\n/g, '\n'); }
function getProjectId() { if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID; const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json'); if (fs.existsSync(configPath)) { const config = JSON.parse(fs.readFileSync(configPath, 'utf8')); if (config.projectId) return config.projectId; } throw new Error('Missing FIREBASE_PROJECT_ID environment variable and unable to read firebase-applet-config.json.'); }

async function getGoogleAccessToken(scopes) { const now = Math.floor(Date.now() / 1000); const header = base64url_buf(JSON.stringify({ alg: 'RS256', typ: 'JWT' })); const claim = base64url_buf(JSON.stringify({ iss: getServiceAccountEmail(), scope: scopes.join(' '), aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now })); const unsignedJwt = `${header}.${claim}`; const signature = crypto.createSign('RSA-SHA256').update(unsignedJwt).sign(getPrivateKey(), 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsignedJwt}.${signature}` }) }); if (!response.ok) throw new Error(`Google auth failed: ${await response.text()}`); const data = await response.json(); return data.access_token; }

export async function sendFcmMessage(deviceToken, title, body, data = {}) { const accessToken = await getGoogleAccessToken(['https://www.googleapis.com/auth/firebase.messaging']); const projectId = getProjectId(); const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { token: deviceToken, notification: { title, body }, webpush: { headers: { Urgency: 'high' }, notification: { icon: '/assets/orange-island-logo.png' }, data } } }) }); if (!response.ok) throw new Error(`FCM request failed: ${await response.text()}`); return await response.json(); }
