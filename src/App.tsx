import { useState, useEffect } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  db,
  doc,
  setDoc,
  type User,
} from './firebase';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import type { UserProfile } from './types';
import { stripUndefined } from './utils/sanitize';

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const profile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          lastLoginAt: Date.now(),
        };
        setUserProfile(profile);

        // Record user profile in Firestore
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          await setDoc(userRef, stripUndefined(profile), { merge: true });
        } catch (err) {
          console.warn('Could not sync user document to Firestore:', err);
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      // Handle popup closed or cancelled gracefully
      if (err.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in window was closed before completing authentication.');
      } else if (err.code === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked by your browser. Please allow popups for this site.');
      } else {
        setAuthError(err?.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
    } catch (err: any) {
      console.error('Sign Out Error:', err);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-stone-900 border-t-amber-600 rounded-full animate-spin mb-4" />
        <p className="text-xs text-stone-500 font-medium">
          Verifying authenticated session with Firebase...
        </p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <LandingPage
        onSignIn={handleGoogleSignIn}
        isLoading={isSigningIn}
        authError={authError}
      />
    );
  }

  return (
    <Dashboard
      user={userProfile}
      onSignOut={handleSignOut}
    />
  );
}
