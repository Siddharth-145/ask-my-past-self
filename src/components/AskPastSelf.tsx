import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import {
  Compass,
  Send,
  Loader2,
  BookOpen,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Tag,
  Target,
  CheckCircle2,
  Lightbulb,
  GraduationCap,
  Calendar,
  Zap,
  Bookmark,
  ArrowRight,
  RotateCcw,
  GitCompare,
  TrendingUp,
  MessageSquare,
  History,
  Clock,
} from 'lucide-react';
import { auth } from '../firebase';
import type { UserProfile, AskPastSelfResponse, EvidenceItem, Memory } from '../types';

interface AskPastSelfProps {
  user: UserProfile;
  /**
   * Non-production preview fallback memories.
   * STRICTLY used only in development/sandbox mode when the container lacks Cloud IAM credentials.
   * In production builds, this is never sent and the server retrieves solely from Firestore.
   */
  devPreviewMemories?: Memory[];
  onSelectJournalEntry: (entryId: string) => void;
  onNavigateToWrite: () => void;
  onNavigateToMemories: () => void;
}

const EXAMPLE_QUESTIONS = [
  'What were the things I wanted to improve?',
  'Did I actually make progress on my AI security goal?',
  'How did my goal to learn AI security evolve over time?',
  'Help me reflect on what I should prioritize next',
];

interface ErrorInfo {
  code: string;
  title: string;
  message: string;
  retryable: boolean;
  cooldownUntil?: number;
}

const LOADING_PHASES = [
  'Understanding your question...',
  'Searching your private memories...',
  'Analyzing historical evidence...',
  'Synthesizing grounded response...',
];

export const AskPastSelf: React.FC<AskPastSelfProps> = ({
  user,
  devPreviewMemories = [],
  onSelectJournalEntry,
  onNavigateToWrite,
  onNavigateToMemories,
}) => {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AskPastSelfResponse | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);

  const isSubmittingRef = React.useRef(false);
  const lastAttemptedQuestionRef = React.useRef<string>('');

  // Active cooldown countdown timer
  React.useEffect(() => {
    if (!errorInfo?.cooldownUntil) {
      setCooldownRemaining(0);
      return;
    }

    const checkCooldown = () => {
      const remaining = Math.ceil((errorInfo.cooldownUntil! - Date.now()) / 1000);
      if (remaining <= 0) {
        setCooldownRemaining(0);
      } else {
        setCooldownRemaining(remaining);
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 500);
    return () => clearInterval(interval);
  }, [errorInfo?.cooldownUntil]);

  // Rotate user-facing loading phases without revealing internal prompts or chain-of-thought
  React.useEffect(() => {
    if (!isLoading) {
      setLoadingPhaseIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setLoadingPhaseIndex((prev) => (prev + 1) % LOADING_PHASES.length);
    }, 1600);
    return () => clearInterval(timer);
  }, [isLoading]);

  const handleAsk = async (queryText?: string) => {
    const targetQuestion = (queryText !== undefined ? queryText : question).trim();
    if (!targetQuestion) return;

    // Concurrency protection: prevent duplicate submissions or rapid repeated clicks
    if (isSubmittingRef.current || isLoading) {
      return;
    }

    // Cooldown protection: prevent hammering while cooldown is active
    if (cooldownRemaining > 0) {
      return;
    }

    isSubmittingRef.current = true;
    lastAttemptedQuestionRef.current = targetQuestion;
    setIsLoading(true);
    setErrorInfo(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setErrorInfo({
          code: 'UNAUTHENTICATED',
          title: 'Sign-in required',
          message: 'You must be signed in to consult your past self.',
          retryable: false,
        });
        return;
      }

      // Cryptographically fetch fresh Firebase ID token
      const idToken = await currentUser.getIdToken();

      // In production, the client sends ONLY the question.
      // The backend is the authoritative source of truth, reading directly from Firestore.
      // In development mode, _devPreviewSessionMemories is passed strictly as a fallback shim for AI Studio Preview.
      const requestPayload: { question: string; _devPreviewSessionMemories?: Memory[] } = {
        question: targetQuestion,
      };

      const isDev = Boolean((import.meta as any).env?.DEV);
      if (isDev && devPreviewMemories && devPreviewMemories.length > 0) {
        requestPayload._devPreviewSessionMemories = devPreviewMemories;
      }

      const res = await fetch('/api/gemini/ask-past-self', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(requestPayload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.ok === false || data.success === false) {
        const errObj =
          data && typeof data.error === 'object' && data.error !== null
            ? data.error
            : null;

        let code = errObj?.code || (res.status === 429 ? 'AI_RATE_LIMITED' : 'AI_TEMPORARILY_UNAVAILABLE');
        let title = errObj?.title;
        let message = errObj?.message;
        let retryable = errObj?.retryable ?? true;
        let cooldownSeconds = errObj?.cooldownSeconds;

        if (code === 'AI_RATE_LIMITED' || res.status === 429) {
          code = 'AI_RATE_LIMITED';
          title = title || 'Gemini is temporarily busy';
          message =
            message ||
            "We've reached the current AI request limit. Your memories are safe. Please try again in a moment.";
          retryable = true;
          cooldownSeconds = cooldownSeconds || 5;
        } else if (
          code === 'AI_AUTH_OR_CONFIG_ERROR' ||
          res.status === 401 ||
          res.status === 403
        ) {
          title = title || 'AI service temporarily unavailable';
          message =
            message ||
            'The AI service is currently unavailable. Your memories are safe. Please try again later.';
          retryable = false;
        } else if (code === 'VALIDATION_ERROR' || res.status === 400) {
          title = title || 'Inquiry could not be processed';
          message =
            message || 'The request could not be processed. Please try rephrasing your inquiry.';
          retryable = false;
        } else {
          title = title || 'Your Past Self is temporarily unavailable';
          message =
            message ||
            'Something interrupted the AI response. Your memories are safe. Please try again.';
          retryable = true;
          cooldownSeconds = cooldownSeconds || 3;
        }

        setErrorInfo({
          code,
          title,
          message,
          retryable,
          cooldownUntil: cooldownSeconds ? Date.now() + cooldownSeconds * 1000 : undefined,
        });
        return;
      }

      // Successful, validated response received
      setErrorInfo(null);
      setResponse(data);
      if (!recentQueries.includes(targetQuestion)) {
        setRecentQueries((prev) => [targetQuestion, ...prev].slice(0, 5));
      }
    } catch (err: any) {
      console.error('Ask Past Self fetch error:', err);
      setErrorInfo({
        code: 'AI_TEMPORARILY_UNAVAILABLE',
        title: 'Your Past Self is temporarily unavailable',
        message:
          'Something interrupted the AI response. Your memories are safe. Please try again.',
        retryable: true,
        cooldownUntil: Date.now() + 3000,
      });
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAsk();
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'Goal':
        return <Target className="w-3.5 h-3.5 text-blue-600" />;
      case 'Decision':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case 'Idea':
        return <Lightbulb className="w-3.5 h-3.5 text-amber-600" />;
      case 'Lesson':
        return <GraduationCap className="w-3.5 h-3.5 text-purple-600" />;
      case 'Event':
        return <Calendar className="w-3.5 h-3.5 text-rose-600" />;
      case 'Realization':
        return <Zap className="w-3.5 h-3.5 text-indigo-600" />;
      case 'Intention':
        return <Bookmark className="w-3.5 h-3.5 text-teal-600" />;
      default:
        return <Bookmark className="w-3.5 h-3.5 text-stone-600" />;
    }
  };

  const getImportanceBadge = (importance?: string) => {
    switch (importance) {
      case 'high':
        return (
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            High Priority
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-stone-100 text-stone-700 border border-stone-200">
            Medium Priority
          </span>
        );
      case 'low':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-stone-50 text-stone-500 border border-stone-200">
            Low Priority
          </span>
        );
      default:
        return null;
    }
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            High Grounding Confidence
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Moderate Grounding
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-stone-100 text-stone-600 border border-stone-300">
            <HelpCircle className="w-3 h-3 text-stone-500" />
            Low or No Memory Overlap
          </span>
        );
    }
  };

  const isNoRelevantMemoryAnswer =
    response?.answer?.includes("couldn't find a relevant memory") ||
    response?.answer?.includes('no relevant memory was found') ||
    (response?.evidence?.length === 0 && response?.confidence === 'low');

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center shadow-sm">
              <Compass className="w-4.5 h-4.5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">
              Ask My Past Self
            </h1>
          </div>
          <p className="text-stone-600 text-sm md:text-base max-w-2xl">
            Ask questions about your past goals, decisions, lessons, ideas, and experiences. Answers are generated by Gemini and grounded strictly in your personal memory vault.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-stone-600 bg-stone-100 px-3 py-1.5 rounded-md border border-stone-200 self-start md:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Private & Owner-Isolated</span>
        </div>
      </div>

      {/* Question Input Card */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 md:p-6 shadow-xs space-y-4">
        <label
          htmlFor="past-self-question-input"
          className="block text-sm font-semibold text-stone-900"
        >
          Ask your past self anything about what you've written.
        </label>

        <div className="relative">
          <textarea
            id="past-self-question-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            maxLength={500}
            placeholder="e.g., Did I actually make progress on my AI security goal? Or what goals did I set for learning Rust?"
            className="w-full rounded-lg border border-stone-300 p-3.5 text-stone-900 placeholder:text-stone-400 text-base focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors resize-y min-h-[90px]"
            disabled={isLoading}
            aria-describedby="past-self-input-hint"
          />
          <div id="past-self-input-hint" className="flex justify-between items-center mt-1 text-xs text-stone-400">
            <span>Press Cmd+Enter or Ctrl+Enter to submit</span>
            <span>{question.length}/500</span>
          </div>
        </div>

        {/* 4 Reasoning Modes Guide */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 pb-1">
          <div className="p-2 rounded-lg bg-stone-50 border border-stone-200/60">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
              <History className="w-3.5 h-3.5 text-stone-600" />
              <span>Retrieve</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
              Search your recorded memories.
            </p>
          </div>
          <div className="p-2 rounded-lg bg-stone-50 border border-stone-200/60">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
              <GitCompare className="w-3.5 h-3.5 text-amber-600" />
              <span>Compare</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
              Compare earlier intentions with later actions.
            </p>
          </div>
          <div className="p-2 rounded-lg bg-stone-50 border border-stone-200/60">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Evolve</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
              Trace a goal or idea across time.
            </p>
          </div>
          <div className="p-2 rounded-lg bg-stone-50 border border-stone-200/60">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              <span>Reflect</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
              Think through a journal question.
            </p>
          </div>
        </div>

        {/* Suggestion Chips */}
        <div className="pt-1">
          <span className="text-xs font-medium text-stone-500 block mb-2">
            Suggested inquiries:
          </span>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                id={`btn-example-query-${idx}`}
                type="button"
                onClick={() => {
                  setQuestion(q);
                  handleAsk(q);
                }}
                disabled={isLoading}
                className="text-xs font-medium bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 px-3 py-1.5 rounded-full transition-colors cursor-pointer disabled:opacity-50 text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button Row */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-100">
          {question && (
            <button
              id="btn-clear-question"
              type="button"
              onClick={() => setQuestion('')}
              className="text-xs text-stone-500 hover:text-stone-800 transition-colors"
              disabled={isLoading}
            >
              Clear
            </button>
          )}

          <div className="ml-auto flex items-center gap-3">
            <button
              id="btn-ask-past-self-submit"
              type="button"
              onClick={() => handleAsk()}
              disabled={isLoading || !question.trim() || cooldownRemaining > 0}
              className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer shadow-xs disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Consulting Memories...</span>
                </>
              ) : cooldownRemaining > 0 ? (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Cooldown ({cooldownRemaining}s)</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Ask My Past Self</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Controlled, User-Friendly Error Card */}
      {errorInfo && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5 text-amber-800">
              {errorInfo.code === 'AI_RATE_LIMITED' ? (
                <Clock className="w-5 h-5 text-amber-700" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-700" />
              )}
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-stone-900 text-sm md:text-base">
                {errorInfo.title}
              </h4>
              <p className="text-stone-600 text-xs md:text-sm leading-relaxed max-w-xl">
                {errorInfo.message}
              </p>
              {cooldownRemaining > 0 && (
                <p className="text-xs font-medium text-amber-800 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Please wait {cooldownRemaining}s before retrying</span>
                </p>
              )}
            </div>
          </div>

          {errorInfo.retryable && (
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                id="btn-retry-query"
                type="button"
                onClick={() => handleAsk(lastAttemptedQuestionRef.current || question)}
                disabled={isLoading || cooldownRemaining > 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white text-xs md:text-sm font-semibold transition-colors cursor-pointer shadow-xs disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {cooldownRemaining > 0 ? `Try Again (${cooldownRemaining}s)` : 'Try Again'}
                </span>
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Loading Skeleton with Progressive User-Facing Stages */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-stone-200 p-8 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-700">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-semibold text-stone-900 text-base">
              {LOADING_PHASES[loadingPhaseIndex]}
            </h3>
            <p className="text-xs md:text-sm text-stone-500 max-w-md mx-auto">
              Scanning your verified private vault and requesting an evidence-grounded response from Gemini.
            </p>
          </div>
        </div>
      )}

      {/* Results View */}
      <AnimatePresence mode="wait">
        {response && !isLoading && (
          <motion.div
            key={response.answer}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Grounded Answer Card */}
            <div className="bg-white rounded-xl border border-stone-200 p-6 md:p-8 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-stone-900" />
                    <h2 className="text-lg font-bold text-stone-900">
                      Your Past Self's Answer
                    </h2>
                  </div>
                  {response.operationDescription && (
                    <p className="text-xs text-stone-500 mt-1 italic">
                      {response.operationDescription}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {response.intent && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-stone-100 text-stone-800 border border-stone-200">
                      {response.intent === 'RETRIEVE' && <History className="w-3.5 h-3.5 text-stone-600" />}
                      {response.intent === 'COMPARE' && <GitCompare className="w-3.5 h-3.5 text-amber-600" />}
                      {response.intent === 'EVOLVE' && <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />}
                      {response.intent === 'REFLECT' && <MessageSquare className="w-3.5 h-3.5 text-blue-600" />}
                      Operation: {response.intentLabel || response.intent}
                    </span>
                  )}
                  {getConfidenceBadge(response.confidence)}
                  {response.modelUsed && (
                    <span
                      className="text-[11px] text-stone-500 font-medium px-2 py-0.5 rounded bg-stone-50 border border-stone-200/60"
                      title={`Verified via ${response.modelUsed}`}
                    >
                      Gemini Grounded
                    </span>
                  )}
                </div>
              </div>

              {/* Comparison Highlight Card (if Compare intent produced structured findings) */}
              {response.comparison && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitCompare className="w-4 h-4 text-amber-700" />
                      <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                        Intention vs. Action Comparison
                      </span>
                    </div>
                    {response.comparison.progressMade && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Follow-through Evidenced
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold text-stone-900 text-sm">
                    {response.comparison.headline}
                  </h4>
                </div>
              )}

              {/* Personal Journey Stages Card (if Evolve intent produced structured journey) */}
              {response.journey && response.journey.stages && response.journey.stages.length > 0 && (
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                      Evolution Milestones ({response.journey.stages.length})
                    </span>
                  </div>
                  <div className="space-y-2.5 border-l-2 border-stone-200 pl-3 ml-2">
                    {response.journey.stages.map((st: any, idx: number) => (
                      <div key={idx} className="relative space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-900">{st.headline}</span>
                          <span className="text-[11px] text-stone-500 font-medium">({st.date})</span>
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-stone-200 text-stone-700">
                            {st.stage}
                          </span>
                        </div>
                        <p className="text-xs text-stone-600">{st.evidence}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Markdown Content */}
              <div className="prose prose-stone max-w-none text-stone-800 leading-relaxed">
                <div className="markdown-body">
                  <Markdown>{response.answer}</Markdown>
                </div>
              </div>

              {isNoRelevantMemoryAnswer && (
                <div className="bg-stone-50 rounded-xl p-5 border border-stone-200 space-y-3 mt-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-stone-200/70 flex items-center justify-center text-stone-600 shrink-0 mt-0.5">
                      <HelpCircle className="w-4.5 h-4.5 text-stone-600" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-stone-900">
                        I couldn't find a relevant memory in your Past Self Vault for that question.
                      </h4>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        Your Past Self can only answer from memories you've chosen to capture. If you haven't captured an intention, decision, or lesson on this topic yet, consider writing a reflection and preserving it to your vault.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 sm:pl-11">
                    <button
                      id="btn-no-mem-write-journal"
                      type="button"
                      onClick={onNavigateToWrite}
                      className="px-3.5 py-1.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-100 font-semibold text-xs text-stone-800 transition-colors cursor-pointer shadow-2xs"
                    >
                      Write Journal
                    </button>
                    <button
                      id="btn-no-mem-browse-memories"
                      type="button"
                      onClick={onNavigateToMemories}
                      className="px-3.5 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                    >
                      Browse Memories
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Evidence Section ("Based on your memories") */}
            {response.evidence && response.evidence.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-stone-200">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4.5 h-4.5 text-stone-800" />
                    <h3 className="font-bold text-stone-900 text-base">
                      Based on your memories ({response.evidence.length})
                    </h3>
                  </div>
                  <span className="text-xs font-medium text-stone-500">
                    Retrieved from your private vault
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {response.evidence.map((item: EvidenceItem, index: number) => {
                    const mem = item.memory;
                    if (!mem) return null;

                    return (
                      <motion.div
                        key={item.memoryId || index}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between hover:border-stone-300 transition-all"
                      >
                        <div className="space-y-3">
                          {/* Header badges */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-800 border border-stone-200">
                              {getTypeIcon(mem.type)}
                              {mem.type}
                            </span>
                            {getImportanceBadge(mem.importance)}
                          </div>

                          {/* Memory Title */}
                          <h4 className="font-bold text-stone-900 text-base leading-snug">
                            {mem.title}
                          </h4>

                          {/* Why this memory supports the answer */}
                          <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-200/70 text-xs text-stone-700">
                            <span className="font-semibold text-stone-800 block mb-0.5">
                              Evidence citation:
                            </span>
                            <p className="italic text-stone-600">
                              "{item.reason}"
                            </p>
                          </div>

                          {/* Memory Summary */}
                          <p className="text-sm text-stone-600 line-clamp-3 leading-relaxed">
                            {mem.summary}
                          </p>

                          {/* Tags */}
                          {mem.tags && mem.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {mem.tags.slice(0, 4).map((tag, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="inline-flex items-center gap-1 text-[11px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md"
                                >
                                  <Tag className="w-2.5 h-2.5 text-stone-400" />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Card Footer: Link to Source Journal Entry */}
                        <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-between gap-2">
                          <div className="text-xs text-stone-500 truncate max-w-[200px]">
                            {mem.sourceJournalTitle ? (
                              <span>From: <em>{mem.sourceJournalTitle}</em></span>
                            ) : (
                              <span>Journal Record</span>
                            )}
                          </div>

                          {mem.sourceJournalEntryId ? (
                            <button
                              id={`btn-view-source-${mem.id}`}
                              type="button"
                              onClick={() => onSelectJournalEntry(mem.sourceJournalEntryId!)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-stone-800 hover:text-stone-950 bg-stone-50 hover:bg-stone-100 border border-stone-200 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer shrink-0"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-stone-600" />
                              <span>View Journal Entry</span>
                              <ArrowRight className="w-3 h-3 text-stone-400" />
                            </button>
                          ) : (
                            <span className="text-xs text-stone-400 italic">
                              Direct memory capture
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Initial Empty State / Instructions */}
      {!response && !isLoading && (
        <div className="bg-stone-50 rounded-xl border border-dashed border-stone-300 p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center mx-auto text-stone-700 shadow-2xs">
            <Compass className="w-5 h-5 text-stone-800" />
          </div>
          <h3 className="font-semibold text-stone-900">
            Your Personal Time Capsule is Ready
          </h3>
          <p className="text-sm text-stone-600 max-w-lg mx-auto">
            Ask any question about your past reflections, resolutions, lessons, or choices. Gemini will query your memories and provide answers strictly grounded in what you have written.
          </p>
        </div>
      )}
    </div>
  );
};
