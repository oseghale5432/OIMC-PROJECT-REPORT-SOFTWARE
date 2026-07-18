<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/fd363bbd-9b2d-4c18-888b-32d2e7c7360f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Firestore database

The server API stores application data in Firestore collections:
`ytdTasks`, `staff`, `progressReports`, `payments`, and `pushTokens`.

Set these server environment variables locally and in Vercel:

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
SESSION_SECRET
```

Create the Firestore database in Firebase Console before deploying. The Firebase
service account must have Firestore access. Keep its private key server-side.

## One-time migration from Google Sheets

Keep the old Google Sheets variables available temporarily, add the Firebase
variables above, and run:

```bash
npm run migrate:firestore
```

The migration copies tasks, staff profiles and password hashes, progress reports,
payments, and push-notification tokens. After verifying the app in Firestore, the
Google Sheets variables can be removed from the deployed application.
