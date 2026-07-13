import authHandler from '../auth';
import type { ApiRequest, ApiResponse } from '../server/http';

function parseActionFromUrl(url: string) {
  try {
    const parsed = new URL(url, 'http://localhost');
    const path = parsed.pathname || '';
    const parts = path.split('/').filter(Boolean);
    const action = parts[2] || '';
    return action.toLowerCase();
  } catch {
    return '';
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const action = parseActionFromUrl((req as any).url || '');
  if (action && action !== '') {
    const headers = (req.headers || {}) as Record<string, string | string[]>;
    headers['x-action'] = action;
  }
  return authHandler(req, res);
}
