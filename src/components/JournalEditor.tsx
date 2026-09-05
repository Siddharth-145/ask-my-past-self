import React, { useState, useEffect } from 'react';
import {
  Save,
  Sparkles,
  RefreshCw,
  Plus,
  X,
  Smile,
  Tag,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  FileText,
  Copy,
  ChevronDown,
  ChevronUp,
  Bookmark,
  ArrowRight,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { auth } from '../firebase';
import type { JournalEntry, Memory, GrowthTensionInsight } from '../types';
import { stripUndefined } from '../utils/sanitize';
import { MemoryCaptureModal } from './MemoryCaptureModal';
import { GrowthTensionCard } from './GrowthTensionCard';

interface JournalEditorProps {
  userId: string;
  initialEntry?: JournalEntry | null;
  onSaveEntry: (entry: JournalEntry) => Promise<boolean>;
  onSaveMemory?: (memory: Memory) => Promise<boolean>;
  onClearActiveEntry?: () => void;
  onNavigateToChatWithContext?: (contextText: string) => void;
  onNavigateToMemories?: (selectedMemoryId?: string) => void;
  devPreviewMemories?: Memory[];
}

const MOODS = [
  { label: 'Grateful', emoji: '✨' },
  { label: 'Calm', emoji: '🌿' },
  { label: 'Inspired', emoji: '💡' },
  { label: 'Reflective', emoji: '🌊' },
  { label: 'Energetic', emoji: '⚡' },
  { label: 'Overwhelmed', emoji: '🌧️' },
  { label: 'Focused', emoji: '🎯' },
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  userId,
  initialEntry,
  onSaveEntry,
  onSaveMemory,
  onClearActiveEntry,
  onNavigateToChatWithContext,
  onNavigateToMemories,
  devPreviewMemories,
}) => {
  const [id, setId] = useState<string>(initialEntry?.id || '');
  const [title, setTitle] = useState<string>(initialEntry?.title || '');
  const [content, setContent] = useState<string>(initialEntry?.content || '');
  const [mood, setMood] = useState<string>(initialEntry?.mood || 'Reflective');
  const [tags, setTags] = useState<string[]>(initialEntry?.tags || ['reflection']);
  const [tagInput, setTagInput] = useState<string>('');
  
  const [aiResult, setAiResult] = useState<string>(initialEntry?.aiReflection || '');
  const [aiMode, setAiMode] = useState<string>('reflection');
  const [aiModelUsed, setAiModelUsed] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState<boolean>(false);
  const [showMemoryModal, setShowMemoryModal] = useState<boolean>(false);

  // Proactive Growth & Tension Detection State
  const [growthTensionInsight, setGrowthTensionInsight] = useState<GrowthTensionInsight | null>(
    initialEntry?.growthTensionInsight || null
  );
  const [isDetectingInsight, setIsDetectingInsight] = useState<boolean>(false);

  // Sync if initialEntry changes from parent (e.g. user selected to edit an old entry)
  useEffect(() => {
    if (initialEntry) {
      setId(initialEntry.id);
      setTitle(initialEntry.title);
      setContent(initialEntry.content);
      setMood(initialEntry.mood || 'Reflective');
      setTags(initialEntry.tags || []);
      setAiResult(initialEntry.aiReflection || initialEntry.aiSummary || '');
      setGrowthTensionInsight(initialEntry.growthTensionInsight || null);
      setSaveStatus('idle');
      setErrorMessage(null);
    }
  }, [initialEntry]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  const handleAddTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (('key' in e && e.key === 'Enter') || e.type === 'click') {
      e.preventDefault();
      const cleaned = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (cleaned && !tags.includes(cleaned)) {
        setTags([...tags, cleaned]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async () => {
    if (!content.trim() && !title.trim()) {
      setErrorMessage('Please write a title or journal content before saving.');
      setSaveStatus('error');
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage(null);

    const now = Date.now();
    const entryId = id || `entry_${now}_${Math.random().toString(36).substring(2, 9)}`;

    const entryToSave: JournalEntry = {
      id: entryId,
      userId,
      title: title.trim() || `Journal Entry - ${new Date(now).toLocaleDateString()}`,
      content: content.trim(),
      mood: mood || undefined,
      tags: tags.length > 0 ? tags : ['journal'],
      createdAt: initialEntry?.createdAt || now,
      updatedAt: now,
      wordCount,
      aiReflection: aiResult || undefined,
      growthTensionInsight: growthTensionInsight || undefined,
      metadata: {
        formatVersion: 1,
        clientPlatform: 'web',
      },
    };

    const sanitized = stripUndefined(entryToSave);
    const success = await onSaveEntry(sanitized);

    setIsSaving(false);
    if (success) {
      setId(entryId);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 4000);

      // Asynchronously trigger Growth & Tension Detection without blocking the user
      setIsDetectingInsight(true);
      (async () => {
        try {
          const token = await auth.currentUser?.getIdToken();
          const detectRes = await fetch('/api/gemini/detect-growth-tension', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              journalEntryId: entryId,
              _devPreviewJournalEntry: sanitized,
              _devPreviewSessionMemories: devPreviewMemories,
            }),
          });

          if (detectRes.ok) {
            const detectData = await detectRes.json();
            if (detectData.success && detectData.insight) {
              setGrowthTensionInsight(detectData.insight);
            }
          }
        } catch (detectErr) {
          console.warn('[Growth & Tension Detection] Background detection error:', detectErr);
        } finally {
          setIsDetectingInsight(false);
        }
      })();
    } else {
      setSaveStatus('error');
      setErrorMessage('Failed to persist journal entry to Firestore. Please retry.');
    }
  };

  const handleCallGemini = async (mode: 'reflection' | 'prompt' | 'summary' | 'questions') => {
    if (mode !== 'prompt' && !content.trim()) {
      setErrorMessage('Please write some journal content before requesting Gemini reflections.');
      return;
    }

    setIsAiLoading(true);
    setAiError(null);
    setAiMode(mode);
    setShowAiPanel(true);

    try {
      const res = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryText: content.trim(),
          mode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to receive response from Gemini.');
      }

      setAiResult(data.result);
      setAiModelUsed(data.modelUsed || 'Gemini Flash');
    } catch (err: any) {
      console.error('AI Reflection Error:', err);
      setAiError(err.message || 'Error communicating with Gemini.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleClear = () => {
    if (content.trim() && !window.confirm('Clear the current editor? Any unsaved changes will be lost.')) {
      return;
    }
    setId('');
    setTitle('');
    setContent('');
    setMood('Reflective');
    setTags(['reflection']);
    setAiResult('');
    setGrowthTensionInsight(null);
    setIsDetectingInsight(false);
    setSaveStatus('idle');
    setErrorMessage(null);
    if (onClearActiveEntry) onClearActiveEntry();
  };

  const handleAppendAiToJournal = () => {
    if (!aiResult) return;
    const separator = '\n\n---\n**Gemini Reflection:**\n';
    setContent((prev) => prev + separator + aiResult);
  };

  return (
    <div className="space-y-6">
      {/* Action Banner / Notification */}
      {errorMessage && (
        <div
          id="editor-error-banner"
          className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start justify-between gap-3 text-sm"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Save Action Encountered an Issue</p>
              <p className="text-xs text-rose-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Retry Save
            </button>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 text-rose-600 hover:text-rose-800 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {saveStatus === 'success' && (
        <div
          id="editor-success-banner"
          className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">Journal entry successfully persisted to your private Firestore database.</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onSaveMemory && content.trim() && (
              <button
                id="post-save-remember-btn"
                onClick={() => setShowMemoryModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-medium transition-colors shadow-2xs cursor-pointer"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Distill into Memory</span>
              </button>
            )}
            <span className="text-xs text-emerald-600 font-mono">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      )}

      {/* Proactive Growth & Tension Detection Card or Analyzing Indicator */}
      {isDetectingInsight && (
        <div
          id="detecting-growth-tension-banner"
          className="p-3.5 bg-amber-50/70 border border-amber-200/80 text-amber-900 rounded-xl flex items-center justify-between text-xs animate-pulse"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
            <span className="font-medium">Comparing reflection against your past memories to identify growth or tension...</span>
          </div>
          <span className="text-[11px] text-amber-700 uppercase tracking-wider font-semibold">
            Proactive Reflection
          </span>
        </div>
      )}

      {growthTensionInsight && (
        <GrowthTensionCard
          insight={growthTensionInsight}
          onViewMemory={(memId) => {
            if (onNavigateToMemories) {
              onNavigateToMemories(memId);
            }
          }}
          onDismiss={() => setGrowthTensionInsight(null)}
        />
      )}

      {/* Main Journal Writing Box */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
        {/* Editor Header Bar */}
        <div className="p-4 sm:p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-50/50">
          <div className="flex-1">
            <input
              id="journal-title-input"
              type="text"
              placeholder="Title of this reflection or day..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xl sm:text-2xl font-serif text-stone-900 placeholder:text-stone-400 bg-transparent border-none focus:outline-none focus:ring-0 font-medium"
            />
            <p className="text-xs text-stone-500 mt-1 flex items-center gap-3">
              <span>{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span>&bull;</span>
              <span>{wordCount} words</span>
              <span>&bull;</span>
              <span>{charCount} characters</span>
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              id="clear-editor-btn"
              onClick={handleClear}
              className="px-3 py-1.5 rounded-lg border border-stone-300/80 bg-white hover:bg-stone-100 text-stone-600 text-xs font-medium transition-colors cursor-pointer"
            >
              New / Reset
            </button>

            {onSaveMemory && (
              <button
                id="remember-this-top-btn"
                type="button"
                onClick={() => {
                  if (!content.trim() && !title.trim()) {
                    setErrorMessage('Please write some content before distilling a memory.');
                    return;
                  }
                  setShowMemoryModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shadow-xs transition-all cursor-pointer"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Remember This</span>
              </button>
            )}

            <button
              id="save-journal-btn"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{id ? 'Update Entry' : 'Save Entry'}</span>
            </button>
          </div>
        </div>

        {/* Content Textarea */}
        <div className="p-4 sm:p-6">
          <textarea
            id="journal-content-textarea"
            rows={12}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your honest thoughts, memories, decisions, struggles, or breakthroughs here. This space is private, owner-isolated to your account, and ready for future retrospection..."
            className="w-full text-stone-800 text-base leading-relaxed placeholder:text-stone-400 bg-transparent border-none focus:outline-none resize-y font-normal"
          />
        </div>

        {/* Mood & Tags Section */}
        <div className="px-4 sm:px-6 py-4 bg-stone-50/70 border-t border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Mood Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs font-medium text-stone-500 mr-1">
              <Smile className="w-3.5 h-3.5" />
              <span>Mood:</span>
            </div>
            {MOODS.map((m) => (
              <button
                key={m.label}
                id={`mood-btn-${m.label.toLowerCase()}`}
                type="button"
                onClick={() => setMood(m.label)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  mood === m.label
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300'
                }`}
              >
                <span>{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs font-medium text-stone-500">
              <Tag className="w-3.5 h-3.5" />
              <span>Tags:</span>
            </div>
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-200/80 text-stone-700 text-xs font-medium"
              >
                #{t}
                <button
                  onClick={() => handleRemoveTag(t)}
                  className="hover:text-stone-950 p-0.5 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <div className="inline-flex items-center bg-white border border-stone-300/80 rounded-full px-2 py-0.5 text-xs">
              <input
                id="tag-input-field"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="add tag..."
                className="w-20 bg-transparent border-none focus:outline-none text-stone-800 text-xs"
              />
              <button
                onClick={handleAddTag}
                className="text-stone-500 hover:text-stone-800"
                title="Add tag"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Gemini AI Journaling Toolkit Toolbar */}
        <div className="p-4 sm:px-6 bg-amber-50/40 border-t border-amber-100/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-700" />
            <span className="text-xs font-semibold text-stone-800">Gemini Reflection Tools:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="ai-reflect-btn"
              onClick={() => handleCallGemini('reflection')}
              disabled={isAiLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-stone-50 border border-stone-300/80 text-stone-700 text-xs font-medium shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Reflect &amp; Elevate</span>
            </button>

            <button
              id="ai-prompt-btn"
              onClick={() => handleCallGemini('prompt')}
              disabled={isAiLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-stone-50 border border-stone-300/80 text-stone-700 text-xs font-medium shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
              <span>Get Prompts</span>
            </button>

            <button
              id="ai-summary-btn"
              onClick={() => handleCallGemini('summary')}
              disabled={isAiLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-stone-50 border border-stone-300/80 text-stone-700 text-xs font-medium shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>Summarize Themes</span>
            </button>

            {onNavigateToChatWithContext && content.trim() && (
              <button
                id="ai-chat-context-btn"
                onClick={() => onNavigateToChatWithContext(content)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shadow-xs transition-all cursor-pointer"
              >
                <span>Discuss in Dialogue &rarr;</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Gemini AI Output Panel */}
      {showAiPanel && (
        <div className="bg-white rounded-2xl border border-amber-200/90 shadow-xs overflow-hidden transition-all">
          <div className="p-4 bg-amber-50/70 border-b border-amber-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-700" />
              <h3 className="text-xs font-semibold text-stone-900 uppercase tracking-wider">
                Gemini {aiMode === 'prompt' ? 'Writing Prompts' : aiMode === 'summary' ? 'Thematic Summary' : 'Reflection'}
              </h3>
              {aiModelUsed && (
                <span className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-amber-200 text-amber-900 font-mono">
                  {aiModelUsed}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAiPanel(!showAiPanel)}
                className="p-1 text-stone-500 hover:text-stone-800 rounded-md"
              >
                {showAiPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowAiPanel(false)}
                className="p-1 text-stone-500 hover:text-stone-800 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {isAiLoading ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-stone-600 font-medium">
                  Connecting to Gemini fallback network and generating personal reflection...
                </p>
              </div>
            ) : aiError ? (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">AI Generation Failed</p>
                  <p className="mt-0.5">{aiError}</p>
                </div>
              </div>
            ) : aiResult ? (
              <div>
                <div className="text-stone-800 text-sm leading-relaxed prose prose-stone max-w-none">
                  <Markdown>{aiResult}</Markdown>
                </div>

                <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] text-stone-500">
                    Grounded with secure prompt isolation
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(aiResult);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                    {aiMode !== 'prompt' && (
                      <button
                        id="append-ai-journal-btn"
                        onClick={handleAppendAiToJournal}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Append to Journal Content</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Memory Capture Modal */}
      {showMemoryModal && onSaveMemory && (
        <MemoryCaptureModal
          userId={userId}
          sourceEntry={{
            id: id || undefined,
            title: title || 'Journal Entry',
            content: content || '',
          }}
          isOpen={showMemoryModal}
          onClose={() => setShowMemoryModal(false)}
          onSaveMemory={onSaveMemory}
          onNavigateToMemories={onNavigateToMemories}
        />
      )}
    </div>
  );
};
