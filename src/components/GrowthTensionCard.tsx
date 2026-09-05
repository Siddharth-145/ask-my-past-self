import React from 'react';
import { Sprout, Zap, GitBranch, ArrowRight, X, Bookmark, Quote } from 'lucide-react';
import type { GrowthTensionInsight } from '../types';

interface GrowthTensionCardProps {
  insight: GrowthTensionInsight;
  onViewMemory?: (memoryId: string) => void;
  onViewSourceJournal?: (sourceJournalId: string) => void;
  onDismiss?: () => void;
  className?: string;
}

export const GrowthTensionCard: React.FC<GrowthTensionCardProps> = ({
  insight,
  onViewMemory,
  onViewSourceJournal,
  onDismiss,
  className = '',
}) => {
  const isGrowth = insight.relationship === 'reinforces';
  const isTension = insight.relationship === 'contradicts';
  const isExtension = insight.relationship === 'extends';

  const badgeConfig = isGrowth
    ? {
        label: 'Growth detected',
        icon: <Sprout className="w-3.5 h-3.5 text-emerald-600" />,
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
        accentBorder: 'border-emerald-200',
        bgGradient: 'bg-gradient-to-br from-emerald-50/40 via-white to-stone-50/50',
      }
    : isTension
    ? {
        label: 'Tension detected',
        icon: <Zap className="w-3.5 h-3.5 text-amber-600" />,
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-200/80',
        accentBorder: 'border-amber-200',
        bgGradient: 'bg-gradient-to-br from-amber-50/40 via-white to-stone-50/50',
      }
    : {
        label: 'Pattern continued',
        icon: <GitBranch className="w-3.5 h-3.5 text-sky-600" />,
        badgeClass: 'bg-sky-50 text-sky-900 border-sky-200/80',
        accentBorder: 'border-sky-200',
        bgGradient: 'bg-gradient-to-br from-sky-50/40 via-white to-stone-50/50',
      };

  return (
    <section
      id={`growth-tension-card-${insight.memoryId}`}
      aria-label={`${badgeConfig.label}: ${insight.headline}`}
      className={`rounded-2xl border ${badgeConfig.accentBorder} ${badgeConfig.bgGradient} p-5 sm:p-6 shadow-sm transition-all ${className}`}
    >
      {/* Header with relationship pill & dismiss button */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            id="insight-badge-pill"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeConfig.badgeClass}`}
          >
            {badgeConfig.icon}
            <span>{badgeConfig.label}</span>
          </span>
          <span className="text-[11px] font-medium text-stone-600 uppercase tracking-wider">
            Past Self Reflection
          </span>
        </div>

        {onDismiss && (
          <button
            id="btn-dismiss-insight"
            onClick={onDismiss}
            aria-label="Dismiss this insight"
            className="text-stone-600 hover:text-stone-800 p-1 rounded-lg hover:bg-stone-200/50 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Reflective Headline */}
      <h3
        id="insight-headline"
        className="text-lg sm:text-xl font-serif font-semibold text-stone-900 leading-snug mb-2"
      >
        {insight.headline}
      </h3>

      {/* Non-judgmental Explanation */}
      <p
        id="insight-explanation"
        className="text-xs sm:text-sm text-stone-700 leading-relaxed mb-4 max-w-prose"
      >
        {insight.explanation}
      </p>

      {/* Grounded Evidence Comparison Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {/* Previous Memory Evidence */}
        <div className="bg-white/90 rounded-xl p-3.5 border border-stone-200/70 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
              <Bookmark className="w-3 h-3 text-stone-600" />
              <span>Previously you wrote</span>
            </div>
            <div className="relative pl-3 border-l-2 border-amber-300">
              <p className="text-xs text-stone-800 italic leading-relaxed">
                &ldquo;{insight.previousEvidence}&rdquo;
              </p>
            </div>
          </div>

          {insight.relatedMemory && (
            <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
              <span className="truncate font-medium text-stone-700">
                {insight.relatedMemory.title}
              </span>
              {onViewMemory && (
                <button
                  id="btn-view-memory-inline"
                  onClick={() => onViewMemory(insight.memoryId)}
                  className="text-amber-800 hover:text-amber-950 font-medium shrink-0 ml-2 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>View Memory</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Current Journal Entry Evidence */}
        <div className="bg-white/90 rounded-xl p-3.5 border border-stone-200/70 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
              <Quote className="w-3 h-3 text-stone-600" />
              <span>Today&apos;s reflection</span>
            </div>
            <div className="relative pl-3 border-l-2 border-stone-300">
              <p className="text-xs text-stone-800 italic leading-relaxed">
                &ldquo;{insight.currentEvidence}&rdquo;
              </p>
            </div>
          </div>

          {onViewSourceJournal && insight.sourceJournalEntryId && (
            <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
              <span className="truncate font-medium text-stone-700">
                {insight.sourceJournalTitle || 'Saved Journal'}
              </span>
              <button
                id="btn-view-source-journal"
                onClick={() => onViewSourceJournal(insight.sourceJournalEntryId!)}
                className="text-stone-700 hover:text-stone-900 font-medium shrink-0 ml-2 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>View Entry</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Primary Action Button */}
      {onViewMemory && (
        <div className="flex items-center justify-end pt-1">
          <button
            id="btn-view-related-memory"
            onClick={() => onViewMemory(insight.memoryId)}
            className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-50 rounded-xl text-xs font-medium transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Open in Memory Vault</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>
      )}
    </section>
  );
};
