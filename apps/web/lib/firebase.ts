import { initializeApp, getApps, getApp } from "firebase/app"
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  type Auth,
} from "firebase/auth"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
export const auth: Auth = getAuth(app)

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: "select_account" })

export const facebookProvider = new FacebookAuthProvider()

/**
 * Sign in with Google popup — returns Firebase idToken
 */
export async function signInWithGoogle(rememberMe: boolean): Promise<string> {
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
  const result = await signInWithPopup(auth, googleProvider)
  return result.user.getIdToken()
}

/**
 * Sign in with Facebook popup — returns Firebase idToken
 */
export async function signInWithFacebook(rememberMe: boolean): Promise<string> {
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
  const result = await signInWithPopup(auth, facebookProvider)
  return result.user.getIdToken()
}

/**
 * Sign out from Firebase
 */
export async function firebaseSignOut(): Promise<void> {
  await signOut(auth)
}
