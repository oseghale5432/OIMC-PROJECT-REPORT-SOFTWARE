import { sendJson, getSessionUser, type ApiRequest, type ApiResponse } from './_server_helpers.js';
import { fetchWorkbook, getDatabaseId, sanitizeStaff } from '../server/firestore.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: 'Not signed in.' });

    const workbook = await fetchWorkbook();
    return sendJson(res, 200, {
      ...workbook,
      staff: sanitizeStaff(workbook.staff),
      databaseId: getDatabaseId(),
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Failed to load workbook.' });
  }
}
