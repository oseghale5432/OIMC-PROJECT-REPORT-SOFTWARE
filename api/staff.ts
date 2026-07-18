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
} from '../server/firestore.js';
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

    await saveStaffProfiles(updatedStaff);
    if (Array.isArray(body.progressReports)) await saveProgressReports(body.progressReports);

    return sendJson(res, 200, {
      ytdTasks: workbook.ytdTasks,
      staff: sanitizeStaff(updatedStaff),
      progressReports: body.progressReports || workbook.progressReports,
      databaseId: getDatabaseId(),
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Failed to save staff.' });
  }
}
