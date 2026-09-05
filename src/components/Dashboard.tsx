import React, { useState, useEffect, useCallback } from 'react';
import {
  db,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
} from '../firebase';
import { Navbar } from './Navbar';
import { JournalEditor } from './JournalEditor';
import { JournalList } from './JournalList';
import { MemoryList } from './MemoryList';
import { GeminiReflector } from './GeminiReflector';
import { AskPastSelf } from './AskPastSelf';
import type { UserProfile, JournalEntry, Memory, GeminiInteraction } from '../types';
import { stripUndefined } from '../utils/sanitize';
import { RefreshCw, AlertCircle, Plus, BookOpen, Sparkles, Bookmark, Compass, ArrowRight, ArrowDown } from 'lucide-react';

interface DashboardProps {
  user: UserProfile;
  onSignOut: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onSignOut }) => {
  const [activeTab, setActiveTab] = useState<'write' | 'entries' | 'memories' | 'ask' | 'chat'>('write');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [activeEntryToEdit, setActiveEntryToEdit] = useState<JournalEntry | null>(null);
  const [chatContextText, setChatContextText] = useState<string>('');
  const [highlightedMemoryId, setHighlightedMemoryId] = useState<string | null>(null);
  
  const [isLoadingEntries, setIsLoadingEntries] = useState<boolean>(true);
  const [isLoadingMemories, setIsLoadingMemories] = useState<boolean>(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Fetch user entries from Firestore
  const fetchEntries = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingEntries(true);
    setGlobalError(null);

    try {
      const entriesRef = collection(db, 'users', user.uid, 'journalEntries');
      const q = query(entriesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const loaded: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loaded.push({
          id: docSnap.id,
          userId: data.userId || user.uid,
          title: data.title || 'Untitled Entry',
          content: data.content || '',
          mood: data.mood,
          tags: Array.isArray(data.tags) ? data.tags : [],
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
          wordCount: data.wordCount || 0,
          aiReflection: data.aiReflection,
          aiSummary: data.aiSummary,
          growthTensionInsight: data.growthTensionInsight,
          metadata: data.metadata,
        });
      });

      setEntries(loaded);
    } catch (err: any) {
      console.error('Failed to load journal entries from Firestore:', err);
      setGlobalError('Unable to synchronize journal entries from cloud storage.');
    } finally {
      setIsLoadingEntries(false);
    }
  }, [user.uid]);

  // Fetch user memories from Firestore
  const fetchMemories = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoadingMemories(true);

    try {
      const memoriesRef = collection(db, 'users', user.uid, 'memories');
      const q = query(memoriesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const loaded: Memory[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loaded.push({
          id: docSnap.id,
          userId: data.userId || user.uid,
          sourceJournalEntryId: data.sourceJournalEntryId || data.sourceEntryId,
          sourceJournalTitle: data.sourceJournalTitle || data.sourceEntryTitle,
          type: (data.type || data.memoryType || 'Realization') as Memory['type'],
          title: data.title || 'Captured Memory',
          summary: data.summary || '',
          tags: Array.isArray(data.tags) ? data.tags : [],
          keyQuotes: Array.isArray(data.keyQuotes) ? data.keyQuotes : [],
          actionItems: Array.isArray(data.actionItems) ? data.actionItems : [],
          emotionalContext: data.emotionalContext,
          timeframe: data.timeframe,
          importance: data.importance || 'medium',
          extractedWithModel: data.extractedWithModel,
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        });
      });

      setMemories(loaded);
    } catch (err: any) {
      console.error('Failed to load memories from Firestore:', err);
    } finally {
      setIsLoadingMemories(false);
    }
  }, [user.uid]);

  useEffect(() => {
    fetchEntries();
    fetchMemories();
  }, [fetchEntries, fetchMemories]);

  // Save or update an entry to Firestore
  const handleSaveEntry = async (entry: JournalEntry): Promise<boolean> => {
    try {
      const entryRef = doc(db, 'users', user.uid, 'journalEntries', entry.id);
      const cleanData = stripUndefined(entry);
      await setDoc(entryRef, cleanData, { merge: true });

      // Update local state immediately for fast response
      setEntries((prev) => {
        const existingIdx = prev.findIndex((e) => e.id === entry.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = entry;
          return updated;
        }
        return [entry, ...prev];
      });

      return true;
    } catch (err: any) {
      console.error('Error saving journal entry:', err);
      return false;
    }
  };

  // Save or update a memory to Firestore
  const handleSaveMemory = async (memory: Memory): Promise<boolean> => {
    try {
      const memoryRef = doc(db, 'users', user.uid, 'memories', memory.id);
      const cleanData = stripUndefined(memory);
      await setDoc(memoryRef, cleanData, { merge: true });

      setMemories((prev) => {
        const existingIdx = prev.findIndex((m) => m.id === memory.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = memory;
          return updated;
        }
        return [memory, ...prev];
      });

      return true;
    } catch (err: any) {
      console.error('Error saving memory:', err);
      return false;
    }
  };

  // Delete a memory from Firestore
  const handleDeleteMemory = async (memoryId: string): Promise<boolean> => {
    try {
      const memoryRef = doc(db, 'users', user.uid, 'memories', memoryId);
      await deleteDoc(memoryRef);

      setMemories((prev) => prev.filter((m) => m.id !== memoryId));
      return true;
    } catch (err: any) {
      console.error('Error deleting memory:', err);
      return false;
    }
  };

  // Delete an entry from Firestore
  const handleDeleteEntry = async (entryId: string): Promise<boolean> => {
    try {
      const entryRef = doc(db, 'users', user.uid, 'journalEntries', entryId);
      await deleteDoc(entryRef);

      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      if (activeEntryToEdit?.id === entryId) {
        setActiveEntryToEdit(null);
      }
      return true;
    } catch (err: any) {
      console.error('Error deleting journal entry:', err);
      return false;
    }
  };

  // Save a Gemini interaction to Firestore
  const handleSaveInteraction = async (interaction: GeminiInteraction): Promise<boolean> => {
    try {
      const interactionRef = doc(db, 'users', user.uid, 'interactions', interaction.id);
      const cleanData = stripUndefined(interaction);
      await setDoc(interactionRef, cleanData, { merge: true });
      return true;
    } catch (err: any) {
      console.error('Error saving interaction:', err);
      return false;
    }
  };

  // Navigate to editor with selected entry
  const handleSelectEdit = (entry: JournalEntry) => {
    setActiveEntryToEdit(entry);
    setActiveTab('write');
  };

  // Navigate to source journal entry from memory
  const handleViewSourceEntry = (entryId: string) => {
    const found = entries.find((e) => e.id === entryId);
    if (found) {
      setActiveEntryToEdit(found);
      setActiveTab('write');
    } else {
      setActiveTab('entries');
    }
  };

  // Navigate to chat with entry context
  const handleStartChatWithEntry = (entry: JournalEntry) => {
    setChatContextText(`[Journal: "${entry.title}"]\n${entry.content}`);
    setActiveTab('chat');
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col selection:bg-amber-100 selection:text-amber-900">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
        }}
        user={user}
        onSignOut={onSignOut}
        entryCount={entries.length}
        memoryCount={memories.length}
      />

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 flex-1">
        {/* Global Error Notice if any */}
        {globalError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs sm:text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{globalError}</span>
            </div>
            <button
              onClick={() => {
                fetchEntries();
                fetchMemories();
              }}
              className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 cursor-pointer"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* The Personal Memory System: Unified Journey Flow - Shown only on Main Write Entry page */}
        {activeTab === 'write' && (
          <section
            aria-label="The Personal Memory System"
            className="mb-8 p-4 sm:p-5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs"
          >
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-3.5 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                  The Personal Memory System
                </h3>
              </div>
              <p className="text-xs text-stone-500 font-medium sm:text-right">
                Turn your journal into a memory you can question, understand, and revisit.
              </p>
            </div>

            {/* Four Visually Distinct Inner Stage Boxes with External Connectors */}
            <div className="pt-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
              {/* Stage 1: Remember */}
              <div className="flex-1 bg-stone-50/70 border border-stone-200/80 rounded-xl p-3 sm:p-3.5 flex flex-col justify-start min-w-0 md:min-h-[104px]">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-900 text-white font-bold text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
                    1
                  </span>
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Remember
                  </h4>
                </div>
                <p className="text-xs text-stone-500 font-normal leading-relaxed mt-2 pl-7">
                  Capture goals, decisions, ideas, lessons, and events.
                </p>
              </div>

              {/* Arrow Connector 1 */}
              <div className="hidden md:flex items-center justify-center text-stone-300 shrink-0 px-0.5">
                <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
              </div>
              <div className="flex md:hidden items-center justify-center text-stone-300 py-0.5">
                <ArrowDown className="w-3 h-3 text-stone-400" />
              </div>

              {/* Stage 2: Ask */}
              <div className="flex-1 bg-stone-50/70 border border-stone-200/80 rounded-xl p-3 sm:p-3.5 flex flex-col justify-start min-w-0 md:min-h-[104px]">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-900 text-white font-bold text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
                    2
                  </span>
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Ask
                  </h4>
                </div>
                <p className="text-xs text-stone-500 font-normal leading-relaxed mt-2 pl-7">
                  Question what your past self cared about or decided.
                </p>
              </div>

              {/* Arrow Connector 2 */}
              <div className="hidden md:flex items-center justify-center text-stone-300 shrink-0 px-0.5">
                <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
              </div>
              <div className="flex md:hidden items-center justify-center text-stone-300 py-0.5">
                <ArrowDown className="w-3 h-3 text-stone-400" />
              </div>

              {/* Stage 3: Understand */}
              <div className="flex-1 bg-stone-50/70 border border-stone-200/80 rounded-xl p-3 sm:p-3.5 flex flex-col justify-start min-w-0 md:min-h-[104px]">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-900 text-white font-bold text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
                    3
                  </span>
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Understand
                  </h4>
                </div>
                <p className="text-xs text-stone-500 font-normal leading-relaxed mt-2 pl-7">
                  Compare past intentions with later actions.
                </p>
              </div>

              {/* Arrow Connector 3 */}
              <div className="hidden md:flex items-center justify-center text-stone-300 shrink-0 px-0.5">
                <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
              </div>
              <div className="flex md:hidden items-center justify-center text-stone-300 py-0.5">
                <ArrowDown className="w-3 h-3 text-stone-400" />
              </div>

              {/* Stage 4: Evolve */}
              <div className="flex-1 bg-stone-50/70 border border-stone-200/80 rounded-xl p-3 sm:p-3.5 flex flex-col justify-start min-w-0 md:min-h-[104px]">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-900 text-white font-bold text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
                    4
                  </span>
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Evolve
                  </h4>
                </div>
                <p className="text-xs text-stone-500 font-normal leading-relaxed mt-2 pl-7">
                  Trace how your goals and ideas changed over time.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Dynamic Views */}
        {activeTab === 'write' && (
          <div>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-2xl sm:text-3xl font-serif font-semibold text-stone-900 tracking-tight">
                  {activeEntryToEdit ? 'Edit Reflection' : 'Daily Journal Studio'}
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                  Record your thoughts, capture important memories, and build your personal history.
                </p>
              </div>

              {activeEntryToEdit && (
                <button
                  onClick={() => setActiveEntryToEdit(null)}
                  className="self-start sm:self-auto px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start New Blank Entry</span>
                </button>
              )}
            </div>

            <JournalEditor
              userId={user.uid}
              initialEntry={activeEntryToEdit}
              onSaveEntry={handleSaveEntry}
              onSaveMemory={handleSaveMemory}
              onClearActiveEntry={() => setActiveEntryToEdit(null)}
              onNavigateToChatWithContext={(ctx) => {
                setChatContextText(ctx);
                setActiveTab('chat');
              }}
              onNavigateToMemories={(memId) => {
                if (memId) setHighlightedMemoryId(memId);
                setActiveTab('memories');
              }}
              devPreviewMemories={memories}
            />
          </div>
        )}

        {activeTab === 'entries' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-serif font-semibold text-stone-900 tracking-tight">
                Journal History &amp; Memory Stream
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                Browse through your raw journal reflections, private and isolated to your account.
              </p>
            </div>

            {isLoadingEntries ? (
              <div className="bg-white rounded-2xl border border-stone-200/90 p-12 flex flex-col items-center justify-center text-center">
                <RefreshCw className="w-6 h-6 text-amber-600 animate-spin mb-3" />
                <p className="text-xs text-stone-500 font-medium">
                  Loading your private journal documents from Firestore...
                </p>
              </div>
            ) : (
              <JournalList
                userId={user.uid}
                entries={entries}
                onSelectEdit={handleSelectEdit}
                onDeleteEntry={handleDeleteEntry}
                onStartChatWithEntry={handleStartChatWithEntry}
                onSaveMemory={handleSaveMemory}
                onNavigateToMemories={(memId) => {
                  if (memId) setHighlightedMemoryId(memId);
                  setActiveTab('memories');
                }}
                onNavigateToWrite={() => {
                  setActiveEntryToEdit(null);
                  setActiveTab('write');
                }}
              />
            )}
          </div>
        )}

        {activeTab === 'memories' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-serif font-semibold text-stone-900 tracking-tight">
                Structured Memory Vault
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                Important goals, decisions, lessons, and realizations explicitly preserved from your writing. Ask My Past Self reasons directly over this vault.
              </p>
            </div>

            {isLoadingMemories ? (
              <div className="bg-white rounded-2xl border border-stone-200/90 p-12 flex flex-col items-center justify-center text-center">
                <RefreshCw className="w-6 h-6 text-amber-600 animate-spin mb-3" />
                <p className="text-xs text-stone-500 font-medium">
                  Loading your structured memories from Firestore...
                </p>
              </div>
            ) : (
              <MemoryList
                memories={memories}
                onDeleteMemory={handleDeleteMemory}
                onSelectJournalEntry={handleViewSourceEntry}
                highlightedMemoryId={highlightedMemoryId}
                onNavigateToWrite={() => {
                  setActiveEntryToEdit(null);
                  setActiveTab('write');
                }}
              />
            )}
          </div>
        )}

        {activeTab === 'ask' && (
          <div>
            <AskPastSelf
              user={user}
              devPreviewMemories={memories}
              onSelectJournalEntry={handleViewSourceEntry}
              onNavigateToWrite={() => {
                setActiveEntryToEdit(null);
                setActiveTab('write');
              }}
              onNavigateToMemories={() => setActiveTab('memories')}
            />
          </div>
        )}

        {activeTab === 'chat' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-serif font-semibold text-stone-900 tracking-tight">
                Gemini Conversational Dialogue
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                Engage in a thoughtful, empathetic dialogue with Gemini to unpack ideas and plan ahead.
              </p>
            </div>

            <GeminiReflector
              userId={user.uid}
              entries={entries}
              initialContextText={chatContextText}
              onSaveInteraction={handleSaveInteraction}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200/80 py-4 text-center text-xs text-stone-500 bg-white/40">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Ask My Past Self &bull; User Session: <span className="font-mono">{user.email}</span></span>
          <span className="text-stone-400">Strict Owner Isolation &bull; Firebase Rules Active</span>
        </div>
      </footer>
    </div>
  );
};
