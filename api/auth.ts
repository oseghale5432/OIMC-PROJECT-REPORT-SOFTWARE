import { readJson, sendJson, sessionCookie, clearSessionCookie, type ApiRequest, type ApiResponse } from '../server/http';
import { createSession, verifyPassword, isHashedPassword, hashPassword } from '../server/security';
import { fetchWorkbook, saveStaffProfiles, sanitizeStaff } from '../server/googleSheets';

function actionName(req: ApiRequest) {
  const url = (req as any).url || '';
  const headers = (req.headers || {}) as Record<string, string | string[]>;
  try {
    const parsed = new URL(url, 'http://localhost');
    return (
      String(parsed.searchParams.get('action') || '') ||
      String(headers['x-action'] || '')
    ).toLowerCase();
  } catch {
    const headers = (req.headers || {}) as Record<string, string | string[]>;
    return String(headers['x-action'] || '').toLowerCase();
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const action = actionName(req).toLowerCase();

  if (action === 'login') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
    try {
      const { email: rawEmail, password } = await readJson(req) as any;
      const email = rawEmail?.trim().toLowerCase();
      if (!email || !password) return sendJson(res, 400, { error: 'Email and password are required.' });

      const workbook = await fetchWorkbook();
      const staff = workbook.staff.find((s) => s.email.toLowerCase() === email);
      if (!staff) return sendJson(res, 401, { error: 'This email address is not registered.' });
      if (!verifyPassword(password, staff.password)) return sendJson(res, 401, { error: 'The password you entered is incorrect.' });

      const requiresPasswordChange = staff.isFirstLogin || !isHashedPassword(staff.password);
      if (requiresPasswordChange) {
        return sendJson(res, 200, {
          requiresPasswordChange: true,
          staff: sanitizeStaff([staff])[0],
        });
      }

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
          ...workbook,
          staff: sanitizeStaff(workbook.staff),
        },
      });
    } catch (error: any) {
      return sendJson(res, 500, { error: error.message || 'Login failed.' });
    }
  }

  if (action === 'logout') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
    res.setHeader('Set-Cookie', clearSessionCookie());
    return sendJson(res, 200, { ok: true });
  }

  if (action === 'me') {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
    const user = { ok: true };
    return sendJson(res, 200, user);
  }

  if (action === 'reset-password') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
    try {
      const { email: rawEmail, name: rawName, newPassword } = await readJson(req) as any;
      const email = rawEmail?.trim().toLowerCase();
      const name = rawName?.trim().toLowerCase();
      if (!email || !name || !newPassword) return sendJson(res, 400, { error: 'All reset fields are required.' });
      if (newPassword.length < 6) return sendJson(res, 400, { error: 'Your new password must be at least 6 characters long.' });

      const workbook = await fetchWorkbook();
      const staff = workbook.staff.find((s) => s.email.toLowerCase() === email);
      if (!staff) return sendJson(res, 404, { error: 'Email address is not registered.' });
      if (staff.name.trim().toLowerCase() !== name) return sendJson(res, 401, { error: 'The registered employee name does not match.' });

      const updatedStaff = workbook.staff.map((s) =>
        s.email.toLowerCase() === email
          ? { ...s, password: hashPassword(newPassword), isFirstLogin: false }
          : s
      );
      await saveStaffProfiles(updatedStaff as any);

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
          ...workbook,
          staff: sanitizeStaff(updatedStaff as any),
        },
      });
    } catch (error: any) {
      return sendJson(res, 500, { error: error.message || 'Password reset failed.' });
    }
  }

  if (action === 'change-password') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
    try {
      const body = await readJson(req) as any;
      if (!body.newPassword || body.newPassword.length < 6) {
        return sendJson(res, 400, { error: 'Your new password must be at least 6 characters long.' });
      }

      const targetEmail = (body.email || '').trim().toLowerCase();
      if (!targetEmail) return sendJson(res, 400, { error: 'Email is required.' });

      const workbook = await fetchWorkbook();
      const staff = workbook.staff.find((s) => s.email.toLowerCase() === targetEmail);
      if (!staff) return sendJson(res, 404, { error: 'Staff account not found.' });

      if (!verifyPassword(body.currentPassword || '', staff.password)) {
        return sendJson(res, 401, { error: 'Current password could not be verified.' });
      }

      const updatedStaff = workbook.staff.map((s) =>
        s.email.toLowerCase() === targetEmail
          ? { ...s, password: hashPassword(body.newPassword), isFirstLogin: false }
          : s
      );
      await saveStaffProfiles(updatedStaff as any);

      const refreshed = await fetchWorkbook();
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
          ytdTasks: refreshed.ytdTasks,
          staff: sanitizeStaff(updatedStaff as any),
          progressReports: refreshed.progressReports,
        },
      });
    } catch (error: any) {
      return sendJson(res, 500, { error: error.message || 'Password change failed.' });
    }
  }

  return sendJson(res, 404, { error: 'Not found' });
}
