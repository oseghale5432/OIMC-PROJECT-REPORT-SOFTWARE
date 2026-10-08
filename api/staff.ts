import {
  getSessionUser,
  hashPassword,
  isAdmin,
  isHashedPassword,
  readJson,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from './_server_helpers.js';
import {
  fetchWorkbook,
  getDatabaseId,
  sanitizeStaff,
  saveProgressReports,
  saveStaffProfiles,
} from '../server/supabase.js';
import type { StaffMember } from '../server/types.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const user = getSessionUser(req);
    if (!user || !isAdmin(user)) return sendJson(res, 403, { error: 'Admin access is required.' });

    const body = await readJson(req);
    if (!Array.isArray(body.staff)) return sendJson(res, 400, { error: 'Invalid staff payload.' });

    const workbook = await fetchWorkbook();
    const updatedStaff = body.staff.map((incoming: StaffMember) => {
      const existing = workbook.staff.find((staff) => staff.email.toLowerCase() === incoming.email.toLowerCase());
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

    const validEmails = new Set(updatedStaff.map((s) => s.email.toLowerCase()));
    await saveStaffProfiles(updatedStaff);

    let finalReports = workbook.progressReports;
    if (Array.isArray(body.progressReports)) {
      finalReports = body.progressReports.filter(
        (r) => r.staffEmail && validEmails.has(r.staffEmail.trim().toLowerCase())
      );
      await saveProgressReports(finalReports);
    } else {
      finalReports = workbook.progressReports.filter(
        (r) => r.staffEmail && validEmails.has(r.staffEmail.trim().toLowerCase())
      );
      await saveProgressReports(finalReports);
    }

    return sendJson(res, 200, {
      ytdTasks: workbook.ytdTasks,
      staff: sanitizeStaff(updatedStaff),
      progressReports: finalReports,
      databaseId: getDatabaseId(),
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Failed to save staff.' });
  }
}
