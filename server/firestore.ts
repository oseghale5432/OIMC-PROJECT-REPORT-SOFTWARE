import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type CollectionReference, type DocumentData } from 'firebase-admin/firestore';
import type { MonthProgress, PaymentRequest, StaffMember, YTDTask, AppNotification } from './types';
import * as googleSheets from './googleSheets.js';

async function runWithFallback<T>(firestoreOp: () => Promise<T>, sheetsOp: () => Promise<T>): Promise<T> {
  try {
    return await firestoreOp();
  } catch (error: any) {
    const isQuotaExceeded =
      String(error?.message || '').includes('RESOURCE_EXHAUSTED') ||
      String(error?.message || '').includes('Quota exceeded') ||
      String(error?.message || '').includes('8');
    if (isQuotaExceeded) {
      console.warn('Firestore quota exceeded. Falling back to Google Sheets database...');
      return await sheetsOp();
    }
    throw error;
  }
}

async function runWithBackup(
  firestoreWrite: () => Promise<unknown>,
  sheetsWrite: () => Promise<unknown>
): Promise<void> {
  let firestoreSucceeded = false;
  try {
    await firestoreWrite();
    firestoreSucceeded = true;
  } catch (error: any) {
    const isQuotaExceeded =
      String(error?.message || '').includes('RESOURCE_EXHAUSTED') ||
      String(error?.message || '').includes('Quota exceeded') ||
      String(error?.message || '').includes('8');
    if (!isQuotaExceeded) {
      throw error;
    }
    console.warn('Firestore quota exceeded. Writing only to Google Sheets backup...');
  }

  try {
    await sheetsWrite();
  } catch (sheetsError) {
    console.error('Google Sheets backup write failed:', sheetsError);
    if (!firestoreSucceeded) {
      throw sheetsError;
    }
  }
}

function projectId() {
  const value = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!value) {
    throw new Error('Missing FIREBASE_PROJECT_ID environment variable.');
  }
  return value;
}

function adminApp() {
  if (getApps().length) return getApps()[0];

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase service account credentials. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.'
    );
  }

  return initializeApp({
    credential: cert({ projectId: projectId(), clientEmail, privateKey }),
    projectId: projectId(),
  });
}

const db = () => getFirestore(adminApp());

const collections = {
  ytdTasks: 'ytdTasks',
  staff: 'staff',
  progressReports: 'progressReports',
  payments: 'payments',
  pushTokens: 'pushTokens',
  notifications: 'notifications',
} as const;

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function readCollection<T>(name: string): Promise<T[]> {
  try {
    const snapshot = await db().collection(name).get();
    return snapshot.docs.map((document) => document.data() as T);
  } catch (error: any) {
    if (String(error?.code || '').includes('permission-denied') || String(error?.message || '').includes('PERMISSION_DENIED')) {
      throw new Error(
        `Firestore permission denied while reading "${name}" in project "${projectId()}". ` +
          'Check that FIREBASE_PROJECT_ID matches the migrated Firebase project and that FIREBASE_CLIENT_EMAIL has Firestore access.'
      );
    }
    throw error;
  }
}

async function replaceCollection<T extends DocumentData>(
  collection: CollectionReference,
  values: T[],
  idFor: (value: T) => string
) {
  const existing = await collection.listDocuments();
  const incomingIds = new Set(values.map(idFor));
  const operations: Array<{ kind: 'set' | 'delete'; ref: FirebaseFirestore.DocumentReference; value?: T }> = [
    ...existing
      .filter((reference) => !incomingIds.has(reference.id))
      .map((ref) => ({ kind: 'delete' as const, ref })),
    ...values.map((value) => ({
      kind: 'set' as const,
      ref: collection.doc(idFor(value)),
      value: clean(value),
    })),
  ];

  for (let offset = 0; offset < operations.length; offset += 450) {
    const batch = db().batch();
    for (const operation of operations.slice(offset, offset + 450)) {
      if (operation.kind === 'delete') batch.delete(operation.ref);
      else batch.set(operation.ref, operation.value!);
    }
    await batch.commit();
  }
}

export function getDatabaseId() {
  return projectId();
}

export async function fetchWorkbook() {
  return runWithFallback(
    async () => {
      const [ytdTasks, staff, progressReports] = await Promise.all([
        readCollection<YTDTask>(collections.ytdTasks),
        readCollection<StaffMember>(collections.staff),
        readCollection<MonthProgress>(collections.progressReports),
      ]);
      return { ytdTasks, staff, progressReports };
    },
    () => googleSheets.fetchWorkbook()
  );
}

export async function saveYTDTasks(tasks: YTDTask[]) {
  await runWithBackup(
    () => replaceCollection(db().collection(collections.ytdTasks), tasks, (task) => task.id),
    () => googleSheets.saveYTDTasks(tasks)
  );
}

export async function saveStaffProfiles(staff: StaffMember[]) {
  await runWithBackup(
    () => replaceCollection(
      db().collection(collections.staff),
      staff.map((member) => ({ ...member, email: member.email.trim().toLowerCase() })),
      (member) => member.email
    ),
    () => googleSheets.saveStaffProfiles(staff)
  );
}

export async function saveProgressReports(reports: MonthProgress[]) {
  await runWithBackup(
    () => replaceCollection(db().collection(collections.progressReports), reports, (report) => report.id),
    () => googleSheets.saveProgressReports(reports)
  );
}

export async function fetchPayments(): Promise<PaymentRequest[]> {
  return runWithFallback(
    () => readCollection<PaymentRequest>(collections.payments),
    () => googleSheets.fetchPayments()
  );
}

export async function savePayments(payments: PaymentRequest[]) {
  await runWithBackup(
    () => replaceCollection(db().collection(collections.payments), payments, (payment) => payment.id),
    () => googleSheets.savePayments(payments)
  );
}

export async function savePushToken(email: string, token: string) {
  const normalizedEmail = email.trim().toLowerCase();
  await runWithBackup(
    async () => {
      await db().collection(collections.pushTokens).doc(normalizedEmail).set({
        email: normalizedEmail,
        token: token.trim(),
        updatedAt: new Date().toISOString(),
      });
    },
    () => googleSheets.savePushToken(email, token)
  );
}

export async function getPushTokens() {
  return runWithFallback(
    async () => {
      const tokens = await readCollection<{ email: string; token: string }>(collections.pushTokens);
      return tokens.filter((entry) => entry.email && entry.token);
    },
    () => googleSheets.getPushTokens()
  );
}

export function sanitizeStaff(staff: StaffMember[]) {
  return staff.map(({ password, ...safeStaff }) => safeStaff);
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  return runWithFallback(
    () => readCollection<AppNotification>(collections.notifications),
    () => googleSheets.fetchNotifications()
  );
}

export async function addNotification(notification: AppNotification) {
  await runWithBackup(
    async () => { await db().collection(collections.notifications).doc(notification.id).set(clean(notification)); },
    () => googleSheets.addNotification(notification)
  );
}

export async function markNotificationAsRead(id: string) {
  await runWithBackup(
    async () => { await db().collection(collections.notifications).doc(id).update({ isRead: true }); },
    () => googleSheets.markNotificationAsRead(id)
  );
}

export async function markAllNotificationsAsRead(userEmail: string, isAdmin: boolean, isAccounts: boolean) {
  await runWithBackup(
    async () => {
      const collection = db().collection(collections.notifications);
      const snapshot = await collection.get();
      const batch = db().batch();
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as AppNotification;
        const isRecipient =
          !data.recipientEmail ||
          data.recipientEmail === 'all' ||
          (data.recipientEmail === 'admin' && isAdmin) ||
          (data.recipientEmail === 'accounts' && isAccounts) ||
          data.recipientEmail.toLowerCase() === userEmail.toLowerCase();
        if (isRecipient && !data.isRead) {
          batch.update(doc.ref, { isRead: true });
        }
      });
      await batch.commit();
    },
    () => googleSheets.markAllNotificationsAsRead(userEmail, isAdmin, isAccounts)
  );
}

