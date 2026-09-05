import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  RefreshCw,
  Plus,
  BookOpen,
  X,
  AlertCircle,
  Copy,
  Check,
  Bot,
  User as UserIcon,
} from 'lucide-react';
import Markdown from 'react-markdown';
import type { ChatMessage, GeminiInteraction, JournalEntry } from '../types';
import { stripUndefined } from '../utils/sanitize';

interface GeminiReflectorProps {
  userId: string;
  entries: JournalEntry[];
  initialContextText?: string;
  onSaveInteraction: (interaction: GeminiInteraction) => Promise<boolean>;
}

const STARTER_PROMPTS = [
  'Help me process and reflect on my day with kindness and nuance.',
  'I am feeling uncertain about a decision. Help me explore both sides.',
  'Help me identify patterns of growth in my recent thoughts and experiences.',
  'What are 3 grounding questions I should ask myself right now?',
];

export const GeminiReflector: React.FC<GeminiReflectorProps> = ({
  userId,
  entries,
  initialContextText = '',
  onSaveInteraction,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [selectedEntryId, setSelectedEntryId] = useState<string>('');
  const [attachedContext, setAttachedContext] = useState<string>(initialContextText);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [interactionId, setInteractionId] = useState<string>(
    `dialogue_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  );
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [latestModelUsed, setLatestModelUsed] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync initial context text if provided
  useEffect(() => {
    if (initialContextText) {
      setAttachedContext(initialContextText);
    }
  }, [initialContextText]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSelectEntryContext = (entryId: string) => {
    setSelectedEntryId(entryId);
    if (!entryId) {
      setAttachedContext('');
      return;
    }
    const found = entries.find((e) => e.id === entryId);
    if (found) {
      setAttachedContext(`[Journal Title: "${found.title}"]\n${found.content}`);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

    setErrorBanner(null);
    setInputPrompt('');

    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      text: prompt,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, text: m.text })),
          journalContext: attachedContext,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gemini conversational request failed.');
      }

      const modelMessage: ChatMessage = {
        id: `msg_model_${Date.now()}`,
        role: 'model',
        text: data.reply,
        timestamp: Date.now(),
        modelUsed: data.modelUsed,
      };

      const updatedHistory = [...newMessages, modelMessage];
      setMessages(updatedHistory);
      setLatestModelUsed(data.modelUsed || 'Gemini Flash');

      // Persist the updated multi-turn interaction to Cloud Firestore
      const interactionRecord: GeminiInteraction = {
        id: interactionId,
        userId,
        title: userMessage.text.slice(0, 48) || 'Conversational Reflection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        journalEntryId: selectedEntryId || undefined,
        messages: updatedHistory,
      };

      await onSaveInteraction(stripUndefined(interactionRecord));
    } catch (err: any) {
      console.error('Chat error:', err);
      setErrorBanner(err?.message || 'Error communicating with Gemini.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetConversation = () => {
    if (messages.length > 0 && !window.confirm('Start a new Gemini dialogue session?')) {
      return;
    }
    setMessages([]);
    setErrorBanner(null);
    setInteractionId(`dialogue_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
  };

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Context Attachment Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <BookOpen className="w-4 h-4 text-amber-700 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-stone-900">Active Grounding Context:</span>
              <select
                id="select-journal-context"
                value={selectedEntryId}
                onChange={(e) => handleSelectEntryContext(e.target.value)}
                className="bg-stone-50 border border-stone-200 text-stone-800 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer max-w-xs truncate"
              >
                <option value="">No specific journal entry attached (General reflection)</option>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title} ({new Date(entry.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {latestModelUsed && (
            <span className="text-[11px] bg-amber-50 border border-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md font-mono">
              Active Model: {latestModelUsed}
            </span>
          )}
          <button
            onClick={handleResetConversation}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-stone-300/80 hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {attachedContext && (
        <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3 text-xs flex items-start justify-between gap-2">
          <div className="line-clamp-2 text-amber-950">
            <span className="font-semibold mr-1">Attached Context:</span>
            {attachedContext}
          </div>
          <button
            onClick={() => {
              setAttachedContext('');
              setSelectedEntryId('');
            }}
            className="text-amber-800 hover:text-amber-950 p-0.5 rounded-sm"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Dialogue Canvas */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs flex flex-col h-[580px] overflow-hidden">
        {/* Messages Scroll Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  Conversational Journal Partner
                </h3>
                <p className="text-xs sm:text-sm text-stone-500 max-w-md mt-1 leading-relaxed">
                  Start an introspective dialogue with Gemini. Discuss your reflections, process challenging decisions, or explore recurring thoughts.
                </p>
              </div>

              {/* Starter chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl w-full text-left">
                {STARTER_PROMPTS.map((starter, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(starter)}
                    className="p-3 rounded-xl border border-stone-200/90 hover:border-amber-300 bg-stone-50/50 hover:bg-amber-50/40 text-stone-700 text-xs transition-all text-left flex items-start gap-2 cursor-pointer group"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <span className="leading-snug">{starter}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold ${
                      isUser
                        ? 'bg-stone-900 text-white'
                        : 'bg-amber-100 border border-amber-200 text-amber-900'
                    }`}
                  >
                    {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4 text-amber-700" />}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`rounded-2xl p-4 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-stone-900 text-stone-100 rounded-tr-xs'
                        : 'bg-stone-50 border border-stone-200/80 text-stone-900 rounded-tl-xs shadow-2xs'
                    }`}
                  >
                    {!isUser ? (
                      <div className="prose prose-stone max-w-none text-xs sm:text-sm text-stone-800">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}

                    <div className="mt-2 pt-1 border-t border-stone-200/40 flex items-center justify-between gap-3 text-[10px] text-stone-400">
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {!isUser && (
                        <div className="flex items-center gap-1.5">
                          {msg.modelUsed && <span className="font-mono text-[9px]">{msg.modelUsed}</span>}
                          <button
                            onClick={() => handleCopyText(msg.text, index)}
                            className="p-1 hover:text-stone-700 rounded-md transition-colors"
                            title="Copy reply"
                          >
                            {copiedIndex === index ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {isLoading && (
            <div className="flex gap-3 mr-auto max-w-md">
              <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-amber-700" />
              </div>
              <div className="bg-stone-50 border border-stone-200/80 rounded-2xl rounded-tl-xs p-4 flex items-center gap-2 text-xs text-stone-600">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                <span>Gemini is reflecting on your prompt...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error notification */}
        {errorBanner && (
          <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{errorBanner}</span>
            </div>
            <button
              onClick={() => handleSendMessage()}
              className="font-medium underline hover:text-rose-950 cursor-pointer ml-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-stone-200/80 bg-stone-50/50 flex items-center gap-2">
          <input
            id="chat-prompt-input"
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type your reflection or inquiry for Gemini..."
            disabled={isLoading}
            className="flex-1 bg-white border border-stone-300/80 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 font-normal"
          />

          <button
            id="send-chat-btn"
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputPrompt.trim()}
            className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs sm:text-sm font-medium transition-all shadow-xs disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Reflect</span>
          </button>
        </div>
      </div>
    </div>
  );
};
