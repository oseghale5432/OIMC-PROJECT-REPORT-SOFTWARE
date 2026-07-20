import * as crypto from 'crypto';
import { readJson, sendJson, type ApiRequest, type ApiResponse, getSessionUser, isAdmin } from './_server_helpers.js';
import { getPushTokens, savePushToken, fetchNotifications, addNotification, markNotificationAsRead, markAllNotificationsAsRead, fetchWorkbook } from '../server/firestore.js';
import { sendFcmMessage } from './_server_helpers.js';

function actionName(req: ApiRequest) {
  const url = (req as any).url || '';
  const headers = (req.headers || {}) as Record<string, string | string[]>;
  try {
    const parsed = new URL(url, 'http://localhost');
    return (
      String(parsed.searchParams.get('action') || '') ||
      String(headers['x-action'] || '')
    ).toLowerCase();
  } catch {
    const headers = (req.headers || {}) as Record<string, string | string[]>;
    return String(headers['x-action'] || '').toLowerCase();
  }
}

async function innerHandler(req: ApiRequest, res: ApiResponse) {
  const method = req.method;
  let action = actionName(req).toLowerCase();

  if (method === 'GET' && !action) {
    action = 'list';
  }

  if (action === 'list') {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: 'Your session expired. Please sign in again.' });

    try {
      const notifications = await fetchNotifications();
      const userIsAdmin = isAdmin(user);

      // Check if user is in Accounts/Finance department
      const { staff } = await fetchWorkbook();
      const profile = staff.find((item) => item.email.toLowerCase() === user.email.toLowerCase());
      const userIsAccounts = String(profile?.department || '').toUpperCase().includes('ACCOUNT') || String(profile?.department || '').toUpperCase().includes('FINANCE');

      const visible = notifications.filter((n) => {
        if (n.recipientEmail === 'admin') return userIsAdmin;
        if (n.recipientEmail === 'accounts') return userIsAccounts;
        if (!n.recipientEmail || n.recipientEmail === 'all') return true;
        return n.recipientEmail.toLowerCase() === user.email.toLowerCase();
      });

      visible.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return sendJson(res, 200, { notifications: visible });
    } catch (err: any) {
      return sendJson(res, 500, { error: err.message || 'Failed to fetch notifications.' });
    }
  }

  if (action === 'read') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: 'Your session expired. Please sign in again.' });

    try {
      const body = await readJson(req);
      const id = body.id;

      const { staff } = await fetchWorkbook();
      const profile = staff.find((item) => item.email.toLowerCase() === user.email.toLowerCase());
      const userIsAccounts = String(profile?.department || '').toUpperCase().includes('ACCOUNT') || String(profile?.department || '').toUpperCase().includes('FINANCE');
      const userIsAdmin = isAdmin(user);

      if (id) {
        await markNotificationAsRead(id);
      } else {
        await markAllNotificationsAsRead(user.email, userIsAdmin, userIsAccounts);
      }

      const notifications = await fetchNotifications();
      const visible = notifications.filter((n) => {
        if (n.recipientEmail === 'admin') return userIsAdmin;
        if (n.recipientEmail === 'accounts') return userIsAccounts;
        if (!n.recipientEmail || n.recipientEmail === 'all') return true;
        return n.recipientEmail.toLowerCase() === user.email.toLowerCase();
      });

      visible.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return sendJson(res, 200, { notifications: visible });
    } catch (err: any) {
      return sendJson(res, 500, { error: err.message || 'Failed to update notifications.' });
    }
  }

  if (action === 'register') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: 'You must be signed in to register notifications.' });

    try {
      const body = await readJson(req);
      const token = String(body.token || '').trim();
      if (!token) return sendJson(res, 400, { error: 'Notification token is required.' });

      await savePushToken(user.email, token);
      return sendJson(res, 200, { ok: true });
    } catch (err: any) {
      return sendJson(res, 500, { error: err.message || 'Failed to register push token.' });
    }
  }

  if (action === 'broadcast') {
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

      // Store in firestore notifications database
      await addNotification({
        id: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        title,
        body: message,
        timestamp: new Date().toISOString(),
        recipientEmail: 'all',
        type: 'broadcast',
        isRead: false,
      });

      return sendJson(res, 200, { delivered: results.filter((r) => r.status === 'sent').length, results });
    } catch (error: any) {
      return sendJson(res, 500, { error: error.message || 'Failed to broadcast notifications.' });
    }
  }

  return sendJson(res, 404, { error: 'Not found' });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    return await innerHandler(req, res);
  } catch (err: any) {
    try { console.error(err); } catch {}
    return sendJson(res, 500, { error: String(err?.message || 'Unhandled error'), stack: String(err?.stack || '') });
  }
}
