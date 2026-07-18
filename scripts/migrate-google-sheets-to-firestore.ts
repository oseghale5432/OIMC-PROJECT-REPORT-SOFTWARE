import { config } from 'dotenv';
import { setDefaultResultOrder } from 'node:dns';
import {
  fetchPayments,
  fetchWorkbook,
  getPushTokens,
} from '../server/googleSheets.js';
import {
  getDatabaseId,
  savePayments,
  saveProgressReports,
  savePushToken,
  saveStaffProfiles,
  saveYTDTasks,
} from '../server/firestore.js';

config({ path: '.env.local' });
config();
setDefaultResultOrder('ipv4first');

function validateEnvironment() {
  const required = [
    'GOOGLE_SHEETS_SPREADSHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());

  if (missing.length) {
    throw new Error(
      `Migration configuration is incomplete. Add these variables to .env.local:\n${missing
        .map((name) => `  - ${name}`)
        .join('\n')}`
    );
  }
}

async function migrate() {
  validateEnvironment();
  console.log(`Migrating Google Sheets data to Firestore project ${getDatabaseId()}...`);
  const [workbook, payments, pushTokens] = await Promise.all([
    fetchWorkbook(),
    fetchPayments(),
    getPushTokens(),
  ]);

  await Promise.all([
    saveYTDTasks(workbook.ytdTasks),
    saveStaffProfiles(workbook.staff),
    saveProgressReports(workbook.progressReports),
    savePayments(payments),
    Promise.all(pushTokens.map((entry) => savePushToken(entry.email, entry.token))),
  ]);

  console.log(
    `Migration complete: ${workbook.ytdTasks.length} tasks, ${workbook.staff.length} staff, ` +
      `${workbook.progressReports.length} reports, ${payments.length} payments, ${pushTokens.length} push tokens.`
  );
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
