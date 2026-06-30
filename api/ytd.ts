import { readJson, sendJson, type ApiRequest, type ApiResponse } from '../server/http';
import { getSessionUser, isAdmin } from '../server/security';
import { fetchWorkbook, sanitizeStaff, saveYTDTasks } from '../server/googleSheets';
import type { YTDTask } from '../server/types';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const user = getSessionUser(req);
    if (!user || !isAdmin(user)) return sendJson(res, 403, { error: 'Admin access is required.' });

    const { tasks } = await readJson<{ tasks: YTDTask[] }>(req);
    if (!Array.isArray(tasks)) return sendJson(res, 400, { error: 'Invalid task payload.' });

    await saveYTDTasks(tasks);
    const workbook = await fetchWorkbook();
    return sendJson(res, 200, { ...workbook, staff: sanitizeStaff(workbook.staff) });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Failed to save YTD tasks.' });
  }
}
