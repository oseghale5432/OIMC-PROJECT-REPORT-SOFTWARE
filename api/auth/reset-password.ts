import { readJson, sendJson, sessionCookie, type ApiRequest, type ApiResponse } from '../_lib/http';
import { createSession, hashPassword } from '../_lib/security';
import { fetchWorkbook, sanitizeStaff, saveStaffProfiles } from '../_lib/googleSheets';
import type { SessionUser } from '../_lib/types';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const { email: rawEmail, name: rawName, newPassword } = await readJson<{ email: string; name: string; newPassword: string }>(req);
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
    return sendJson(res, 500, { error: error.message || 'Password reset failed.' });
  }
}
