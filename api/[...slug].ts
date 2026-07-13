import authHandler from './auth';
import notificationsHandler from './notifications';
import type { ApiRequest, ApiResponse } from './server/http';

function parseFallbackAction(req: ApiRequest) {
  const url = (req as any).url || '';
  try {
    const parsed = new URL(url, 'http://localhost');
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const [apiSegment, section, action] = parts;
    if (apiSegment !== 'api') return null;
    if (section === 'auth') return action || null;
    if (section === 'notifications') return action || null;
    return null;
  } catch {
    return null;
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const action = parseFallbackAction(req);
  if (!action) {
    return res.status ? res.status(404).json({ error: 'Not found' }) : res.end?.(JSON.stringify({ error: 'Not found' }));
  }

  const headers = (req.headers || {}) as Record<string, string | string[]>;
  headers['x-action'] = action;

  const url = (req as any).url || '';
  const path = new URL(url, 'http://localhost').pathname;
  if (path.startsWith('/api/auth/')) {
    return authHandler(req, res);
  }
  if (path.startsWith('/api/notifications/')) {
    return notificationsHandler(req, res);
  }

  return res.status ? res.status(404).json({ error: 'Not found' }) : res.end?.(JSON.stringify({ error: 'Not found' }));
}
