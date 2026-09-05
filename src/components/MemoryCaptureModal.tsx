import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Bookmark,
  Target,
  GitCommit,
  Lightbulb,
  Compass,
  Calendar,
  Zap,
  Heart,
  Tag,
  Plus,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import type { Memory, MemoryType, JournalEntry } from '../types';

interface MemoryCaptureModalProps {
  userId: string;
  sourceEntry: {
    id?: string;
    title: string;
    content: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSaveMemory: (memory: Memory) => Promise<boolean>;
  onNavigateToMemories?: () => void;
}

export const MEMORY_TYPE_CONFIG: Record<
  MemoryType,
  { label: string; description: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string }
> = {
  Goal: {
    label: 'Goal',
    description: 'An aspiration, milestone, or target for the future',
    icon: Target,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  Decision: {
    label: 'Decision',
    description: 'A choice made or fork in the road resolved',
    icon: GitCommit,
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
  Idea: {
    label: 'Idea',
    description: 'A creative spark, concept, or project hypothesis',
    icon: Lightbulb,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  Lesson: {
    label: 'Lesson',
    description: 'A truth or principle learned from experience',
    icon: Compass,
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
  },
  Event: {
    label: 'Event',
    description: 'A milestone life moment or encounter',
    icon: Calendar,
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  Realization: {
    label: 'Realization',
    description: 'An epiphany, perspective shift, or breakthrough',
    icon: Zap,
    color: 'text-fuchsia-700',
    bg: 'bg-fuchsia-50',
    border: 'border-fuchsia-200',
  },
  Intention: {
    label: 'Intention',
    description: 'A mindset dedication, vow, or daily commitment',
    icon: Heart,
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
  },
};

export const MemoryCaptureModal: React.FC<MemoryCaptureModalProps> = ({
  userId,
  sourceEntry,
  isOpen,
  onClose,
  onSaveMemory,
  onNavigateToMemories,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [type, setType] = useState<MemoryType>('Realization');
  const [importance, setImportance] = useState<'low' | 'medium' | 'high'>('medium');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>([]);
  const [takeawayInput, setTakeawayInput] = useState<string>('');
  const [actionItem, setActionItem] = useState<string>('');
  const [reasoning, setReasoning] = useState<string>('');
  const [modelUsed, setModelUsed] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Extract memory using Gemini on open
  useEffect(() => {
    if (!isOpen) {
      setSaveSuccess(false);
      setError(null);
      return;
    }

    let isMounted = true;
    const fetchMemory = async () => {
      setIsLoading(true);
      setError(null);
      setSaveSuccess(false);

      try {
        const res = await fetch('/api/gemini/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entryText: sourceEntry.content,
            entryTitle: sourceEntry.title,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to extract memory from journal text.');
        }

        if (isMounted) {
          const m = data.memory;
          setTitle(m.title || sourceEntry.title || 'Extracted Memory');
          setSummary(m.summary || '');
          setType(m.type || 'Realization');
          setImportance(m.importance || 'medium');
          setTags(m.tags || ['memory']);
          setKeyTakeaways(m.keyTakeaways || []);
          setActionItem(m.actionItem || '');
          setReasoning(m.reasoning || '');
          setModelUsed(m.modelUsed || 'Gemini Flash');
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Memory Capture Error:', err);
          setError(err.message || 'Error generating structured memory.');
          // Provide friendly fallback defaults so user can still manually save
          setTitle(sourceEntry.title || 'Captured Reflection');
          setSummary(sourceEntry.content.slice(0, 200));
          setType('Realization');
          setTags(['reflection', 'journal']);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchMemory();

    return () => {
      isMounted = false;
    };
  }, [isOpen, sourceEntry.content, sourceEntry.title]);

  if (!isOpen) return null;

  const handleAddTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (('key' in e && e.key === 'Enter') || e.type === 'click') {
      e.preventDefault();
      const clean = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (clean && !tags.includes(clean)) {
        setTags([...tags, clean]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((item) => item !== t));
  };

  const handleAddTakeaway = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (('key' in e && e.key === 'Enter') || e.type === 'click') {
      e.preventDefault();
      const clean = takeawayInput.trim();
      if (clean) {
        setKeyTakeaways([...keyTakeaways, clean]);
        setTakeawayInput('');
      }
    }
  };

  const handleRemoveTakeaway = (index: number) => {
    setKeyTakeaways(keyTakeaways.filter((_, i) => i !== index));
  };

  const handleConfirmSave = async () => {
    if (!title.trim() || !summary.trim()) {
      setError('Please provide a title and summary for your memory.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const now = Date.now();
    const memoryId = `mem_${now}_${Math.random().toString(36).substring(2, 9)}`;

    const memoryPayload: Memory = {
      id: memoryId,
      userId,
      title: title.trim(),
      summary: summary.trim(),
      type,
      sourceJournalEntryId: sourceEntry.id || undefined,
      sourceJournalTitle: sourceEntry.title || undefined,
      createdAt: now,
      updatedAt: now,
      tags: tags.length > 0 ? tags : ['memory'],
      importance,
      metadata: {
        formatVersion: 1,
        clientPlatform: 'web',
        keyTakeaways: keyTakeaways.length > 0 ? keyTakeaways : undefined,
        actionItem: actionItem.trim() || undefined,
        reasoning: reasoning.trim() || undefined,
      },
    };

    const success = await onSaveMemory(memoryPayload);
    setIsSaving(false);

    if (success) {
      setSaveSuccess(true);
    } else {
      setError('Failed to persist memory document to Firestore. Please retry.');
    }
  };

  const TypeIcon = MEMORY_TYPE_CONFIG[type]?.icon || Zap;
  const typeStyle = MEMORY_TYPE_CONFIG[type] || MEMORY_TYPE_CONFIG.Realization;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-semibold text-stone-900 leading-tight">
                  Capture as Memory
                </h3>
                {modelUsed && (
                  <span className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-amber-200 text-amber-900 font-mono">
                    {modelUsed}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Distill this journal entry into a structured memory for your future self.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-sm font-medium text-stone-800">
                  Gemini is analyzing your journal entry...
                </p>
                <p className="text-xs text-stone-500 mt-1 max-w-xs">
                  Identifying key goals, lessons, decisions, or realizations with prompt-isolated security.
                </p>
              </div>
            </div>
          ) : saveSuccess ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-lg font-serif font-semibold text-stone-900">
                  Memory Preserved!
                </h4>
                <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-md">
                  Saved to your private <span className="font-mono text-stone-800">users/{userId.slice(0, 6)}.../memories</span> collection.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 text-left w-full max-w-md space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-stone-800">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] ${typeStyle.bg} ${typeStyle.color} ${typeStyle.border} border`}>
                    {type}
                  </span>
                  <span>{title}</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed line-clamp-2">
                  {summary}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                {onNavigateToMemories && (
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateToMemories();
                    }}
                    className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>View in Memories Vault</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-xl text-xs font-medium hover:bg-stone-50 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Note regarding memory extraction</p>
                    <p className="text-rose-700 mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Memory Type Badge Selection */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-2">
                  Memory Category / Archetype:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(MEMORY_TYPE_CONFIG) as MemoryType[]).map((t) => {
                    const cfg = MEMORY_TYPE_CONFIG[t];
                    const IconComponent = cfg.icon;
                    const isSelected = type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer ${
                          isSelected
                            ? `${cfg.bg} ${cfg.border} ${cfg.color} ring-1 ring-stone-900/10 shadow-xs font-semibold`
                            : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        <IconComponent className="w-4 h-4 shrink-0" />
                        <span className="truncate">{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-stone-500 mt-1.5 flex items-center gap-1.5">
                  <span className="font-medium text-stone-700">{type}:</span>
                  <span>{typeStyle.description}</span>
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Memory Headline:
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Committed to launch the new research project before Q3"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white"
                />
              </div>

              {/* Summary */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Core Distillation (1-3 Sentences):
                </label>
                <textarea
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="The concise takeaway that will be retrieved when you ask your past self..."
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white leading-relaxed resize-y"
                />
              </div>

              {/* Importance & Tags Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Importance */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Importance Level:
                  </label>
                  <div className="flex items-center gap-2">
                    {(['low', 'medium', 'high'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setImportance(lvl)}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-medium capitalize transition-all cursor-pointer ${
                          importance === lvl
                            ? lvl === 'high'
                              ? 'bg-rose-50 border-rose-300 text-rose-800 font-semibold'
                              : lvl === 'medium'
                              ? 'bg-amber-50 border-amber-300 text-amber-800 font-semibold'
                              : 'bg-stone-100 border-stone-300 text-stone-800 font-semibold'
                            : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Thematic Tags:
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-xs font-medium"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="hover:text-stone-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <div className="inline-flex items-center bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleAddTag}
                        placeholder="add tag..."
                        className="w-16 bg-transparent border-none focus:outline-none text-stone-800 text-xs"
                      />
                      <button type="button" onClick={handleAddTag} className="text-stone-400 hover:text-stone-700">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Takeaways */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Key Insights / Takeaway Bullets:
                </label>
                <div className="space-y-1.5 mb-2">
                  {keyTakeaways.map((bullet, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 bg-stone-50 border border-stone-200/80 rounded-lg text-xs text-stone-800"
                    >
                      <span className="flex-1">&bull; {bullet}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTakeaway(idx)}
                        className="text-stone-400 hover:text-stone-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={takeawayInput}
                    onChange={(e) => setTakeawayInput(e.target.value)}
                    onKeyDown={handleAddTakeaway}
                    placeholder="Add insight or realization..."
                    className="flex-1 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-800 focus:outline-none focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddTakeaway}
                    className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Add Point
                  </button>
                </div>
              </div>

              {/* Action Item if any */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Actionable Next Step (Optional):
                </label>
                <input
                  type="text"
                  value={actionItem}
                  onChange={(e) => setActionItem(e.target.value)}
                  placeholder="e.g. Schedule weekly review every Sunday evening"
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:bg-white"
                />
              </div>

              {/* Security Isolation Notice */}
              <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/60 flex items-center justify-between text-xs text-stone-600">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>
                    Linked to Journal: <span className="font-semibold text-stone-800 truncate max-w-[200px] inline-block align-bottom">{sourceEntry.title || 'Untitled Entry'}</span>
                  </span>
                </div>
                <span className="text-[11px] text-stone-500 font-mono">Owner Isolation Enforced</span>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!saveSuccess && (
          <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-stone-300 text-stone-700 rounded-xl text-xs font-medium hover:bg-stone-100 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              id="confirm-save-memory-btn"
              onClick={handleConfirmSave}
              disabled={isSaving || isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Bookmark className="w-3.5 h-3.5" />
              )}
              <span>Confirm &amp; Save Memory</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
