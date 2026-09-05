import React, { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  Tag,
  Trash2,
  Edit3,
  MessageSquare,
  Sparkles,
  ChevronRight,
  BookOpen,
  Filter,
  X,
  Clock,
  Shield,
  Bookmark,
  Sprout,
  Zap,
  GitBranch,
} from 'lucide-react';
import Markdown from 'react-markdown';
import type { JournalEntry, Memory } from '../types';
import { MemoryCaptureModal } from './MemoryCaptureModal';
import { GrowthTensionCard } from './GrowthTensionCard';

interface JournalListProps {
  userId: string;
  entries: JournalEntry[];
  onSelectEdit: (entry: JournalEntry) => void;
  onDeleteEntry: (entryId: string) => Promise<boolean>;
  onStartChatWithEntry: (entry: JournalEntry) => void;
  onNavigateToWrite: () => void;
  onSaveMemory?: (memory: Memory) => Promise<boolean>;
  onNavigateToMemories?: (selectedMemoryId?: string) => void;
}

export const JournalList: React.FC<JournalListProps> = ({
  userId,
  entries,
  onSelectEdit,
  onDeleteEntry,
  onStartChatWithEntry,
  onNavigateToWrite,
  onSaveMemory,
  onNavigateToMemories,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [activeEntryModal, setActiveEntryModal] = useState<JournalEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [entryForMemory, setEntryForMemory] = useState<JournalEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => e.tags?.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [entries]);

  // Extract all unique moods
  const allMoods = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.mood) set.add(e.mood);
    });
    return Array.from(set);
  }, [entries]);

  // Filtered & sorted entries
  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        const matchesQuery =
          !searchQuery ||
          entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesMood = selectedMood === 'all' || entry.mood === selectedMood;
        const matchesTag = selectedTag === 'all' || entry.tags?.includes(selectedTag);

        return matchesQuery && matchesMood && matchesTag;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [entries, searchQuery, selectedMood, selectedTag]);

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    const success = await onDeleteEntry(entryToDelete);
    setIsDeleting(false);
    if (success) {
      if (activeEntryModal?.id === entryToDelete) {
        setActiveEntryModal(null);
      }
      setEntryToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="search-entries-input"
            type="text"
            placeholder="Search past memories, reflections, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200/80 rounded-xl text-xs sm:text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mood Filter */}
          <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200/80 px-2.5 py-1.5 rounded-xl text-xs">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <select
              id="filter-mood-select"
              value={selectedMood}
              onChange={(e) => setSelectedMood(e.target.value)}
              className="bg-transparent border-none text-stone-700 font-medium focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">All Moods</option>
              {allMoods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200/80 px-2.5 py-1.5 rounded-xl text-xs">
              <Tag className="w-3.5 h-3.5 text-stone-400" />
              <select
                id="filter-tag-select"
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="bg-transparent border-none text-stone-700 font-medium focus:outline-none cursor-pointer text-xs"
              >
                <option value="all">All Tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={onNavigateToWrite}
            className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-medium transition-colors shadow-2xs cursor-pointer ml-auto"
          >
            + New Entry
          </button>
        </div>
      </div>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200/90 p-12 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 mb-4">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-stone-900 mb-1">
            {searchQuery || selectedMood !== 'all' || selectedTag !== 'all'
              ? 'No matching journal entries found'
              : 'No journal entries yet'}
          </h3>
          <p className="text-stone-500 text-xs sm:text-sm max-w-sm mb-6">
            {searchQuery || selectedMood !== 'all' || selectedTag !== 'all'
              ? 'Try adjusting your search criteria or resetting filters.'
              : 'Begin your personal reflective journal today. Capture thoughts and build your memory timeline.'}
          </p>
          <button
            onClick={onNavigateToWrite}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs sm:text-sm font-medium transition-all shadow-xs cursor-pointer"
          >
            Write Your First Journal Entry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEntries.map((entry) => {
            const dateStr = new Date(entry.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const timeStr = new Date(entry.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={entry.id}
                id={`journal-card-${entry.id}`}
                className="bg-white rounded-2xl border border-stone-200/80 hover:border-stone-300 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Card Meta */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 text-[11px] text-stone-500 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-stone-400" />
                      <span>{dateStr}</span>
                      <span>&bull;</span>
                      <span>{timeStr}</span>
                    </div>

                    {entry.mood && (
                      <span className="px-2 py-0.5 rounded-full bg-stone-100 border border-stone-200/60 text-[11px] font-medium text-stone-700">
                        {entry.mood}
                      </span>
                    )}
                  </div>

                  {/* Title & Preview */}
                  <h3
                    onClick={() => setActiveEntryModal(entry)}
                    className="font-serif text-lg text-stone-900 font-semibold group-hover:text-amber-900 transition-colors line-clamp-1 cursor-pointer"
                  >
                    {entry.title}
                  </h3>

                  <p
                    onClick={() => setActiveEntryModal(entry)}
                    className="mt-2 text-stone-600 text-xs sm:text-sm line-clamp-3 leading-relaxed cursor-pointer font-normal"
                  >
                    {entry.content}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {entry.tags?.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-medium"
                      >
                        #{t}
                      </span>
                    ))}
                    {entry.tags && entry.tags.length > 2 && (
                      <span className="text-[10px] text-stone-400">
                        +{entry.tags.length - 2}
                      </span>
                    )}
                    {entry.aiReflection && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-50 text-amber-800 border border-amber-200/60 px-1.5 py-0.5 rounded-md font-medium">
                        <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                        AI Reflected
                      </span>
                    )}
                    {entry.growthTensionInsight && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${
                          entry.growthTensionInsight.relationship === 'reinforces'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200/70'
                            : entry.growthTensionInsight.relationship === 'contradicts'
                            ? 'bg-amber-50 text-amber-900 border-amber-200/70'
                            : 'bg-sky-50 text-sky-900 border-sky-200/70'
                        }`}
                      >
                        {entry.growthTensionInsight.relationship === 'reinforces' ? (
                          <Sprout className="w-2.5 h-2.5 text-emerald-600" />
                        ) : entry.growthTensionInsight.relationship === 'contradicts' ? (
                          <Zap className="w-2.5 h-2.5 text-amber-600" />
                        ) : (
                          <GitBranch className="w-2.5 h-2.5 text-sky-600" />
                        )}
                        <span>
                          {entry.growthTensionInsight.relationship === 'reinforces'
                            ? 'Growth'
                            : entry.growthTensionInsight.relationship === 'contradicts'
                            ? 'Tension'
                            : 'Pattern'}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {onSaveMemory && (
                      <button
                        onClick={() => setEntryForMemory(entry)}
                        title="Capture as Memory (Goals, Lessons, Realizations)"
                        className="p-1.5 text-stone-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onStartChatWithEntry(entry)}
                      title="Reflect with Gemini"
                      className="p-1.5 text-stone-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onSelectEdit(entry)}
                      title="Edit Entry"
                      className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEntryToDelete(entry.id)}
                      title="Delete Entry"
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Entry Reader Modal */}
      {activeEntryModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-stone-100 flex items-start justify-between gap-3 bg-stone-50/60">
              <div>
                <div className="flex items-center gap-2 text-xs text-stone-500 font-medium mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(activeEntryModal.createdAt).toLocaleString()}</span>
                  {activeEntryModal.mood && (
                    <>
                      <span>&bull;</span>
                      <span className="font-semibold text-stone-700">{activeEntryModal.mood}</span>
                    </>
                  )}
                </div>
                <h2 className="text-xl font-serif font-semibold text-stone-900">
                  {activeEntryModal.title}
                </h2>
              </div>
              <button
                onClick={() => setActiveEntryModal(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Isolation verification pill */}
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/60 flex items-center justify-between text-xs text-stone-600">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>Protected &amp; Isolated to UID: <span className="font-mono text-[11px] text-stone-800">{activeEntryModal.userId.slice(0, 8)}...</span></span>
                </div>
                <span className="font-mono text-[11px]">{activeEntryModal.wordCount} words</span>
              </div>

              {/* Text content */}
              <div className="text-stone-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-normal">
                {activeEntryModal.content}
              </div>

              {/* Growth & Tension Proactive Insight Card */}
              {activeEntryModal.growthTensionInsight && (
                <GrowthTensionCard
                  insight={activeEntryModal.growthTensionInsight}
                  onViewMemory={(memId) => {
                    setActiveEntryModal(null);
                    if (onNavigateToMemories) {
                      onNavigateToMemories(memId);
                    }
                  }}
                />
              )}

              {/* Gemini Reflection Box if exists */}
              {activeEntryModal.aiReflection && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
                      Saved Gemini Reflection
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-stone-800 leading-relaxed prose prose-stone max-w-none">
                    <Markdown>{activeEntryModal.aiReflection}</Markdown>
                  </div>
                </div>
              )}

              {/* Tags */}
              {activeEntryModal.tags && activeEntryModal.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-stone-100">
                  <span className="text-xs text-stone-500 font-medium">Tags:</span>
                  {activeEntryModal.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md font-medium"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
              <button
                onClick={() => {
                  setEntryToDelete(activeEntryModal.id);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                {onSaveMemory && (
                  <button
                    onClick={() => {
                      const e = activeEntryModal;
                      setEntryForMemory(e);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Remember This</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    const e = activeEntryModal;
                    setActiveEntryModal(null);
                    onStartChatWithEntry(e);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Discuss with Gemini</span>
                </button>

                <button
                  onClick={() => {
                    const e = activeEntryModal;
                    setActiveEntryModal(null);
                    onSelectEdit(e);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit in Studio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {entryToDelete && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-900 text-base">Delete Journal Entry?</h3>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                This action is permanent and will remove the entry from your secure Firestore collection.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEntryToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium hover:bg-stone-100 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-entry-btn"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeleting && (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                <span>Delete Entry</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Memory Capture Modal */}
      {entryForMemory && onSaveMemory && (
        <MemoryCaptureModal
          userId={userId}
          sourceEntry={{
            id: entryForMemory.id,
            title: entryForMemory.title,
            content: entryForMemory.content,
          }}
          isOpen={!!entryForMemory}
          onClose={() => setEntryForMemory(null)}
          onSaveMemory={onSaveMemory}
          onNavigateToMemories={onNavigateToMemories}
        />
      )}
    </div>
  );
};
