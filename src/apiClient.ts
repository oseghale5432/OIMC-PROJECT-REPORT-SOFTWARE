import { MonthProgress, PaymentRequest, PaymentStatus, StaffMember, YTDTask } from './types';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
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
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  changePassword(email: string, currentPassword: string, newPassword: string) {
    return apiFetch<{ user: SessionUser; workbook: WorkbookPayload }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ email, currentPassword, newPassword }),
    });
  },

  resetPassword(email: string, name: string, newPassword: string) {
    return apiFetch<{ user: SessionUser; workbook: WorkbookPayload }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, name, newPassword }),
    });
  },

  logout() {
    return apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
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
};
