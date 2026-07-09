import React, { useMemo, useState } from 'react';
import { Banknote, CheckCircle2, Clock3, Send, ShieldCheck, XCircle } from 'lucide-react';
import type { PaymentRequest, PaymentStatus } from '../types';
import { splitAccountingCode } from '../data/accountingCodes';

interface PaymentPageProps {
  payments: PaymentRequest[];
  canApprove: boolean;
  canComplete: boolean;
  isSaving: boolean;
  accountingCodes: string[];
  error: string | null;
  onSubmit: (payment: Pick<PaymentRequest, 'code' | 'payment' | 'description' | 'amount'>) => Promise<void>;
  onUpdateStatus: (id: string, status: PaymentStatus) => Promise<void>;
}

const statusStyles: Record<PaymentStatus, string> = {
  'Pending Approval': 'bg-amber-50 text-amber-700 border-amber-200',
  'Approved for Processing': 'bg-blue-50 text-blue-700 border-blue-200',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  'Payment Made': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function PaymentPage({
  payments,
  canApprove,
  canComplete,
  isSaving,
  accountingCodes,
  error,
  onSubmit,
  onUpdateStatus,
}: PaymentPageProps) {
  const [form, setForm] = useState({ code: '', payment: '', description: '', amount: '' });
  const canManage = canApprove || canComplete;
  const sortedPayments = useMemo(
    () => [...payments].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [payments]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await onSubmit({ ...form, amount: Number(form.amount) });
      setForm({ code: '', payment: '', description: '', amount: '' });
    } catch {
      // The page-level notice displays the API error.
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-orange-500 p-3"><Banknote className="h-6 w-6" /></div>
          <div>
            <h2 className="text-xl font-extrabold">Payment Requests</h2>
            <p className="mt-1 text-sm text-slate-300">
              {canManage
                ? canApprove && canComplete
                  ? 'Approve requests and confirm completed payments.'
                  : canApprove
                    ? 'Review staff requests and approve them for Accounts to process.'
                    : 'Process approved requests and confirm completed payments.'
                : 'Submit a payment request and follow its progress through to payment.'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          Payment service: {error}
        </div>
      )}

      {!canManage && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-bold text-slate-800">New payment request</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Accounting code
              <select required value={form.code} onChange={(e) => {
                const selectedEntry = accountingCodes.find(
                  (entry) => splitAccountingCode(entry).code === e.target.value
                ) || '';
                const selected = splitAccountingCode(selectedEntry);
                setForm({ ...form, code: selected.code, payment: selected.payment });
              }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-orange-500">
                <option value="">Select a code</option>
                {accountingCodes.map((entry) => {
                  const item = splitAccountingCode(entry);
                  return <option key={entry} value={item.code}>{item.code} — {item.payment}</option>;
                })}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Payment
              <input required readOnly value={form.payment}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-600" placeholder="Filled from the selected code" />
            </label>
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">
              Description
              <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-500" placeholder="Add the payment details" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Amount (₦)
              <input required min="0.01" step="0.01" type="number" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-500" placeholder="0.00" />
            </label>
          </div>
          <button disabled={isSaving} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50">
            <Send className="h-4 w-4" /> {isSaving ? 'Sending...' : 'Send request'}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h3 className="font-bold text-slate-800">{canManage ? 'Payment requests' : 'My requests'}</h3>
          {canManage && <span className="flex items-center gap-1 text-xs font-bold text-slate-500"><ShieldCheck className="h-4 w-4" /> {canApprove ? 'Admin approval' : 'Accounts processing'}</span>}
        </div>
        {sortedPayments.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">No payment requests yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="p-4">Code</th><th className="p-4">Payment</th><th className="p-4">Description</th><th className="p-4">Amount</th>{canManage && <th className="p-4">Requested by</th>}<th className="p-4">Status</th><th className="p-4">Submitted</th>{canManage && <th className="p-4">Action</th>}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedPayments.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-slate-50/70">
                    <td className="p-4 font-mono font-semibold text-slate-700">{item.code}</td>
                    <td className="p-4 font-semibold text-slate-800">{item.payment}</td>
                    <td className="max-w-xs p-4 text-slate-600">{item.description}</td>
                    <td className="p-4 font-bold text-slate-900">₦{item.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                    {canManage && <td className="p-4"><div className="font-medium text-slate-700">{item.requestedByName}</div><div className="text-xs text-slate-400">{item.requestedByEmail}</div></td>}
                    <td className="p-4"><span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[item.status]}`}>{item.status === 'Payment Made' ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.status === 'Rejected' ? <XCircle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}{item.status}</span></td>
                    <td className="p-4 text-xs text-slate-500">{new Date(item.submittedAt).toLocaleString()}</td>
                    {canManage && (
                      <td className="p-4">
                        {canApprove && item.status === 'Pending Approval' ? (
                          <div className="flex gap-2">
                            <button disabled={isSaving} onClick={() => onUpdateStatus(item.id, 'Approved for Processing')}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">Approve</button>
                            <button disabled={isSaving} onClick={() => onUpdateStatus(item.id, 'Rejected')}
                              className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">Reject</button>
                          </div>
                        ) : canComplete && item.status === 'Approved for Processing' ? (
                          <button disabled={isSaving} onClick={() => onUpdateStatus(item.id, 'Payment Made')}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">Mark Payment Made</button>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">
                            {item.status === 'Pending Approval'
                              ? 'Waiting for Admin'
                              : item.status === 'Approved for Processing'
                                ? 'Sent to Accounts'
                                : 'Completed'}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
