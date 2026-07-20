import { config } from 'dotenv';
import { setDefaultResultOrder } from 'node:dns';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as googleSheets from '../server/googleSheets.js';
import type { MonthProgress, PaymentRequest, StaffMember, YTDTask, AppNotification } from '../server/types.js';

config({ path: '.env.local' });
config();
setDefaultResultOrder('ipv4first');

// Initialize Firebase Admin
const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Missing Firebase service account credentials in .env.local.');
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });

const db = getFirestore(app);

async function readCollection<T>(name: string): Promise<T[]> {
  const snapshot = await db.collection(name).get();
  return snapshot.docs.map((doc) => doc.data() as T);
}

async function sync() {
  console.log(`Reading data from Firestore project: ${projectId}...`);
  const [ytdTasks, staff, progressReports, payments, notifications, pushTokens] = await Promise.all([
    readCollection<YTDTask>('ytdTasks'),
    readCollection<StaffMember>('staff'),
    readCollection<MonthProgress>('progressReports'),
    readCollection<PaymentRequest>('payments'),
    readCollection<AppNotification>('notifications'),
    readCollection<{ email: string; token: string }>('pushTokens'),
  ]);

  console.log(`Writing data to Google Sheets spreadsheet ID: ${googleSheets.getSpreadsheetId()}...`);
  
  await Promise.all([
    googleSheets.saveYTDTasks(ytdTasks),
    googleSheets.saveStaffProfiles(staff),
    googleSheets.saveProgressReports(progressReports),
    googleSheets.savePayments(payments),
    googleSheets.saveNotifications(notifications),
    Promise.all(pushTokens.map((entry) => googleSheets.savePushToken(entry.email, entry.token))),
  ]);

  console.log(
    `Sync complete: ${ytdTasks.length} tasks, ${staff.length} staff, ` +
      `${progressReports.length} reports, ${payments.length} payments, ` +
      `${notifications.length} notifications, ${pushTokens.length} push tokens.`
  );
}

sync().catch((err) => {
  console.error('Synchronization failed:', err);
  process.exitCode = 1;
});
