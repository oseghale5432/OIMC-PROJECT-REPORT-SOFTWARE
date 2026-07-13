import { MonthProgress, PaymentRequest, PaymentStatus, StaffMember, YTDTask } from './types';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  } as Record<string, string>;

  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers,
  });

  const responseText = await res.text();
  let data: any = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const fallback = responseText
      ? responseText.replace(/\s+/g, ' ').trim().slice(0, 220)
      : 'No response body.';
    throw new Error(data.error || `Server request failed (${res.status} ${res.statusText}): ${fallback}`);
  }
  return data as T;
}

export interface WorkbookPayload {
  ytdTasks: YTDTask[];
  staff: StaffMember[];
  progressReports: MonthProgress[];
  spreadsheetId?: string;
}

export interface SessionUser {
  email: string;
  displayName: string;
  role: 'admin' | 'staff';
  uid: string;
}

export const ApiClient = {
  login(email: string, password: string) {
    return apiFetch<{
      requiresPasswordChange?: boolean;
      staff?: StaffMember;
      user?: SessionUser;
      workbook?: WorkbookPayload;
    }>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'X-Action': 'login' },
    });
  },

  changePassword(email: string, currentPassword: string, newPassword: string) {
    return apiFetch<{ user: SessionUser; workbook: WorkbookPayload }>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ email, currentPassword, newPassword }),
      headers: { 'X-Action': 'change-password' },
    });
  },

  resetPassword(email: string, name: string, newPassword: string) {
    return apiFetch<{ user: SessionUser; workbook: WorkbookPayload }>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ email, name, newPassword }),
      headers: { 'X-Action': 'reset-password' },
    });
  },

  logout() {
    return apiFetch<{ ok: boolean }>('/api/auth', {
      method: 'POST',
      headers: { 'X-Action': 'logout' },
    });
  },

  loadWorkbook() {
    return apiFetch<WorkbookPayload>('/api/workbook');
  },

  saveProgress(email: string, reports: MonthProgress[], ytdTasks?: YTDTask[]) {
    return apiFetch<WorkbookPayload>('/api/progress', {
      method: 'POST',
      body: JSON.stringify({ email, reports, ytdTasks }),
    });
  },

  saveYTDTasks(tasks: YTDTask[]) {
    return apiFetch<WorkbookPayload>('/api/ytd', {
      method: 'POST',
      body: JSON.stringify({ tasks }),
    });
  },

  saveStaff(staff: StaffMember[], progressReports?: MonthProgress[]) {
    return apiFetch<WorkbookPayload>('/api/staff', {
      method: 'POST',
      body: JSON.stringify({ staff, progressReports }),
    });
  },

  loadPayments() {
    return apiFetch<{ payments: PaymentRequest[]; canApprove: boolean; canComplete: boolean }>('/api/payments');
  },

  createPayment(payment: Pick<PaymentRequest, 'code' | 'payment' | 'description' | 'amount'>) {
    return apiFetch<{ payments: PaymentRequest[]; canApprove: boolean; canComplete: boolean }>('/api/payments', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', payment }),
    });
  },

  updatePaymentStatus(id: string, status: PaymentStatus) {
    return apiFetch<{ payments: PaymentRequest[]; canApprove: boolean; canComplete: boolean }>('/api/payments', {
      method: 'POST',
      body: JSON.stringify({ action: 'updateStatus', id, status }),
    });
  },

  registerPushToken(token: string) {
    return apiFetch<{ ok: boolean }>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ token }),
      headers: { 'X-Action': 'register' },
    });
  },

  broadcastNotification(title: string, body: string) {
    return apiFetch<{ delivered: number; results: Array<Record<string, unknown>> }>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ title, body }),
      headers: { 'X-Action': 'broadcast' },
    });
  },
};
