import React from 'react';
import { BookOpen, ShieldCheck, Sparkles, Lock, ArrowRight, Clock, MessageSquareQuote, CheckCircle2 } from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  isLoading: boolean;
  authError: string | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, isLoading, authError }) => {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col justify-between selection:bg-amber-100 selection:text-amber-900">
      {/* Top Bar */}
      <header className="w-full border-b border-stone-200/80 bg-white/70 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-stone-900 text-amber-50 flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-stone-900 tracking-tight text-lg">Ask My Past Self</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 bg-amber-100/70 text-amber-800 rounded-full border border-amber-200/50">
                Journal Foundation
              </span>
            </div>
          </div>

          <button
            id="header-sign-in-btn"
            onClick={onSignIn}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-stone-900 hover:bg-stone-800 text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            Sign In with Google
          </button>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col items-center text-center">
        {authError && (
          <div
            id="auth-error-banner"
            className="w-full max-w-lg mb-8 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-start gap-3 text-left"
          >
            <ShieldCheck className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Authentication Notice</p>
              <p className="text-rose-700 mt-0.5">{authError}</p>
            </div>
          </div>
        )}

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-100 border border-stone-300/80 text-stone-700 text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          Powered by Secure Firebase Auth, Firestore &amp; Google Gemini
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif tracking-tight text-stone-900 max-w-3xl leading-[1.15]">
          A mindful sanctuary for your daily thoughts and reflections.
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-stone-600 max-w-2xl font-normal leading-relaxed">
          Ask My Past Self is a secure personal memory system that lets you retrieve, compare, and understand your past through grounded Gemini reasoning. Capture authentic experiences in a private, owner-isolated personal journal.
        </p>

        {/* Primary CTA */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <button
            id="hero-sign-in-btn"
            onClick={onSignIn}
            disabled={isLoading}
            className="w-full sm:w-auto px-8 py-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-medium text-base transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3 cursor-pointer group disabled:opacity-60"
          >
            {isLoading ? (
              <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google Sign-In</span>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </div>

        {/* Security & Architecture Pillars */}
        <div className="mt-16 sm:mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-stone-900 text-base mb-1.5">Strict Owner Isolation</h3>
            <p className="text-stone-600 text-sm leading-relaxed">
              Every journal entry and conversation is bound to your Firebase authenticated UID. Zero cross-user data leakage.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-stone-900 text-base mb-1.5">Resilient Gemini Assistance</h3>
            <p className="text-stone-600 text-sm leading-relaxed">
              Multi-turn reflection and writing prompts with an automated backend fallback ladder, keeping your journal sessions seamless.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-stone-900 text-base mb-1.5">Memory Retrieval Ready</h3>
            <p className="text-stone-600 text-sm leading-relaxed">
              Structured metadata tracks timestamps, emotional tones, tags, and AI insights to power future conversational memory queries.
            </p>
          </div>
        </div>

        {/* Product Roadmap / Scope Clarity */}
        <div className="mt-12 p-6 rounded-2xl bg-stone-100/70 border border-stone-200 w-full text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <MessageSquareQuote className="w-5 h-5 text-stone-700 shrink-0 mt-1" />
            <div>
              <p className="text-sm font-semibold text-stone-900">Current Scope: Personal Journaling Foundation</p>
              <p className="text-xs text-stone-600 mt-0.5">
                Active features: Secure Journaling, Google Authentication, Firestore Owner Isolation, and Multi-turn Gemini Reflections.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-500 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Ready to Begin</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200/80 py-6 text-center text-xs text-stone-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Ask My Past Self &copy; {new Date().getFullYear()} — Secure Personal Journal Foundation</span>
          <span className="text-stone-400">Google Cloud Run &bull; Firebase Auth &bull; Cloud Firestore &bull; Gemini API</span>
        </div>
      </footer>
    </div>
  );
};
