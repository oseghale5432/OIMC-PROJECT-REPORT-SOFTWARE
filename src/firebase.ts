/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import firebaseConfig from '../firebase-applet-config.json';

type FirebaseUser = {
  email?: string | null;
  displayName?: string | null;
  uid: string;
};

export const app = initializeApp(firebaseConfig);

let authClient: any = null;
let googleProvider: any = null;
let googleAuthProviderCtor: any = null;
let cachedAccessToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem('google_access_token') : null;

const getFirebaseAuthClient = async () => {
  if (authClient && googleProvider && googleAuthProviderCtor) {
    return { auth: authClient, provider: googleProvider, GoogleAuthProvider: googleAuthProviderCtor };
  }

  const authModule: any = await import('firebase/auth');
  authClient = authModule.getAuth(app);
  googleAuthProviderCtor = authModule.GoogleAuthProvider;
  googleProvider = new authModule.GoogleAuthProvider();

  googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
  googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
  googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
  googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');

  return { auth: authClient, provider: googleProvider, GoogleAuthProvider: googleAuthProviderCtor };
};

export const initAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  let unsubscribe = () => {};

  getFirebaseAuthClient()
    .then(({ auth }) => import('firebase/auth').then((authModule: any) => {
      unsubscribe = authModule.onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
        if (user && cachedAccessToken) {
          onAuthSuccess?.(user, cachedAccessToken);
          return;
        }

        if (!user && typeof window !== 'undefined') {
          cachedAccessToken = null;
          localStorage.removeItem('google_access_token');
        }
        onAuthFailure?.();
      });
    }))
    .catch(() => onAuthFailure?.());

  return () => unsubscribe();
};

export const googleSignIn = async (): Promise<{ user: FirebaseUser; accessToken: string } | null> => {
  try {
    const { auth, provider, GoogleAuthProvider } = await getFirebaseAuthClient();
    const authModule: any = await import('firebase/auth');
    const result = await authModule.signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('google_access_token', cachedAccessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign-in error:', error);
    throw error;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutUser = async () => {
  const { auth } = await getFirebaseAuthClient();
  const authModule: any = await import('firebase/auth');
  await authModule.signOut(auth);
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('google_access_token');
  }
};
