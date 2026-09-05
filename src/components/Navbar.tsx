import React from 'react';
import { BookOpen, LogOut, PenLine, Library, Sparkles, User as UserIcon, Bookmark, Compass } from 'lucide-react';
import type { UserProfile } from '../types';

interface NavbarProps {
  activeTab: 'write' | 'entries' | 'memories' | 'ask' | 'chat';
  setActiveTab: (tab: 'write' | 'entries' | 'memories' | 'ask' | 'chat') => void;
  user: UserProfile | null;
  onSignOut: () => void;
  entryCount: number;
  memoryCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onSignOut,
  entryCount,
  memoryCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-stone-200/90 bg-[#faf8f5]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-stone-900 text-amber-50 flex items-center justify-center shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-stone-900 tracking-tight text-base leading-none">
              Ask My Past Self
            </h1>
            <span className="text-[11px] text-stone-500 font-medium">Personal Gemini Journal</span>
          </div>
        </div>

        {/* Center Tabs */}
        <nav className="flex items-center p-1 bg-stone-200/60 rounded-xl border border-stone-300/40">
          <button
            id="tab-write-btn"
            onClick={() => setActiveTab('write')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'write'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Write Entry</span>
          </button>

          <button
            id="tab-entries-btn"
            onClick={() => setActiveTab('entries')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'entries'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Library className="w-3.5 h-3.5" />
            <span>Journal History</span>
            {entryCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-stone-100 text-stone-700 rounded-full text-[10px] font-semibold border border-stone-300/60">
                {entryCount}
              </span>
            )}
          </button>

          <button
            id="tab-memories-btn"
            onClick={() => setActiveTab('memories')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'memories'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-600" />
            <span>Memories</span>
            {memoryCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-50 text-amber-800 rounded-full text-[10px] font-semibold border border-amber-300/60">
                {memoryCount}
              </span>
            )}
          </button>

          <button
            id="tab-ask-btn"
            onClick={() => setActiveTab('ask')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'ask'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-stone-800" />
            <span>Ask Past Self</span>
          </button>

          <button
            id="tab-chat-btn"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Gemini Dialogue</span>
          </button>
        </nav>

        {/* User profile & Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 pl-2">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-8 h-8 rounded-full border border-stone-300 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-stone-200 border border-stone-300 flex items-center justify-center text-stone-600 text-xs font-semibold">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
            <div className="text-left">
              <p className="text-xs font-semibold text-stone-900 leading-tight">
                {user?.displayName || 'Journaler'}
              </p>
              <p className="text-[10px] text-stone-500 truncate max-w-[120px]">
                {user?.email || 'Authenticated'}
              </p>
            </div>
          </div>

          <button
            id="sign-out-btn"
            onClick={onSignOut}
            title="Sign Out"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-300/70 bg-white hover:bg-stone-100 text-stone-700 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-stone-500" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
