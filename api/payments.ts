import { fetchPayments, fetchWorkbook, savePayments } from '../server/googleSheets';
import { methodNotAllowed, readJson, sendJson, type ApiRequest, type ApiResponse } from '../server/http';
import { getSessionUser, isAdmin } from '../server/security';
import type { PaymentRequest, PaymentStatus } from '../server/types';

const ALLOWED_STATUSES: PaymentStatus[] = [
  'Pending Approval',
  'Approved for Processing',
  'Rejected',
  'Payment Made',
];

function isAccountsDepartment(department: string | undefined) {
  return !!department && department.toUpperCase().includes('ACCOUNT');
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res);

  try {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: 'Not signed in.' });

    const workbook = await fetchWorkbook();
    const profile = workbook.staff.find(
      (staff) => staff.email.toLowerCase() === user.email.toLowerCase()
    );
    const canProcess = isAdmin(user) || isAccountsDepartment(profile?.department);
    let payments = await fetchPayments();

    if (req.method === 'POST') {
      const body = await readJson(req);

      if (body.action === 'create') {
        const code = String(body.payment?.code || '').trim();
        const payment = String(body.payment?.payment || '').trim();
        const description = String(body.payment?.description || '').trim();
        const amount = Number(body.payment?.amount);
        if (!code || !payment || !description || !Number.isFinite(amount) || amount <= 0) {
          return sendJson(res, 400, { error: 'Code, payment, description, and a valid amount are required.' });
        }

        const now = new Date().toISOString();
        payments.push({
          id: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          code,
          payment,
          description,
          amount,
          requestedByEmail: user.email,
          requestedByName: profile?.name || user.displayName || user.email,
          status: 'Pending Approval',
          submittedAt: now,
          updatedAt: now,
          updatedBy: user.email,
        });
        await savePayments(payments);
      } else if (body.action === 'updateStatus') {
        if (!canProcess) return sendJson(res, 403, { error: 'Admin or Accounts access is required.' });
        const status = body.status as PaymentStatus;
        if (!ALLOWED_STATUSES.includes(status) || status === 'Pending Approval') {
          return sendJson(res, 400, { error: 'Invalid payment status.' });
        }
        const index = payments.findIndex((payment) => payment.id === body.id);
        if (index < 0) return sendJson(res, 404, { error: 'Payment request not found.' });
        const currentStatus = payments[index].status;
        const validTransition =
          (currentStatus === 'Pending Approval' &&
            (status === 'Approved for Processing' || status === 'Rejected')) ||
          (currentStatus === 'Approved for Processing' &&
            (status === 'Payment Made' || status === 'Rejected'));
        if (!validTransition) {
          return sendJson(res, 400, { error: `Cannot change ${currentStatus} to ${status}.` });
        }
        payments[index] = {
          ...payments[index],
          status,
          updatedAt: new Date().toISOString(),
          updatedBy: user.email,
        };
        await savePayments(payments);
      } else {
        return sendJson(res, 400, { error: 'Invalid payment action.' });
      }
    }

    const visiblePayments = canProcess
      ? payments
      : payments.filter(
          (payment) => payment.requestedByEmail.toLowerCase() === user.email.toLowerCase()
        );
    return sendJson(res, 200, { payments: visiblePayments, canProcess });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Payment request failed.' });
  }
}
