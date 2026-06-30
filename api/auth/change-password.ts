import { readJson, sendJson, sessionCookie, type ApiRequest, type ApiResponse } from '../../server/http';
import { createSession, getSessionUser, hashPassword, verifyPassword } from '../../server/security';
import { fetchWorkbook, sanitizeStaff, saveStaffProfiles } from '../../server/googleSheets';
import type { SessionUser } from '../../server/types';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readJson<{ email?: string; currentPassword?: string; newPassword: string }>(req);
    if (!body.newPassword || body.newPassword.length < 6) {
      return sendJson(res, 400, { error: 'Your new password must be at least 6 characters long.' });
    }

    const workbook = await fetchWorkbook();
    const sessionUser = getSessionUser(req);
    const targetEmail = (body.email || sessionUser?.email || '').trim().toLowerCase();
    const staff = workbook.staff.find((s) => s.email.toLowerCase() === targetEmail);
    if (!staff) return sendJson(res, 404, { error: 'Staff account not found.' });

    if (!sessionUser && !verifyPassword(body.currentPassword || '', staff.password)) {
      return sendJson(res, 401, { error: 'Current password could not be verified.' });
    }

    const updatedStaff = workbook.staff.map((s) =>
      s.email.toLowerCase() === targetEmail
        ? { ...s, password: hashPassword(body.newPassword), isFirstLogin: false }
        : s
    );
    await saveStaffProfiles(updatedStaff);

    const user: SessionUser = {
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
        staff: sanitizeStaff(updatedStaff),
      },
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Password change failed.' });
  }
}
