import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function getServiceAccountEmail() {
  const value = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!value) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL');
  return value;
}

function getPrivateKey() {
  const value = process.env.GOOGLE_PRIVATE_KEY;
  if (!value) throw new Error('Missing GOOGLE_PRIVATE_KEY');
  return value.replace(/\\n/g, '\n');
}

function getProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }

  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.projectId) {
      return config.projectId;
    }
  }

  throw new Error('Missing FIREBASE_PROJECT_ID environment variable and unable to read firebase-applet-config.json.');
}

async function getGoogleAccessToken(scopes: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({
      iss: getServiceAccountEmail(),
      scope: scopes.join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  );
  const unsignedJwt = `${header}.${claim}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsignedJwt)
    .sign(getPrivateKey(), 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsignedJwt}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google auth failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

export async function sendFcmMessage(
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  const accessToken = await getGoogleAccessToken(['https://www.googleapis.com/auth/firebase.messaging']);
  const projectId = getProjectId();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: {
          title,
          body,
        },
        webpush: {
          headers: {
            Urgency: 'high',
          },
          notification: {
            icon: '/assets/orange-island-logo.png',
          },
          data,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`FCM request failed: ${await response.text()}`);
  }

  return await response.json();
}
