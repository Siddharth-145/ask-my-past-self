import React, { useState, useEffect } from 'react';
import {
  Compass,
  X,
  Sparkles,
  ArrowDown,
  RotateCw,
  Bookmark,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { auth } from '../firebase';
import type { Memory, PersonalJourney, JourneyStageType } from '../types';

interface PersonalJourneyModalProps {
  seedMemory: Memory;
  allMemories?: Memory[];
  onClose: () => void;
  onSelectMemory: (memoryId: string) => void;
  onSelectJournalEntry?: (journalEntryId: string) => void;
}

const STAGE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  intention: {
    label: 'Intention',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  exploration: {
    label: 'Exploration',
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  decision: {
    label: 'Decision',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  action: {
    label: 'Action',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  progress: {
    label: 'Progress',
    bg: 'bg-teal-50',
    text: 'text-teal-800',
    border: 'border-teal-200',
    dot: 'bg-teal-500',
  },
  reflection: {
    label: 'Reflection',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  other: {
    label: 'Phase',
    bg: 'bg-stone-100',
    text: 'text-stone-800',
    border: 'border-stone-200',
    dot: 'bg-stone-500',
  },
};

export const PersonalJourneyModal: React.FC<PersonalJourneyModalProps> = ({
  seedMemory,
  allMemories = [],
  onClose,
  onSelectMemory,
  onSelectJournalEntry,
}) => {
  const [journey, setJourney] = useState<PersonalJourney | null>(
    seedMemory.personalJourney || null
  );
  const [isLoading, setIsLoading] = useState<boolean>(!seedMemory.personalJourney);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJourney = async (force = false) => {
    if (force) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/gemini/personal-journey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          memoryId: seedMemory.id,
          forceRefresh: force,
          _devPreviewSessionMemories: allMemories,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.success === false) {
        const errObj = data && typeof data.error === 'object' ? data.error : null;
        const msg =
          errObj?.message ||
          (typeof data?.error === 'string' ? data.error : null) ||
          'Your evolution journey is temporarily unavailable. Please try again.';
        setError(msg);
        return;
      }

      if (data.success && data.journey) {
        setJourney(data.journey);
      } else {
        setError(data.error || 'Could not analyze evolution journey.');
      }
    } catch (err: any) {
      console.error('[Personal Journey] Fetch error:', err);
      setError('Something interrupted the evolution analysis. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!seedMemory.personalJourney) {
      fetchJourney(false);
    }
  }, [seedMemory.id]);

  return (
    <div
      id="personal-journey-modal-backdrop"
      className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        id="personal-journey-modal-container"
        className="bg-white rounded-2xl border border-stone-200 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                  Personal Journey
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100/70 text-amber-800 font-mono">
                  Evidence-Grounded
                </span>
              </div>
              <h2 className="font-serif text-base font-semibold text-stone-900 truncate max-w-md">
                {seedMemory.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchJourney(true)}
              disabled={isLoading || isRefreshing}
              title="Refresh Evolution Analysis"
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center mx-auto animate-pulse">
                <Compass className="w-6 h-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif text-base font-semibold text-stone-900">
                  Tracing Personal Evolution...
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Connecting related reflections chronologically and identifying evidence-grounded
                  milestones across your past self vault.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3">
              <div className="flex items-center gap-2 font-medium text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Could not establish personal journey</span>
              </div>
              <p className="text-xs text-rose-700">{error}</p>
              <button
                onClick={() => fetchJourney(true)}
                className="px-3 py-1.5 bg-rose-700 text-white rounded-lg text-xs font-medium hover:bg-rose-800 cursor-pointer"
              >
                Retry Analysis
              </button>
            </div>
          ) : !journey || !journey.hasJourney || journey.stages.length === 0 ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200 text-stone-500 flex items-center justify-center mx-auto">
                <Compass className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="font-serif text-base font-semibold text-stone-900">
                  Not enough evidence yet to show how this evolved
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  {journey?.summary ||
                    'An evolution journey requires at least two distinct, evidence-backed memories demonstrating how an intention, exploration, or decision developed over time.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-left max-w-md mx-auto space-y-2">
                <span className="text-[11px] font-semibold text-stone-700 uppercase tracking-wider block">
                  How Evolution is Discovered:
                </span>
                <ul className="text-xs text-stone-600 space-y-1.5 list-disc pl-4">
                  <li>Capture reflections as you revisit this topic in daily journals.</li>
                  <li>
                    The system strictly rejects fabricated stages and only connects documented
                    actions, lessons, and progress.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Journey Overview Card */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-base font-semibold text-stone-900">
                    {journey.title}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full font-medium">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    High Confidence
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-sans">
                  {journey.summary}
                </p>
              </div>

              {/* Chronological Stage Sequence */}
              <div className="space-y-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-3 px-1">
                  Chronological Milestones ({journey.stages.length} Stages)
                </div>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-stone-200">
                  {journey.stages.map((st, idx) => {
                    const cfg = STAGE_CONFIG[st.stage] || STAGE_CONFIG.other;
                    const isLast = idx === journey.stages.length - 1;

                    return (
                      <div key={`${st.memoryId}-${idx}`} className="relative group">
                        {/* Timeline Node Marker */}
                        <div
                          className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 border-white shadow-xs flex items-center justify-center ${cfg.dot}`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>

                        {/* Stage Card */}
                        <div className="bg-stone-50/80 hover:bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2.5 transition-all">
                          {/* Stage Header: Date & Stage Pill */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-stone-500" />
                                {st.date}
                              </span>
                              <span
                                className={`text-[11px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                              >
                                {cfg.label}
                              </span>
                            </div>

                            {/* Source Navigation Links */}
                            <div className="flex items-center gap-2">
                              <button
                                aria-label={`View memory for stage: ${st.headline}`}
                                onClick={() => {
                                  onClose();
                                  onSelectMemory(st.memoryId);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 hover:text-stone-950 bg-white border border-stone-200 hover:border-stone-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                <Bookmark className="w-3.5 h-3.5 text-amber-600" />
                                <span>View Memory</span>
                              </button>

                              {st.sourceJournalEntryId && onSelectJournalEntry && (
                                <button
                                  aria-label={`View source journal for stage: ${st.headline}`}
                                  onClick={() => {
                                    onClose();
                                    onSelectJournalEntry(st.sourceJournalEntryId!);
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 hover:text-stone-950 bg-white border border-stone-200 hover:border-stone-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                >
                                  <BookOpen className="w-3.5 h-3.5 text-stone-500" />
                                  <span>Source Journal</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Stage Headline */}
                          <h4 className="text-sm font-bold text-stone-900 leading-snug">
                            {st.headline}
                          </h4>

                          {/* Grounded Evidence Box */}
                          <div className="p-3 rounded-lg bg-white border border-stone-200/90 space-y-1">
                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                              Documented Evidence
                            </span>
                            <blockquote className="text-xs text-stone-800 italic border-l-2 border-amber-400 pl-2.5 leading-relaxed">
                              &ldquo;{st.evidence}&rdquo;
                            </blockquote>
                          </div>
                        </div>

                        {/* Down Arrow between stages */}
                        {!isLast && (
                          <div className="flex justify-center my-1.5 opacity-40">
                            <ArrowDown className="w-3.5 h-3.5 text-stone-400" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Overall Evolution Takeaway */}
              {journey.overallInsight && (
                <div className="p-4 rounded-xl bg-stone-900 text-stone-100 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-amber-300 font-semibold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Key Evolution Takeaway</span>
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed font-sans">
                    {journey.overallInsight}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Strictly grounded in your recorded memories &middot; Zero fabricated stages</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-medium hover:bg-stone-800 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
