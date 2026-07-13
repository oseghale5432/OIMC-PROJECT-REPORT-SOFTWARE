import { readJson, sendJson, type ApiRequest, type ApiResponse } from '../../server/http';
import { getSessionUser, isAdmin } from '../../server/security';
import { getPushTokens } from '../../server/googleSheets';
import { sendFcmMessage } from '../../server/firebaseMessaging';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const user = getSessionUser(req);
  if (!user || !isAdmin(user)) return sendJson(res, 403, { error: 'Admin access is required.' });

  try {
    const body = await readJson(req);
    const title = String(body.title || 'Please update your progress');
    const message = String(body.body || 'Update your task progress in the app as you complete work.');

    const tokens = await getPushTokens();
    if (!tokens.length) {
      return sendJson(res, 200, { delivered: 0, message: 'No registered notification tokens were found.' });
    }

    const results = await Promise.all(
      tokens.map(async (entry) => {
        try {
          await sendFcmMessage(entry.token, title, message, { email: entry.email });
          return { email: entry.email, status: 'sent' };
        } catch (error: any) {
          return { email: entry.email, status: 'failed', error: error.message || String(error) };
        }
      })
    );

    return sendJson(res, 200, { delivered: results.filter((r) => r.status === 'sent').length, results });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Failed to broadcast notifications.' });
  }
}
