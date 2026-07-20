export interface YTDTask {
  id: string;
  department: string;
  lead: string;
  coWorker: string;
  contractorHead: string;
  description: string;
  startDate: string;
  dueDate: string;
  daysRemaining: number;
  status: string;
  remark: string;
}

export interface StaffMember {
  email: string;
  name: string;
  department: string;
  activity: string;
  label: string;
  isNew: boolean;
  role?: 'admin' | 'staff';
  password?: string;
  isFirstLogin?: boolean;
}

export interface TaskItem {
  description: string;
  completed: boolean | null;
  ytdTaskId?: string;
}

export interface MonthProgress {
  id: string;
  staffEmail: string;
  month: string;
  activity: string;
  tasks: TaskItem[];
}

export interface SessionUser {
  email: string;
  displayName: string;
  role: 'admin' | 'staff';
  uid: string;
}

export type PaymentStatus =
  | 'Pending Approval'
  | 'Approved for Processing'
  | 'Rejected'
  | 'Payment Made';

export interface PaymentRequest {
  id: string;
  code: string;
  payment: string;
  description: string;
  amount: number;
  requestedByEmail: string;
  requestedByName: string;
  status: PaymentStatus;
  submittedAt: string;
  updatedAt: string;
  updatedBy: string;
  rejectionNotes?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  recipientEmail?: string; // "all", "admin", "accounts", or specific user email
  type: 'payment' | 'broadcast' | 'system';
  isRead: boolean;
}

