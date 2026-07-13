import { readJson, sendJson, type ApiRequest, type ApiResponse } from '../../server/http';
import { getSessionUser } from '../../server/security';
import { savePushToken } from '../../server/googleSheets';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const user = getSessionUser(req);
  if (!user) return sendJson(res, 401, { error: 'You must be signed in to register notifications.' });

  try {
    const body = await readJson(req);
    const token = String(body.token || '').trim();
    if (!token) {
      return sendJson(res, 400, { error: 'Notification token is required.' });
    }

    await savePushToken(user.email, token);
    return sendJson(res, 200, { ok: true });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Failed to register push token.' });
  }
}
