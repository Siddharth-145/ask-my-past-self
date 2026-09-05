export type MemoryType =
  | 'Goal'
  | 'Decision'
  | 'Idea'
  | 'Lesson'
  | 'Event'
  | 'Realization'
  | 'Intention';

export interface Memory {
  id: string;
  userId: string;
  title: string;
  headline?: string;
  summary: string;
  coreDistillation?: string;
  type: MemoryType | string;
  archetype?: string;
  sourceJournalEntryId?: string;
  sourceJournalTitle?: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  importance: 'low' | 'medium' | 'high' | string;
  keyQuotes?: string[];
  keyTakeaways?: string[];
  keyInsights?: string[];
  actionItems?: string[];
  actionItem?: string;
  actionableNextStep?: string;
  emotionalContext?: string;
  timeframe?: string;
  extractedWithModel?: string;
  metadata?: {
    formatVersion?: number;
    clientPlatform?: string;
    keyTakeaways?: string[];
    keyInsights?: string[];
    actionItem?: string;
    actionableNextStep?: string;
    reasoning?: string;
    [key: string]: any;
  };
  personalJourney?: PersonalJourney | null;
  [key: string]: any;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  wordCount: number;
  aiReflection?: string;
  aiSummary?: string;
  growthTensionInsight?: GrowthTensionInsight | null;
  metadata?: {
    formatVersion: number;
    clientPlatform: string;
    weatherOrContext?: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  modelUsed?: string;
  isError?: boolean;
}

export interface GeminiInteraction {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  journalEntryId?: string;
  messages: ChatMessage[];
}

export interface PastSelfQuery {
  question: string;
}

export interface EvidenceItem {
  memoryId: string;
  reason: string;
  memory?: Memory;
}

export interface ApiStructuredError {
  code: string;
  title?: string;
  message: string;
  retryable: boolean;
  cooldownSeconds?: number;
}

export interface AskPastSelfResponse {
  success: boolean;
  ok?: boolean;
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  memoryIds: string[];
  evidence: EvidenceItem[];
  retrievedMemories?: Memory[];
  modelUsed?: string;
  error?: string | ApiStructuredError;
  structuredError?: ApiStructuredError;
  intent?: 'RETRIEVE' | 'COMPARE' | 'EVOLVE' | 'REFLECT';
  intentLabel?: string;
  operationDescription?: string;
  journey?: PersonalJourney | null;
  comparison?: {
    headline?: string;
    relationship?: string;
    progressMade?: boolean;
  } | null;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastLoginAt: number;
  createdAt?: number;
}

export type GrowthTensionRelationship = 'reinforces' | 'contradicts' | 'extends' | 'none';

export interface GrowthTensionInsight {
  relationship: 'reinforces' | 'contradicts' | 'extends';
  memoryId: string;
  confidence: 'high';
  headline: string;
  explanation: string;
  previousEvidence: string;
  currentEvidence: string;
  relatedMemory?: {
    id: string;
    title: string;
    summary: string;
    type?: string;
    tags?: string[];
    createdAt?: number;
    sourceJournalEntryId?: string;
  };
  sourceJournalEntryId?: string;
  sourceJournalTitle?: string;
  analyzedAt?: number;
}

export type JourneyStageType =
  | 'intention'
  | 'exploration'
  | 'decision'
  | 'action'
  | 'progress'
  | 'reflection'
  | 'other';

export interface PersonalJourneyStage {
  memoryId: string;
  date: string;
  stage: JourneyStageType;
  headline: string;
  evidence: string;
  memoryTitle?: string;
  sourceJournalEntryId?: string;
}

export interface PersonalJourney {
  id?: string;
  seedMemoryId: string;
  hasJourney: boolean;
  title: string;
  summary: string;
  stages: PersonalJourneyStage[];
  overallInsight: string;
  confidence: 'high' | 'medium' | 'low';
  createdAt?: number;
  reason?: string;
}
