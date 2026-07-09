import * as crypto from 'crypto';

const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

type SessionUser = {
  email: string;
  displayName: string;
  role: 'admin' | 'staff';
  uid: string;
};

type PaymentStatus = 'Pending Approval' | 'Approved for Processing' | 'Rejected' | 'Payment Made';
type PaymentRequest = {
  id: string;
  code: string;
  payment: string;
  description: string;
  amount: number;
  requestedByEmail: string;
  requestedByName: string;
  status: PaymentStatus;
  submittedAt: string;
  updatedAt: string;
  updatedBy: string;
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
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function getCookie(req: any, name: string) {
  const header = req.headers?.cookie || '';
  const match = header.split(';').map((part: string) => part.trim()).find((part: string) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function getSessionUser(req: any): SessionUser | null {
  const token = getCookie(req, 'oi_session');
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = base64url(crypto.createHmac('sha256', requireEnv('SESSION_SECRET')).update(payload).digest());
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
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

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({
    iss: requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }))}`;
  const signature = crypto.createSign('RSA-SHA256')
    .update(unsigned)
    .sign(requireEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n'), 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!response.ok) throw new Error(`Google authorization failed: ${await response.text()}`);
  return (await response.json()).access_token as string;
}

async function sheetsFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE}/${requireEnv('GOOGLE_SHEETS_SPREADSHEET_ID')}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Google Sheets request failed: ${await response.text()}`);
  return response.json();
}

async function ensurePaymentsSheet() {
  const metadata = await sheetsFetch('?fields=sheets.properties.title');
  const exists = (metadata.sheets || []).some((sheet: any) => sheet.properties?.title === 'Payments');
  if (!exists) {
    await sheetsFetch(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Payments' } } }] }),
    });
  }
}

async function fetchStaff() {
  const data = await sheetsFetch(`/values/${encodeURIComponent('Staff_Profiles!A1:I500')}`);
  return (data.values || []).slice(1).filter((row: string[]) => row[0]).map((row: string[]) => ({
    email: row[0],
    name: row[1] || '',
    department: row[2] || '',
  }));
}

async function fetchPayments(): Promise<PaymentRequest[]> {
  await ensurePaymentsSheet();
  const data = await sheetsFetch(`/values/${encodeURIComponent('Payments!A1:K5000')}`);
  return (data.values || []).slice(1).filter((row: string[]) => row[0]).map((row: string[]) => ({
    id: row[0],
    code: row[1] || '',
    payment: row[2] || '',
    description: row[3] || '',
    amount: Number(row[4] || 0),
    requestedByEmail: row[5] || '',
    requestedByName: row[6] || '',
    status: (row[7] || 'Pending Approval') as PaymentStatus,
    submittedAt: row[8] || '',
    updatedAt: row[9] || '',
    updatedBy: row[10] || '',
  }));
}

async function savePayments(payments: PaymentRequest[]) {
  const headers = ['Request ID', 'Code', 'Payment', 'Description', 'Amount', 'Requested By Email', 'Requested By Name', 'Status', 'Submitted At', 'Updated At', 'Updated By'];
  const rows = payments.map((item) => [
    item.id, item.code, item.payment, item.description, String(item.amount),
    item.requestedByEmail, item.requestedByName, item.status,
    item.submittedAt, item.updatedAt, item.updatedBy,
  ]);
  await sheetsFetch(`/values/${encodeURIComponent('Payments!A1:K')}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [headers, ...rows] }),
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: 'Your session expired. Please sign in again.' });
    const staff = await fetchStaff();
    const profile = staff.find((item: any) => item.email.toLowerCase() === user.email.toLowerCase());
    const canApprove = user.role === 'admin'
      || user.email.toLowerCase() === 'oseghale5432@gmail.com';
    const canComplete = String(profile?.department || '').toUpperCase().includes('ACCOUNT');
    const canViewAll = canApprove || canComplete;
    let payments = await fetchPayments();

    if (req.method === 'POST') {
      const body = await readJson(req);
      if (body.action === 'create') {
        const code = String(body.payment?.code || '').trim();
        const payment = String(body.payment?.payment || '').trim();
        const description = String(body.payment?.description || '').trim();
        const amount = Number(body.payment?.amount);
        if (!code || !payment || !description || !Number.isFinite(amount) || amount <= 0) {
          return sendJson(res, 400, { error: 'Select a code and enter a description and valid amount.' });
        }
        const now = new Date().toISOString();
        payments.push({
          id: `PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          code, payment, description, amount,
          requestedByEmail: user.email,
          requestedByName: profile?.name || user.displayName || user.email,
          status: 'Pending Approval',
          submittedAt: now,
          updatedAt: now,
          updatedBy: user.email,
        });
        await savePayments(payments);
      } else if (body.action === 'updateStatus') {
        const index = payments.findIndex((item) => item.id === body.id);
        if (index < 0) return sendJson(res, 404, { error: 'Payment request not found.' });
        const next = body.status as PaymentStatus;
        const current = payments[index].status;
        const valid = (canApprove && current === 'Pending Approval'
          && (next === 'Approved for Processing' || next === 'Rejected'))
          || (canComplete && current === 'Approved for Processing' && next === 'Payment Made');
        if (!canApprove && current === 'Pending Approval') {
          return sendJson(res, 403, { error: 'Only an administrator can approve or reject this request.' });
        }
        if (!canComplete && next === 'Payment Made') {
          return sendJson(res, 403, { error: 'Only a user in the Accounts department can mark payment as completed.' });
        }
        if (!valid) return sendJson(res, 400, { error: `Cannot change ${current} to ${next}.` });
        payments[index] = { ...payments[index], status: next, updatedAt: new Date().toISOString(), updatedBy: user.email };
        await savePayments(payments);
      } else {
        return sendJson(res, 400, { error: 'Invalid payment action.' });
      }
    }

    const visible = canViewAll ? payments : payments.filter((item) => item.requestedByEmail.toLowerCase() === user.email.toLowerCase());
    return sendJson(res, 200, { payments: visible, canApprove, canComplete });
  } catch (error: any) {
    console.error('Payments API error:', error);
    return sendJson(res, 500, { error: error.message || 'Could not load payment requests.' });
  }
}
