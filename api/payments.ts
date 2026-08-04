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
    const userEmailLower = user.email.toLowerCase();

    // Determine roles & permissions
    const isSuperAdmin = userEmailLower === 'oseghale5432@gmail.com';
    
    // OIMC GM: email vaughaned1965@gmail.com, or "OIMC GM" in department/activity
    const isGM = userEmailLower === 'vaughaned1965@gmail.com' ||
                 String(profile?.department || '').toUpperCase().includes('OIMC GM') ||
                 String(profile?.activity || '').toUpperCase().includes('OIMC GM');
                 
    // OIDC COO: email juyinad@gmail.com, or "OIDC COO" in department/activity
    const isCOO = userEmailLower === 'juyinad@gmail.com' ||
                  String(profile?.department || '').toUpperCase().includes('OIDC COO') ||
                  String(profile?.activity || '').toUpperCase().includes('OIDC COO');

    const paymentDepartment = String(profile?.department || '').toUpperCase();
    const isAccounts = paymentDepartment.includes('ACCOUNT') || paymentDepartment.includes('FINANCE');

    const canApproveGM = isGM || isSuperAdmin;
    const canApproveCOO = isCOO || isSuperAdmin;
    const canComplete = isAccounts || isSuperAdmin;
    const canViewAll = canApproveGM || canApproveCOO || canComplete || user.role === 'admin';
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
          status: 'Pending GM Approval' as const,
          submittedAt: now,
          updatedAt: now,
          updatedBy: user.email,
        };
        payments.push(newPayment);
        await savePayments(payments);

        // Add a notification for the OIMC GM
        await addNotification({
          id: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          title: 'New Payment Request (Pending GM Approval)',
          body: `₦${amount.toLocaleString('en-NG')} request submitted by ${newPayment.requestedByName} for ${payment}. Needs GM approval.`,
          timestamp: now,
          recipientEmail: 'vaughaned1965@gmail.com',
          type: 'payment',
          isRead: false,
        });
      } else if (body.action === 'updateStatus') {
        const index = payments.findIndex((item) => item.id === body.id);
        if (index < 0) return sendJson(res, 404, { error: 'Payment request not found.' });
        const next = body.status as PaymentStatus;
        const current = payments[index].status;
        
        let valid = false;
        if (current === 'Pending GM Approval') {
          valid = canApproveGM && (next === 'Pending COO Approval' || next === 'Rejected');
          if (!canApproveGM && next === 'Pending COO Approval') {
            return sendJson(res, 403, { error: 'Only OIMC GM or Super Admin can approve this request at this stage.' });
          }
        } else if (current === 'Pending COO Approval') {
          valid = canApproveCOO && (next === 'Approved for Processing' || next === 'Rejected');
          if (!canApproveCOO && next === 'Approved for Processing') {
            return sendJson(res, 403, { error: 'Only OIDC COO or Super Admin can approve this request at this stage.' });
          }
        } else if (current === 'Approved for Processing') {
          valid = canComplete && next === 'Payment Made';
          if (!canComplete && next === 'Payment Made') {
            return sendJson(res, 403, { error: 'Only Accounts or Finance can process this payment.' });
          }
        }

        if (!valid) return sendJson(res, 400, { error: `Cannot change status from ${current} to ${next}.` });

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

        if (next === 'Pending COO Approval') {
          // Notify COO
          await addNotification({
            id: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            title: 'Payment Request Approved by GM',
            body: `Payment request for ₦${amtStr} (${payName}) by ${requesterName} has been approved by GM and is pending your COO approval.`,
            timestamp: new Date().toISOString(),
            recipientEmail: 'juyinad@gmail.com',
            type: 'payment',
            isRead: false,
          });
        } else if (next === 'Approved for Processing') {
          // Notify requester
          await addNotification({
            id: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            title: 'Payment Request Approved by COO',
            body: `Your payment request for ₦${amtStr} (${payName}) has been approved by GM and COO, and sent to Accounts.`,
            timestamp: new Date().toISOString(),
            recipientEmail: requesterEmail,
            type: 'payment',
            isRead: false,
          });

          // Notify accounts
          await addNotification({
            id: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            title: 'New Payment to Process',
            body: `Payment request for ₦${amtStr} (${payName}) by ${requesterName} is approved by GM & COO and ready.`,
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
    return sendJson(res, 200, { payments: visible, canApproveGM, canApproveCOO, canComplete });
  } catch (error: any) {
    console.error('Payments API error:', error);
    return sendJson(res, 500, { error: error.message || 'Could not load payment requests.' });
  }
}
