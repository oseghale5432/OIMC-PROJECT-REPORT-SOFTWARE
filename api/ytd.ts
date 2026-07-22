import { readJson, sendJson, getSessionUser, isAdmin, type ApiRequest, type ApiResponse } from './_server_helpers.js';
import { fetchWorkbook, saveYTDTasks, sanitizeStaff } from '../server/supabase.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const user = getSessionUser(req);
    if (!user || !isAdmin(user)) return sendJson(res, 403, { error: 'Admin access is required.' });

    const { tasks } = await readJson(req);
    if (!Array.isArray(tasks)) return sendJson(res, 400, { error: 'Invalid task payload.' });

    await saveYTDTasks(tasks);
    const workbook = await fetchWorkbook();
    return sendJson(res, 200, { ...workbook, staff: sanitizeStaff(workbook.staff) });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Failed to save YTD tasks.' });
  }
}
