import { readJson, sendJson, sessionCookie, type ApiRequest, type ApiResponse } from '../lib/http';
import { createSession, isHashedPassword, verifyPassword } from '../lib/security';
import { fetchWorkbook, sanitizeStaff } from '../lib/googleSheets';
import type { SessionUser, StaffMember } from '../lib/types';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const { email: rawEmail, password } = await readJson<{ email: string; password: string }>(req);
    const email = rawEmail?.trim().toLowerCase();
    if (!email || !password) return sendJson(res, 400, { error: 'Email and password are required.' });

    const workbook = await fetchWorkbook();
    const staff = workbook.staff.find((s) => s.email.toLowerCase() === email);
    if (!staff) return sendJson(res, 401, { error: 'This email address is not registered.' });
    if (!verifyPassword(password, staff.password)) return sendJson(res, 401, { error: 'The password you entered is incorrect.' });

    const requiresPasswordChange = staff.isFirstLogin || !isHashedPassword(staff.password);
    const safeStaff = sanitizeStaff([staff])[0] as StaffMember;

    if (requiresPasswordChange) {
      return sendJson(res, 200, {
        requiresPasswordChange: true,
        staff: safeStaff,
      });
    }

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
        staff: sanitizeStaff(workbook.staff),
      },
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Login failed.' });
  }
}
