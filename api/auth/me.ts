import { sendJson, type ApiRequest, type ApiResponse } from '../../server/http';
import { getSessionUser } from '../../server/security';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const user = getSessionUser(req);
  if (!user) return sendJson(res, 401, { error: 'Not signed in.' });
  return sendJson(res, 200, { user });
}
