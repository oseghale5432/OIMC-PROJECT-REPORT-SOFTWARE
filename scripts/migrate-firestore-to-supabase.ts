import { config } from 'dotenv';
import { setDefaultResultOrder } from 'node:dns';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
config();
setDefaultResultOrder('ipv4first');

// Initialize Firebase Admin
const fbProjectId = process.env.FIREBASE_PROJECT_ID?.trim();
const fbClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const fbPrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!fbProjectId || !fbClientEmail || !fbPrivateKey) {
  console.error('Missing Firebase credentials. Make sure you set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
  process.exit(1);
}

const fbApp = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({ projectId: fbProjectId, clientEmail: fbClientEmail, privateKey: fbPrivateKey }),
      projectId: fbProjectId,
    });

const firestore = getFirestore(fbApp);

// Initialize Supabase Client
const sbUrl = process.env.SUPABASE_URL?.trim();
const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!sbUrl || !sbServiceKey) {
  console.error('Missing Supabase credentials. Make sure you set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(sbUrl, sbServiceKey, {
  auth: { persistSession: false }
});

async function migrateCollection(firestoreCol: string, supabaseTable: string) {
  console.log(`Migrating "${firestoreCol}" from Firestore to "${supabaseTable}" in Supabase...`);
  const snapshot = await firestore.collection(firestoreCol).get();
  
  if (snapshot.empty) {
    console.log(`No records found in Firestore collection "${firestoreCol}".`);
    return;
  }

  const payloads = snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data(),
  }));

  console.log(`Read ${payloads.length} records from "${firestoreCol}". Writing to Supabase...`);

  // Write in chunks of 50
  for (let i = 0; i < payloads.length; i += 50) {
    const chunk = payloads.slice(i, i + 50);
    const { error } = await supabase
      .from(supabaseTable)
      .upsert(chunk);
    
    if (error) {
      throw new Error(`Failed to upsert chunk to "${supabaseTable}": ${error.message}`);
    }
  }

  console.log(`Successfully migrated ${payloads.length} records into "${supabaseTable}".`);
}

async function run() {
  console.log('--- Starting Firestore to Supabase Migration ---');
  await migrateCollection('ytdTasks', 'ytd_tasks');
  await migrateCollection('staff', 'staff');
  await migrateCollection('progressReports', 'progress_reports');
  await migrateCollection('payments', 'payments');
  await migrateCollection('pushTokens', 'push_tokens');
  await migrateCollection('notifications', 'notifications');
  console.log('--- Migration completed successfully! ---');
}

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
