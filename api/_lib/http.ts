export interface ApiRequest {
  method?: string;
  body?: any;
  headers: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  status?: (statusCode: number) => ApiResponse;
  statusCode?: number;
  setHeader: (name: string, value: string | string[]) => void;
  json?: (body: unknown) => void;
  send?: (body: string) => void;
  end?: (body: string) => void;
}

export async function readJson<T = any>(req: ApiRequest): Promise<T> {
  if (typeof req.body === 'object' && req.body !== null) return req.body as T;
  if (!req.body) return {} as T;
  return JSON.parse(req.body);
}

export function sendJson(res: ApiResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.status?.(status);
  res.setHeader('Content-Type', 'application/json');

  if (res.json) {
    res.json(data);
    return;
  }

  const body = JSON.stringify(data);
  if (res.send) {
    res.send(body);
    return;
  }

  res.end?.(body);
}

export function methodNotAllowed(res: ApiResponse) {
  sendJson(res, 405, { error: 'Method not allowed' });
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getCookie(req: ApiRequest, name: string): string | null {
  const headerValue = req.headers.cookie;
  const header = Array.isArray(headerValue) ? headerValue.join(';') : headerValue;
  if (!header) return null;
  const cookies = header.split(';').map((part) => part.trim());
  const match = cookies.find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function sessionCookie(value: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `oi_session=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `oi_session=; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=0`;
}
