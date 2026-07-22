import * as crypto from 'crypto';
import { getSessionUser, readJson, sendJson, type ApiRequest, type ApiResponse } from './_server_helpers.js';
import { fetchPayments, fetchWorkbook, savePayments, addNotification } from '../server/supabase.js';
import type { PaymentStatus } from '../server/types.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: 'Your session expired. Please sign in again.' });

    const { staff } = await fetchWorkbook();
    const profile = staff.find((item) => item.email.toLowerCase() === user.email.toLowerCase());
    const canApprove = user.role === 'admin' || user.email.toLowerCase() === 'oseghale5432@gmail.com';
    const paymentDepartment = String(profile?.department || '').toUpperCase();
    const canComplete = paymentDepartment.includes('ACCOUNT') || paymentDepartment.includes('FINANCE');
    const canViewAll = canApprove || canComplete;
    let payments = await fetchPayments();

    if (req.method === 'POST') {
      const body = await readJson(req);
      if (body.action === 'create') {
        const code = String(body.payment?.code || '').trim();
        const payment = String(body.payment?.payment || '').trim();
        const description = String(body.payment?.description || '').trim();
        const amount = Number(body.payment?.amount);
        if (!code || !payment || !description || !Number.isFinite(amount) || amount <= 0) {
          return sendJson(res, 400, { error: 'Select a code and enter a description and valid amount.' });
        }
        const now = new Date().toISOString();
        const newPayment = {
          id: `PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          code,
          payment,
          description,
          amount,
          requestedByEmail: user.email,
          requestedByName: profile?.name || user.displayName || user.email,
          status: 'Pending Approval' as const,
          submittedAt: now,
          updatedAt: now,
          updatedBy: user.email,
        };
        payments.push(newPayment);
        await savePayments(payments);

        // Add a notification for the admin
        await addNotification({
          id: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          title: 'New Payment Request',
          body: `₦${amount.toLocaleString('en-NG')} request submitted by ${newPayment.requestedByName} for ${payment}`,
          timestamp: now,
          recipientEmail: 'admin',
          type: 'payment',
          isRead: false,
        });
      } else if (body.action === 'updateStatus') {
        const index = payments.findIndex((item) => item.id === body.id);
        if (index < 0) return sendJson(res, 404, { error: 'Payment request not found.' });
        const next = body.status as PaymentStatus;
        const current = payments[index].status;
        const valid =
          (canApprove && current === 'Pending Approval' && (next === 'Approved for Processing' || next === 'Rejected')) ||
          (canComplete && current === 'Approved for Processing' && next === 'Payment Made');
        if (!canApprove && current === 'Pending Approval') {
          return sendJson(res, 403, { error: 'Only an administrator can approve or reject this request.' });
        }
        if (!canComplete && next === 'Payment Made') {
          return sendJson(res, 403, { error: 'Only a user in the Accounts or Finance department can mark payment as completed.' });
        }
        if (!valid) return sendJson(res, 400, { error: `Cannot change ${current} to ${next}.` });

        const rejectionNotes = next === 'Rejected' ? String(body.rejectionNotes || '').trim() : undefined;

        payments[index] = {
          ...payments[index],
          status: next,
          rejectionNotes,
          updatedAt: new Date().toISOString(),
          updatedBy: user.email,
        };
        await savePayments(payments);

        // Add appropriate notification
        const amtStr = payments[index].amount.toLocaleString('en-NG');
        const payName = payments[index].payment;
        const requesterEmail = payments[index].requestedByEmail;
        const requesterName = payments[index].requestedByName;

        if (next === 'Approved for Processing') {
          // Notify requester
          await addNotification({
            id: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            title: 'Payment Request Approved',
            body: `Your payment request for ₦${amtStr} (${payName}) has been approved for processing.`,
            timestamp: new Date().toISOString(),
            recipientEmail: requesterEmail,
            type: 'payment',
            isRead: false,
          });

          // Notify accounts
          await addNotification({
            id: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            title: 'New Payment to Process',
            body: `Payment request for ₦${amtStr} (${payName}) by ${requesterName} is approved and ready.`,
            timestamp: new Date().toISOString(),
            recipientEmail: 'accounts',
            type: 'payment',
            isRead: false,
          });
        } else if (next === 'Rejected') {
          // Notify requester
          await addNotification({
            id: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            title: 'Payment Request Rejected',
            body: `Your payment request for ₦${amtStr} (${payName}) was rejected. Reason: ${rejectionNotes || 'No reason provided.'}`,
            timestamp: new Date().toISOString(),
            recipientEmail: requesterEmail,
            type: 'payment',
            isRead: false,
          });
        } else if (next === 'Payment Made') {
          // Notify requester
          await addNotification({
            id: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            title: 'Payment Completed',
            body: `Payment of ₦${amtStr} (${payName}) has been processed and completed.`,
            timestamp: new Date().toISOString(),
            recipientEmail: requesterEmail,
            type: 'payment',
            isRead: false,
          });
        }
      } else {
        return sendJson(res, 400, { error: 'Invalid payment action.' });
      }
    }

    const visible = canViewAll
      ? payments
      : payments.filter((item) => item.requestedByEmail.toLowerCase() === user.email.toLowerCase());
    return sendJson(res, 200, { payments: visible, canApprove, canComplete });
  } catch (error: any) {
    console.error('Payments API error:', error);
    return sendJson(res, 500, { error: error.message || 'Could not load payment requests.' });
  }
}
