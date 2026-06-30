import { readJson, sendJson, type ApiRequest, type ApiResponse } from './lib/http';
import { getSessionUser, hashPassword, isAdmin, isHashedPassword } from './lib/security';
import { fetchWorkbook, sanitizeStaff, saveProgressReports, saveStaffProfiles } from './lib/googleSheets';
import type { MonthProgress, StaffMember } from './lib/types';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const user = getSessionUser(req);
    if (!user || !isAdmin(user)) return sendJson(res, 403, { error: 'Admin access is required.' });

    const body = await readJson<{ staff: StaffMember[]; progressReports?: MonthProgress[] }>(req);
    if (!Array.isArray(body.staff)) return sendJson(res, 400, { error: 'Invalid staff payload.' });

    const workbook = await fetchWorkbook();
    const updatedStaff = body.staff.map((incoming) => {
      const existing = workbook.staff.find((s) => s.email.toLowerCase() === incoming.email.toLowerCase());
      const incomingPassword = incoming.password?.trim();
      let password = existing?.password || '';

      if (incomingPassword) {
        password = isHashedPassword(incomingPassword) ? incomingPassword : hashPassword(incomingPassword);
      }

      return {
        ...incoming,
        password,
        isFirstLogin: incoming.isFirstLogin ?? existing?.isFirstLogin ?? true,
      };
    });

    await saveStaffProfiles(updatedStaff);
    if (body.progressReports) await saveProgressReports(body.progressReports);

    return sendJson(res, 200, {
      ytdTasks: workbook.ytdTasks,
      staff: sanitizeStaff(updatedStaff),
      progressReports: body.progressReports || workbook.progressReports,
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Failed to save staff.' });
  }
}
