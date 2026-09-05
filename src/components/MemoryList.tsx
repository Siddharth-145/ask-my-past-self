import React, { useState, useMemo, useEffect } from 'react';
import {
  Bookmark,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  Target,
  GitCommit,
  Lightbulb,
  Compass,
  Calendar,
  Zap,
  Heart,
  Tag,
  Clock,
  Sparkles,
  BookOpen,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Memory, MemoryType } from '../types';
import { MEMORY_TYPE_CONFIG } from './MemoryCaptureModal';
import { PersonalJourneyModal } from './PersonalJourneyModal';

interface MemoryListProps {
  memories: Memory[];
  onDeleteMemory: (memoryId: string) => Promise<boolean>;
  onSelectJournalEntry?: (entryId: string) => void;
  onNavigateToWrite?: () => void;
  highlightedMemoryId?: string | null;
}

export const MemoryList: React.FC<MemoryListProps> = ({
  memories,
  onDeleteMemory,
  onSelectJournalEntry,
  onNavigateToWrite,
  highlightedMemoryId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedImportance, setSelectedImportance] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'importance'>('newest');
  const [activeMemoryDetail, setActiveMemoryDetail] = useState<Memory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [journeySeedMemory, setJourneySeedMemory] = useState<Memory | null>(null);

  // Auto-reveal highlighted memory if requested from insight card or past self
  useEffect(() => {
    if (highlightedMemoryId) {
      const target = memories.find((m) => m.id === highlightedMemoryId);
      if (target) {
        setActiveMemoryDetail(target);
      }
    }
  }, [highlightedMemoryId, memories]);

  // Filter & Search
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      // Type filter
      if (selectedType !== 'ALL' && m.type !== selectedType) {
        return false;
      }
      // Importance filter
      if (selectedImportance !== 'ALL' && m.importance !== selectedImportance) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = m.title.toLowerCase().includes(query);
        const matchesSummary = m.summary.toLowerCase().includes(query);
        const matchesTags = m.tags.some((t) => t.toLowerCase().includes(query));
        const matchesBullets = m.metadata?.keyTakeaways?.some((b) => b.toLowerCase().includes(query));
        const matchesAction = m.metadata?.actionItem?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesSummary && !matchesTags && !matchesBullets && !matchesAction) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') return b.createdAt - a.createdAt;
      if (sortBy === 'oldest') return a.createdAt - b.createdAt;
      if (sortBy === 'importance') {
        const score = (lvl: string) => (lvl === 'high' ? 3 : lvl === 'medium' ? 2 : 1);
        return score(b.importance) - score(a.importance);
      }
      return 0;
    });
  }, [memories, selectedType, selectedImportance, searchTerm, sortBy]);

  // Memory Type Counts for filter badges
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: memories.length };
    memories.forEach((m) => {
      counts[m.type] = (counts[m.type] || 0) + 1;
    });
    return counts;
  }, [memories]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to remove this preserved memory?')) {
      setDeletingId(id);
      await onDeleteMemory(id);
      setDeletingId(null);
      if (activeMemoryDetail?.id === id) {
        setActiveMemoryDetail(null);
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(timestamp));
  };

  return (
    <div className="space-y-6">
      {/* Header & Metric Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-serif font-semibold text-stone-900 flex items-center gap-2">
            <span>Captured Memories</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 border border-stone-200 text-stone-700 font-sans font-medium">
              {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Structured goals, realizations, lessons, and decisions distilled from your journal reflections.
          </p>
        </div>

        {onNavigateToWrite && (
          <button
            onClick={onNavigateToWrite}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium shadow-xs transition-all cursor-pointer self-start sm:self-auto"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Capture from New Entry</span>
          </button>
        )}
      </div>

      {/* Memory Vault Relationship Explainer */}
      <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5">
          <Bookmark className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
          <span className="leading-relaxed">
            <strong>How Vault Memories work:</strong> While Journal Entries capture raw daily reflections, Memories are the important goals, decisions, and lessons you explicitly preserve. <em>Ask My Past Self</em> queries and reasons directly over this vault.
          </span>
        </div>
      </div>

      {/* Filter Bar & Controls */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3.5">
        {/* Search & Sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search memories by title, lesson, keyword, or tag..."
              className="w-full pl-9 pr-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700 focus:outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="importance">Highest Importance</option>
            </select>
          </div>
        </div>

        {/* Category / Type Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedType('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
              selectedType === 'ALL'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            All Types ({typeCounts.ALL || 0})
          </button>
          {(Object.keys(MEMORY_TYPE_CONFIG) as MemoryType[]).map((t) => {
            const count = typeCounts[t] || 0;
            const cfg = MEMORY_TYPE_CONFIG[t];
            const isSelected = selectedType === t;
            return (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer border ${
                  isSelected
                    ? `${cfg.bg} ${cfg.border} ${cfg.color} font-semibold ring-1 ring-stone-900/10`
                    : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                <span>{cfg.label}</span>
                <span className="text-[10px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Importance Filter */}
        <div className="flex items-center gap-2 pt-1 text-xs text-stone-500">
          <span className="text-[11px] font-medium text-stone-600">Importance:</span>
          {['ALL', 'high', 'medium', 'low'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedImportance(lvl)}
              className={`px-2 py-0.5 rounded-md capitalize transition-all cursor-pointer text-[11px] ${
                selectedImportance === lvl
                  ? 'bg-stone-200 font-semibold text-stone-900'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Cards Grid */}
      {filteredMemories.length === 0 ? (
        <div className="py-16 bg-white border border-stone-200 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-700">
            <Bookmark className="w-6 h-6" />
          </div>
          <h3 className="font-serif text-base font-semibold text-stone-900">
            {memories.length === 0 ? 'No Memories Captured Yet' : 'No Matching Memories Found'}
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {memories.length === 0
              ? 'When writing or reading a journal entry, click "Remember This" or "Save as Memory" to distill key goals, realizations, and lessons.'
              : 'Try clearing your search query or selecting a different memory category.'}
          </p>
          {memories.length === 0 && onNavigateToWrite && (
            <button
              onClick={onNavigateToWrite}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-medium hover:bg-stone-800 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Write an Entry to Capture Memories</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMemories.map((m) => {
            const typeConfig = MEMORY_TYPE_CONFIG[m.type] || MEMORY_TYPE_CONFIG.Realization;
            const TypeIcon = typeConfig.icon;
            const isDeleting = deletingId === m.id;

            return (
              <div
                key={m.id}
                onClick={() => setActiveMemoryDetail(m)}
                className="bg-white border border-stone-200 hover:border-stone-300 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group cursor-pointer relative"
              >
                <div className="space-y-3">
                  {/* Card Top: Type Badge & Date */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${typeConfig.bg} ${typeConfig.color} ${typeConfig.border}`}
                      >
                        <TypeIcon className="w-3.5 h-3.5" />
                        <span>{typeConfig.label}</span>
                      </span>

                      {m.importance === 'high' && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-semibold uppercase tracking-wider">
                          High Priority
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-stone-400 text-xs">
                      <span className="text-[11px] text-stone-500">{formatDate(m.createdAt)}</span>
                      <button
                        onClick={(e) => handleDelete(e, m.id)}
                        disabled={isDeleting}
                        title="Delete memory"
                        className="p-1 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-serif text-base font-semibold text-stone-900 group-hover:text-stone-800 leading-snug">
                    {m.title}
                  </h3>

                  {/* Summary */}
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed line-clamp-3">
                    {m.summary}
                  </p>

                  {/* Key Takeaways preview if available */}
                  {m.metadata?.keyTakeaways && m.metadata.keyTakeaways.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100 space-y-1">
                      <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
                        Key Insight:
                      </span>
                      <p className="text-xs text-stone-700 italic">
                        &ldquo;{m.metadata.keyTakeaways[0]}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Action Item if present */}
                  {m.metadata?.actionItem && (
                    <div className="flex items-start gap-1.5 text-xs text-emerald-800 bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-medium">{m.metadata.actionItem}</span>
                    </div>
                  )}
                </div>

                {/* Card Bottom: Tags, Journey Action & Source Journal Entry Link */}
                <div className="pt-4 mt-3 border-t border-stone-100 flex items-center justify-between text-xs gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {m.tags.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 text-[10px] font-medium"
                      >
                        #{t}
                      </span>
                    ))}
                    {m.tags.length > 2 && (
                      <span className="text-[10px] text-stone-400">+{m.tags.length - 2}</span>
                    )}

                    {/* View Journey Action Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setJourneySeedMemory(m);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer"
                      title="See how this goal, idea, or decision evolved over time"
                    >
                      <Compass className="w-3 h-3 text-amber-600" />
                      <span>View Journey</span>
                    </button>
                  </div>

                  {m.sourceJournalEntryId && onSelectJournalEntry && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectJournalEntry(m.sourceJournalEntryId!);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-900 font-medium group/link cursor-pointer ml-auto"
                    >
                      <BookOpen className="w-3 h-3 text-stone-400 group-hover/link:text-stone-700" />
                      <span className="truncate max-w-[120px]">
                        {m.sourceJournalTitle || 'Journal Entry'}
                      </span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Memory Detail Modal */}
      {activeMemoryDetail && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
              <div className="flex items-center gap-2">
                {(() => {
                  const cfg = MEMORY_TYPE_CONFIG[activeMemoryDetail.type] || MEMORY_TYPE_CONFIG.Realization;
                  const Icon = cfg.icon;
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cfg.label}</span>
                    </span>
                  );
                })()}
                <span className="text-xs text-stone-400">
                  {formatDate(activeMemoryDetail.createdAt)}
                </span>
              </div>
              <button
                onClick={() => setActiveMemoryDetail(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <h3 className="font-serif text-lg font-semibold text-stone-900 leading-snug">
                {activeMemoryDetail.title}
              </h3>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
                <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                  Distilled Memory Summary
                </span>
                <p className="text-xs sm:text-sm text-stone-800 leading-relaxed">
                  {activeMemoryDetail.summary}
                </p>
              </div>

              {activeMemoryDetail.metadata?.keyTakeaways &&
                activeMemoryDetail.metadata.keyTakeaways.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-stone-700">Key Takeaways:</span>
                    <ul className="space-y-1.5">
                      {activeMemoryDetail.metadata.keyTakeaways.map((point, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-stone-700 p-2 rounded-lg bg-stone-50 border border-stone-100 flex items-start gap-2"
                        >
                          <span className="text-amber-600 font-bold">&bull;</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {activeMemoryDetail.metadata?.actionItem && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <span className="font-semibold block flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Actionable Next Step:
                  </span>
                  <p>{activeMemoryDetail.metadata.actionItem}</p>
                </div>
              )}

              {activeMemoryDetail.metadata?.reasoning && (
                <div className="text-[11px] text-stone-500 italic">
                  Categorization context: {activeMemoryDetail.metadata.reasoning}
                </div>
              )}

              {/* Tags */}
              <div className="flex items-center gap-1.5 flex-wrap pt-2">
                <Tag className="w-3.5 h-3.5 text-stone-400" />
                {activeMemoryDetail.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-xs font-medium"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const seed = activeMemoryDetail;
                    setActiveMemoryDetail(null);
                    setJourneySeedMemory(seed);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300/80 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-amber-600" />
                  <span>See How This Evolved</span>
                </button>

                {activeMemoryDetail.sourceJournalEntryId && onSelectJournalEntry ? (
                  <button
                    onClick={() => {
                      const id = activeMemoryDetail.sourceJournalEntryId!;
                      setActiveMemoryDetail(null);
                      onSelectJournalEntry(id);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-medium cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-stone-500" />
                    <span>Open Journal</span>
                  </button>
                ) : (
                  <span className="text-xs text-stone-400">Direct Memory Capture</span>
                )}
              </div>

              <button
                onClick={() => setActiveMemoryDetail(null)}
                className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-medium hover:bg-stone-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Personal Journey / Evolution Modal */}
      {journeySeedMemory && (
        <PersonalJourneyModal
          seedMemory={journeySeedMemory}
          allMemories={memories}
          onClose={() => setJourneySeedMemory(null)}
          onSelectMemory={(id) => {
            setJourneySeedMemory(null);
            const target = memories.find((m) => m.id === id);
            if (target) {
              setActiveMemoryDetail(target);
            }
          }}
          onSelectJournalEntry={(journalId) => {
            setJourneySeedMemory(null);
            if (onSelectJournalEntry) {
              onSelectJournalEntry(journalId);
            }
          }}
        />
      )}
    </div>
  );
};
