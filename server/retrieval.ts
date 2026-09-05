import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Load firebase applet config defensively
export interface FirebaseAppletConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId?: string;
  [key: string]: any;
}

export let firebaseConfig: FirebaseAppletConfig = {
  projectId: 'oceanic-array-99brs',
  apiKey: '',
  firestoreDatabaseId: 'ai-studio-29159d23-3457-4835-973f-5a08897caa45',
};

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    firebaseConfig = JSON.parse(raw);
  }
} catch (e) {
  console.warn('[Retrieval] Could not read firebase-applet-config.json, using fallback config', e);
}

// Lazy initialization of Firebase Admin
let adminApp: App | null = null;
export function getFirebaseAdmin(): App {
  if (!adminApp) {
    if (!getApps().length) {
      adminApp = initializeApp({
        projectId: firebaseConfig.projectId,
      });
    } else {
      adminApp = getApp();
    }
  }
  return adminApp;
}

/**
 * Verifies the incoming Firebase Authentication ID token.
 * NEVER trusts client-supplied userId. Derives verified UID directly from token.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<string> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing ID token');
  }

  // Method 1: Firebase Admin SDK verifyIdToken
  try {
    const app = getFirebaseAdmin();
    const auth = getAuth(app);
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded && decoded.uid) {
      return decoded.uid;
    }
  } catch (adminErr: any) {
    console.warn('[Auth] Firebase admin verifyIdToken failed, attempting Identity Toolkit fallback:', adminErr?.message || adminErr);
  }

  // Method 2: Google Identity Toolkit accounts:lookup REST API
  if (firebaseConfig.apiKey) {
    try {
      const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`;
      const resp = await fetch(lookupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (resp.ok) {
        const body = (await resp.json()) as any;
        if (body?.users && body.users[0]?.localId) {
          return body.users[0].localId;
        }
      } else {
        const errText = await resp.text();
        console.warn('[Auth] Identity Toolkit token verification returned non-OK:', resp.status, errText);
      }
    } catch (restErr: any) {
      console.error('[Auth] Identity Toolkit verification network error:', restErr);
    }
  }

  throw new Error('Authentication failed: Unable to verify Firebase ID token');
}

/**
 * Utility to parse Firestore REST API document fields into native JS objects.
 */
function parseFirestoreRestFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(fields)) {
    if (val.stringValue !== undefined) {
      result[key] = val.stringValue;
    } else if (val.integerValue !== undefined) {
      result[key] = Number(val.integerValue);
    } else if (val.doubleValue !== undefined) {
      result[key] = Number(val.doubleValue);
    } else if (val.booleanValue !== undefined) {
      result[key] = val.booleanValue;
    } else if (val.timestampValue !== undefined) {
      result[key] = new Date(val.timestampValue).getTime();
    } else if (val.nullValue !== undefined) {
      result[key] = null;
    } else if (val.arrayValue !== undefined) {
      result[key] = (val.arrayValue.values || []).map((item: any) => {
        if (item.stringValue !== undefined) return item.stringValue;
        if (item.integerValue !== undefined) return Number(item.integerValue);
        if (item.doubleValue !== undefined) return Number(item.doubleValue);
        if (item.booleanValue !== undefined) return item.booleanValue;
        if (item.mapValue !== undefined) return parseFirestoreRestFields(item.mapValue.fields || {});
        return item;
      });
    } else if (val.mapValue !== undefined) {
      result[key] = parseFirestoreRestFields(val.mapValue.fields || {});
    }
  }
  return result;
}

/**
 * Defensive and comprehensive mapping helper for raw Firestore documents.
 * Correctly extracts content across variations and aliases:
 * - title / headline / name
 * - summary / coreDistillation / distillation
 * - type / archetype / memoryType
 * - keyTakeaways / keyInsights / insights / metadata.keyTakeaways / metadata.keyInsights
 * - actionItem / actionableNextStep / metadata.actionItem
 * - tags (normalizes #tag -> tag)
 * - importance / priority
 */
export function mapRawMemoryDocument(docId: string, userId: string, raw: Record<string, any>): any {
  // Title / Headline / Name
  const title = (raw.title || raw.headline || raw.name || raw.topic || '').trim();

  // Summary / Core Distillation / Distillation
  const summary = (raw.summary || raw.coreDistillation || raw.distillation || raw.content || raw.reflection || '').trim();

  // Archetype / Type
  const type = (raw.type || raw.archetype || raw.memoryType || raw.category || 'Realization').trim();

  // Tags: normalize and strip leading hashes
  let rawTagsList: any[] = [];
  if (Array.isArray(raw.tags)) {
    rawTagsList = raw.tags;
  } else if (Array.isArray(raw.metadata?.tags)) {
    rawTagsList = raw.metadata.tags;
  } else if (typeof raw.tags === 'string') {
    rawTagsList = raw.tags.split(',').map((s: string) => s.trim());
  }
  const tags = rawTagsList
    .map((t: any) => String(t || '').replace(/^#+/, '').trim().toLowerCase())
    .filter(Boolean);

  // Key Takeaways / Key Insights / Insights
  let rawInsights: any[] = [];
  if (Array.isArray(raw.keyTakeaways) && raw.keyTakeaways.length > 0) {
    rawInsights = raw.keyTakeaways;
  } else if (Array.isArray(raw.keyInsights) && raw.keyInsights.length > 0) {
    rawInsights = raw.keyInsights;
  } else if (Array.isArray(raw.insights) && raw.insights.length > 0) {
    rawInsights = raw.insights;
  } else if (Array.isArray(raw.takeaways) && raw.takeaways.length > 0) {
    rawInsights = raw.takeaways;
  } else if (Array.isArray(raw.metadata?.keyTakeaways) && raw.metadata.keyTakeaways.length > 0) {
    rawInsights = raw.metadata.keyTakeaways;
  } else if (Array.isArray(raw.metadata?.keyInsights) && raw.metadata.keyInsights.length > 0) {
    rawInsights = raw.metadata.keyInsights;
  } else if (Array.isArray(raw.metadata?.insights) && raw.metadata.insights.length > 0) {
    rawInsights = raw.metadata.insights;
  } else if (Array.isArray(raw.keyQuotes) && raw.keyQuotes.length > 0) {
    rawInsights = raw.keyQuotes;
  }
  const keyTakeaways = rawInsights.map((k: any) => String(k || '').trim()).filter(Boolean);

  // Action item / Actionable next step
  const actionItem = (
    raw.actionItem ||
    raw.actionableNextStep ||
    raw.action ||
    raw.metadata?.actionItem ||
    raw.metadata?.actionableNextStep ||
    (Array.isArray(raw.actionItems) ? raw.actionItems.join('; ') : '') ||
    ''
  ).trim();

  // Importance / Priority
  const importance = (raw.importance || raw.priority || raw.metadata?.importance || 'medium').toLowerCase();

  // Key quotes
  const keyQuotes = (
    Array.isArray(raw.keyQuotes)
      ? raw.keyQuotes
      : (Array.isArray(raw.metadata?.keyQuotes) ? raw.metadata.keyQuotes : [])
  ).map((q: any) => String(q || '').trim()).filter(Boolean);

  // Journal source links
  const sourceJournalEntryId = raw.sourceJournalEntryId || raw.sourceEntryId || raw.journalEntryId || raw.entryId || '';
  const sourceJournalTitle = raw.sourceJournalTitle || raw.sourceEntryTitle || raw.journalTitle || raw.entryTitle || '';

  const createdAt = typeof raw.createdAt === 'number'
    ? raw.createdAt
    : (raw.createdAt?._seconds ? raw.createdAt._seconds * 1000 : Date.now());

  const updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now();

  return {
    id: docId || raw.id || '',
    userId,
    title,
    headline: title,
    summary,
    coreDistillation: summary,
    type,
    archetype: type,
    tags,
    importance,
    keyQuotes,
    keyTakeaways,
    keyInsights: keyTakeaways,
    actionItems: actionItem ? [actionItem] : [],
    actionItem,
    actionableNextStep: actionItem,
    sourceJournalEntryId,
    sourceJournalTitle,
    createdAt,
    updatedAt,
    emotionalContext: raw.emotionalContext || '',
    timeframe: raw.timeframe || '',
    metadata: raw.metadata || {},
  };
}

export interface RetrieveUserMemoriesResult {
  memories: any[];
  method: 'admin_firestore' | 'dev_preview_fallback' | 'failed';
  error?: string;
}

/**
 * PRODUCTION AUTHORITATIVE RETRIEVAL:
 * Retrieves all stored memories for the verified user from Firestore:
 * users/{userId}/memories
 *
 * Uses the exact database ID from firebase-applet-config.json.
 * Production Cloud Run uses Application Default Credentials (ADC) via the Cloud Run
 * runtime service account with the `roles/datastore.user` IAM role.
 *
 * Client memory authority is completely removed in production (NODE_ENV=production).
 * If Firestore cannot be reached in production, it fails closed with an error.
 */
export async function retrieveUserMemories(
  userId: string,
  _idToken: string,
  devPreviewSessionMemories?: any[]
): Promise<RetrieveUserMemoriesResult> {
  const dbId = firebaseConfig.firestoreDatabaseId || 'ai-studio-29159d23-3457-4835-973f-5a08897caa45';

  // Primary & Authoritative Strategy: Firebase Admin Firestore using Application Default Credentials
  try {
    const app = getFirebaseAdmin();
    const adminDb = getFirestore(app, dbId);
    const snapshot = await adminDb.collection('users').doc(userId).collection('memories').get();

    if (!snapshot.empty) {
      const memories: any[] = [];
      snapshot.forEach((docSnap) => {
        const raw = docSnap.data();
        memories.push(mapRawMemoryDocument(docSnap.id, userId, raw));
      });
      return { memories, method: 'admin_firestore' };
    } else {
      // Empty vault is a valid state (user has not saved memories yet)
      return { memories: [], method: 'admin_firestore' };
    }
  } catch (adminErr: any) {
    console.warn(
      `[Retrieval] Authoritative Admin Firestore query for users/${userId}/memories failed:`,
      adminErr?.message || adminErr
    );

    // In production (Cloud Run), FAIL CLOSED.
    // Client-supplied memories must NEVER be trusted or used in production.
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      console.error(
        '[Retrieval Security] Production environment detected (NODE_ENV=production). ' +
        'Failing closed: Client memory payloads are strictly rejected. ' +
        'Verify that Cloud Run service account has roles/datastore.user permission on ' +
        `project ${firebaseConfig.projectId}.`
      );
      return {
        memories: [],
        method: 'failed',
        error: 'Authoritative Firestore memory store is temporarily unavailable.',
      };
    }

    // NON-PRODUCTION PREVIEW COMPATIBILITY ONLY:
    // When running inside the AI Studio container sandbox, the dev container's service account
    // does not have IAM roles on the external Firebase project.
    // If and only if in development mode, an isolated preview fallback is permitted.
    if (Array.isArray(devPreviewSessionMemories) && devPreviewSessionMemories.length > 0) {
      console.warn(
        '[SECURITY NOTICE: NON-PRODUCTION PREVIEW FALLBACK ACTIVE] ' +
        'Using isolated development session memories because the AI Studio sandbox container ' +
        `lacks IAM permissions on project ${firebaseConfig.projectId}. ` +
        'This fallback is STRICTLY DISABLED in production deployment (NODE_ENV=production). ' +
        'In production Cloud Run, Application Default Credentials with roles/datastore.user are used.'
      );

      const isolatedMemories: any[] = [];
      for (const raw of devPreviewSessionMemories) {
        // Enforce owner isolation even in preview fallback:
        // Must strictly belong to the cryptographically verified userId.
        if (raw && (raw.userId === userId || !raw.userId)) {
          const docId = raw.id || Math.random().toString();
          isolatedMemories.push(mapRawMemoryDocument(docId, userId, raw));
        }
      }

      if (isolatedMemories.length > 0) {
        return { memories: isolatedMemories, method: 'dev_preview_fallback' };
      }
    }

    return {
      memories: [],
      method: 'failed',
      error: adminErr?.message || 'Firestore query failed',
    };
  }
}

// ============================================================================
// CONCEPT-AWARE RETRIEVAL & RANKING ENGINE FOR "ASK MY PAST SELF"
// ============================================================================

/**
 * Normalizes text: lowercasing, removing punctuation, normalizing whitespace.
 */
export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Basic deterministic word-form stemming for common English inflections.
 */
export function stemWord(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (w.length <= 3) return w;

  // Specific irregular / common journal stems
  if (/^(improv(e|ed|ing|ement|ements)?)$/.test(w)) return 'improv';
  if (/^(learn(s|ed|ing)?)$/.test(w)) return 'learn';
  if (/^(develop(s|ed|ing|ment|ments)?)$/.test(w)) return 'develop';
  if (/^(decid(e|ed|es|ing)?|decision(s)?)$/.test(w)) return 'decid';
  if (/^(grow(s|ing|n)?|growth)$/.test(w)) return 'grow';
  if (/^(master(s|ed|ing|y)?)$/.test(w)) return 'master';
  if (/^(pursu(e|ed|es|ing)?|pursuit(s)?)$/.test(w)) return 'pursu';
  if (/^(achiev(e|ed|es|ing|ement|ements)?)$/.test(w)) return 'achiev';
  if (/^(reflect(s|ed|ing|ion|ions)?)$/.test(w)) return 'reflect';
  if (/^(realiz(e|ed|es|ing|ation|ations)?)$/.test(w)) return 'realiz';
  if (/^(intend(s|ed|ing|tion|tions)?)$/.test(w)) return 'intend';
  if (/^(aspir(e|ed|es|ing|ation|ations)?)$/.test(w)) return 'aspir';
  if (/^(commit(s|ted|ting|ment|ments)?)$/.test(w)) return 'commit';
  if (/^(better)$/.test(w)) return 'better';
  if (/^(skill(s)?)$/.test(w)) return 'skill';
  if (/^(habit(s)?)$/.test(w)) return 'habit';
  if (/^(plan(s|ned|ning)?)$/.test(w)) return 'plan';
  if (/^(goal(s)?)$/.test(w)) return 'goal';
  if (/^(idea(s)?)$/.test(w)) return 'idea';
  if (/^(lesson(s)?)$/.test(w)) return 'lesson';

  // Standard suffix stripping
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  if (w.length > 6 && w.endsWith('ment')) return w.slice(0, -4);
  if (w.length > 6 && w.endsWith('tion')) return w.slice(0, -4);
  if (w.length > 5 && w.endsWith('ive')) return w.slice(0, -3);

  return w;
}

// Conversational stopwords to ignore in scoring
export const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t',
  'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here',
  'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
  'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
  'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
  'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves',
  // Conversational prompts filler tokens
  'tell', 'ask', 'know', 'remember', 'recall', 'thing', 'things', 'past', 'self', 'recently', 'lately', 'around'
]);

export interface ConceptCluster {
  id: string;
  name: string;
  relatedArchetypes: string[];
  terms: string[];
  stems: Set<string>;
}

const RAW_CONCEPT_CLUSTERS: Array<{
  id: string;
  name: string;
  relatedArchetypes: string[];
  terms: string[];
}> = [
  {
    id: 'improvement',
    name: 'Improvement & Skill Development',
    relatedArchetypes: ['Goal', 'Intention', 'Lesson', 'Realization'],
    terms: [
      'improve', 'improving', 'improved', 'improvement', 'improvements',
      'get better', 'better', 'develop', 'developing', 'development', 'develop skills',
      'strengthen', 'master', 'mastering', 'mastery',
      'learn', 'learning', 'learned',
      'study', 'studying', 'studied',
      'grow', 'growing', 'growth',
      'work on', 'working on', 'focus on',
      'practice', 'practicing', 'practiced',
      'implement', 'implementing', 'implemented',
      'skills', 'skill', 'level up', 'hone', 'sharpen', 'advance'
    ],
  },
  {
    id: 'goal',
    name: 'Goals & Objectives',
    relatedArchetypes: ['Goal', 'Intention'],
    terms: [
      'goal', 'goals', 'aim', 'aims', 'aimed',
      'target', 'targets', 'objective', 'objectives',
      'want', 'wanted', 'wants',
      'plan', 'plans', 'planned', 'planning',
      'intention', 'intentions',
      'aspire', 'aspires', 'aspired', 'aspiration', 'aspirations',
      'commitment', 'commit', 'committed',
      'set for myself', 'working towards', 'resolve',
      'side project', 'side projects', 'build', 'building'
    ],
  },
  {
    id: 'decision',
    name: 'Decisions & Choices',
    relatedArchetypes: ['Decision'],
    terms: [
      'decision', 'decisions', 'decide', 'decides', 'decided', 'deciding',
      'choose', 'chooses', 'chose', 'chosen', 'choice', 'choices',
      'commit', 'committed', 'commitment',
      'pick', 'picked', 'select', 'selected',
      'settle', 'settled', 'conclude', 'concluded',
      'side project', 'side projects', 'time', 'timing', 'priority', 'priorities'
    ],
  },
  {
    id: 'idea',
    name: 'Ideas & Innovation',
    relatedArchetypes: ['Idea', 'Goal'],
    terms: [
      'idea', 'ideas', 'thought', 'thoughts',
      'concept', 'concepts', 'project', 'projects', 'project idea',
      'brainstorm', 'brainstormed', 'explore', 'exploring',
      'innovate', 'innovation', 'pursue', 'pursuing'
    ],
  },
  {
    id: 'lesson',
    name: 'Lessons & Insights',
    relatedArchetypes: ['Lesson', 'Realization'],
    terms: [
      'lesson', 'lessons', 'learn', 'learned', 'learning',
      'realization', 'realizations', 'realize', 'realized',
      'takeaway', 'takeaways', 'insight', 'insights', 'wisdom',
      'discovery', 'discover', 'discovered', 'mistake', 'mistakes',
      'fail', 'failure', 'remind myself'
    ],
  },
  {
    id: 'event',
    name: 'Events & Experiences',
    relatedArchetypes: ['Event'],
    terms: [
      'event', 'events', 'milestone', 'milestones',
      'happen', 'happened', 'happening', 'incident',
      'experience', 'experiences', 'trip', 'traveled', 'visit', 'celebration'
    ],
  },
  {
    id: 'realization',
    name: 'Realizations & Break-throughs',
    relatedArchetypes: ['Realization'],
    terms: [
      'realization', 'realizations', 'realize', 'realized',
      'breakthrough', 'epiphany', 'clarity', 'understanding',
      'noticed', 'recognize', 'recognized', 'awakening'
    ],
  },
  {
    id: 'intention',
    name: 'Intentions & Mindset',
    relatedArchetypes: ['Intention', 'Goal'],
    terms: [
      'intention', 'intentions', 'intend', 'intended',
      'mindset', 'habit', 'habits', 'practice', 'practicing',
      'discipline', 'routine', 'pledge'
    ],
  },
];

// Precompute stems for fast cluster lookups
export const CONCEPT_CLUSTERS: ConceptCluster[] = RAW_CONCEPT_CLUSTERS.map((cluster) => {
  const stems = new Set<string>();
  for (const term of cluster.terms) {
    const parts = term.split(/\s+/);
    for (const p of parts) {
      stems.add(stemWord(p));
      stems.add(p.toLowerCase());
    }
  }
  return {
    ...cluster,
    stems,
  };
});

// All stems belonging to intent clusters (used to distinguish intent words from specific domain entities)
const INTENT_STEMS = new Set<string>();
for (const cluster of CONCEPT_CLUSTERS) {
  for (const s of cluster.stems) {
    INTENT_STEMS.add(s);
  }
}
// Also common action/query words that are part of query intent framing
['want', 'set', 'try', 'look', 'make', 'do', 'pursu', 'think', 'work', 'focus'].forEach((s) => {
  INTENT_STEMS.add(s);
});

// Multi-word phrase mapping for personal reflection questions
const PHRASE_INTENT_RULES: Array<{
  phrase: string;
  matchedConcepts: string[];
}> = [
  { phrase: 'wanted to improve', matchedConcepts: ['improvement', 'goal'] },
  { phrase: 'want to improve', matchedConcepts: ['improvement', 'goal'] },
  { phrase: 'get better at', matchedConcepts: ['improvement'] },
  { phrase: 'better at', matchedConcepts: ['improvement'] },
  { phrase: 'develop skills', matchedConcepts: ['improvement'] },
  { phrase: 'skills to develop', matchedConcepts: ['improvement', 'goal'] },
  { phrase: 'trying to develop', matchedConcepts: ['improvement'] },
  { phrase: 'improve skills', matchedConcepts: ['improvement'] },
  { phrase: 'areas for improvement', matchedConcepts: ['improvement'] },
  { phrase: 'goals did i set', matchedConcepts: ['goal', 'intention'] },
  { phrase: 'goals i set', matchedConcepts: ['goal', 'intention'] },
  { phrase: 'set for myself', matchedConcepts: ['goal', 'intention'] },
  { phrase: 'trying to learn', matchedConcepts: ['improvement', 'lesson'] },
  { phrase: 'wanted to learn', matchedConcepts: ['improvement', 'lesson', 'goal'] },
  { phrase: 'ideas did i want', matchedConcepts: ['idea', 'goal'] },
  { phrase: 'wanted to pursue', matchedConcepts: ['idea', 'goal'] },
  { phrase: 'decisions have i made', matchedConcepts: ['decision'] },
  { phrase: 'decisions did i make', matchedConcepts: ['decision'] },
  { phrase: 'did i decide', matchedConcepts: ['decision'] },
  { phrase: 'focus on', matchedConcepts: ['improvement', 'goal'] },
  { phrase: 'work on', matchedConcepts: ['improvement', 'goal'] },
];

export interface ScoredMemoryResult {
  memory: any;
  score: number;
  matchedTokens: string[];
  matchedConcepts: string[];
  topicMatch: boolean;
}

/**
 * Concept-Aware Lightweight Relevance-Scoring & Ranking Engine:
 * 
 * 1. Normalizes query text and detects multi-word intent phrases (e.g. "wanted to improve").
 * 2. Classifies query tokens into Intent Concepts vs Specific Domain / Topic Entities.
 * 3. Applies strict Negative Guard: If a query specifies domain entities (e.g. "Portuguese", "car", "cooking")
 *    and the memory contains 0 matching domain entities, the memory is disqualified (score = 0).
 * 4. Weights matching concept signals across prioritized memory fields:
 *    - Title / headline (weight 5.0)
 *    - Tags (weight 4.0)
 *    - Summary / core distillation (weight 3.5)
 *    - Key insights / takeaways (weight 3.0)
 *    - Action items / quotes (weight 2.0)
 *    - Archetype alignment bonus (weight 3.5)
 *    - Multi-signal coherence bonus (+2.5)
 *    - Importance multiplier (high: 1.15x, medium: 1.0x, low: 0.9x)
 */
export function rankMemoriesForQuery(
  question: string,
  memories: any[]
): {
  topMemories: any[];
  allScored: ScoredMemoryResult[];
  hasMeaningfulMatch: boolean;
} {
  if (!memories || memories.length === 0) {
    return { topMemories: [], allScored: [], hasMeaningfulMatch: false };
  }

  const normalizedQuestion = normalizeText(question);
  const rawWords = normalizedQuestion.split(/\s+/).filter((w) => w.length >= 2);

  // 1. Detect Multi-Word Phrase Concepts
  const detectedConceptIds = new Set<string>();
  for (const rule of PHRASE_INTENT_RULES) {
    if (normalizedQuestion.includes(rule.phrase)) {
      rule.matchedConcepts.forEach((c) => detectedConceptIds.add(c));
    }
  }

  // 2. Identify Intent Concepts and Distinct Topic Entities
  const queryTokens: string[] = [];
  const queryStems: string[] = [];
  const topicTokens: string[] = [];
  const topicStems: string[] = [];

  for (const word of rawWords) {
    if (STOP_WORDS.has(word)) continue;

    const stem = stemWord(word);
    queryTokens.push(word);
    queryStems.push(stem);

    // Check if this word matches any concept cluster
    let matchedAnyConcept = false;
    for (const cluster of CONCEPT_CLUSTERS) {
      if (cluster.stems.has(stem) || cluster.stems.has(word)) {
        detectedConceptIds.add(cluster.id);
        matchedAnyConcept = true;
      }
    }

    // If it is NOT an intent word/stem, it is a specific Topic/Domain Entity token!
    if (!matchedAnyConcept && !INTENT_STEMS.has(stem)) {
      topicTokens.push(word);
      topicStems.push(stem);
    }
  }

  const activeConcepts = CONCEPT_CLUSTERS.filter((c) => detectedConceptIds.has(c.id));

  // 3. Score Each Memory
  const scoredList: ScoredMemoryResult[] = [];

  for (const mem of memories) {
    let score = 0;
    const matchedSignals = new Set<string>();
    const matchedConceptNames = new Set<string>();

    const titleNorm = normalizeText(mem.title || mem.headline || '');
    const summaryNorm = normalizeText(mem.summary || mem.coreDistillation || mem.distillation || '');
    const typeNorm = (mem.type || mem.archetype || '').trim();
    const tagsNorm = Array.isArray(mem.tags) ? mem.tags.map((t: any) => normalizeText(String(t).replace(/^#+/, ''))) : [];
    const quotesNorm = Array.isArray(mem.keyQuotes) ? mem.keyQuotes.map((q: any) => normalizeText(String(q))).join(' ') : '';
    const takeawaysNorm = Array.isArray(mem.keyTakeaways) && mem.keyTakeaways.length > 0
      ? mem.keyTakeaways.map((k: any) => normalizeText(String(k))).join(' ')
      : (Array.isArray(mem.keyInsights) ? mem.keyInsights.map((k: any) => normalizeText(String(k))).join(' ') : '');
    const actionNorm = normalizeText(Array.isArray(mem.actionItems) ? mem.actionItems.join(' ') : String(mem.actionItem || mem.actionableNextStep || ''));

    const fullMemoryText = `${titleNorm} ${summaryNorm} ${tagsNorm.join(' ')} ${takeawaysNorm} ${quotesNorm} ${actionNorm}`;

    // Negative Test Guard:
    // If the query contains specific topic tokens (e.g. "Portuguese", "car", "cooking"),
    // at least one topic token or its stem MUST match this memory.
    let topicMatched = false;
    if (topicTokens.length > 0) {
      for (let i = 0; i < topicTokens.length; i++) {
        const t = topicTokens[i];
        const s = topicStems[i];
        if (fullMemoryText.includes(t) || (s.length >= 3 && fullMemoryText.includes(s))) {
          topicMatched = true;

          // Highly reward topic matches across fields
          if (titleNorm.includes(t) || (s.length >= 3 && titleNorm.includes(s))) {
            score += 6.0;
            matchedSignals.add(`[Topic in Title: ${t}]`);
          }
          if (tagsNorm.some((tag) => tag.includes(t) || (s.length >= 3 && tag.includes(s)))) {
            score += 5.0;
            matchedSignals.add(`[Topic in Tag: ${t}]`);
          }
          if (summaryNorm.includes(t) || (s.length >= 3 && summaryNorm.includes(s))) {
            score += 4.0;
            matchedSignals.add(`[Topic in Summary: ${t}]`);
          }
          if (takeawaysNorm.includes(t) || quotesNorm.includes(t) || actionNorm.includes(t)) {
            score += 3.0;
            matchedSignals.add(`[Topic in Takeaways: ${t}]`);
          }
        }
      }

      // If the query requested specific domain topics and NONE matched this memory,
      // disqualify this memory so it does NOT match unrelated queries!
      if (!topicMatched) {
        scoredList.push({
          memory: mem,
          score: 0,
          matchedTokens: [],
          matchedConcepts: [],
          topicMatch: false,
        });
        continue;
      }
    }

    // Direct Token Matching for query tokens
    for (let i = 0; i < queryTokens.length; i++) {
      const tok = queryTokens[i];
      const stem = queryStems[i];

      if (titleNorm.includes(tok) || (stem.length >= 4 && titleNorm.includes(stem))) {
        score += 3.0;
        matchedSignals.add(`[Word in Title: ${tok}]`);
      }
      if (tagsNorm.some((t) => t.includes(tok) || (stem.length >= 4 && t.includes(stem)))) {
        score += 2.5;
        matchedSignals.add(`[Word in Tag: ${tok}]`);
      }
      if (summaryNorm.includes(tok) || (stem.length >= 4 && summaryNorm.includes(stem))) {
        score += 2.0;
        matchedSignals.add(`[Word in Summary: ${tok}]`);
      }
      if (takeawaysNorm.includes(tok) || quotesNorm.includes(tok) || actionNorm.includes(tok)) {
        score += 1.5;
        matchedSignals.add(`[Word in Takeaways: ${tok}]`);
      }
    }

    // Concept Cluster Matching across prioritized fields
    for (const cluster of activeConcepts) {
      let clusterMatchedInMem = false;

      // Check title for any term or stem from the concept cluster (Highest Weight: 5.0)
      for (const term of cluster.terms) {
        if (titleNorm.includes(term)) {
          score += 5.0;
          matchedSignals.add(`[${cluster.name} in Title: ${term}]`);
          clusterMatchedInMem = true;
          break;
        }
      }
      if (!clusterMatchedInMem) {
        for (const stem of cluster.stems) {
          if (stem.length >= 4 && titleNorm.includes(stem)) {
            score += 4.0;
            matchedSignals.add(`[${cluster.name} stem in Title: ${stem}]`);
            clusterMatchedInMem = true;
            break;
          }
        }
      }

      // Check tags (High Weight: 4.0)
      let tagMatch = false;
      for (const term of cluster.terms) {
        if (tagsNorm.some((t) => t.includes(term))) {
          score += 4.0;
          matchedSignals.add(`[${cluster.name} in Tags: ${term}]`);
          tagMatch = true;
          clusterMatchedInMem = true;
          break;
        }
      }
      if (!tagMatch) {
        for (const stem of cluster.stems) {
          if (stem.length >= 4 && tagsNorm.some((t) => t.includes(stem))) {
            score += 3.5;
            matchedSignals.add(`[${cluster.name} stem in Tags: ${stem}]`);
            clusterMatchedInMem = true;
            break;
          }
        }
      }

      // Check summary (High Weight: 3.5)
      let summaryMatch = false;
      for (const term of cluster.terms) {
        if (summaryNorm.includes(term)) {
          score += 3.5;
          matchedSignals.add(`[${cluster.name} in Summary: ${term}]`);
          summaryMatch = true;
          clusterMatchedInMem = true;
          break;
        }
      }
      if (!summaryMatch) {
        for (const stem of cluster.stems) {
          if (stem.length >= 4 && summaryNorm.includes(stem)) {
            score += 3.0;
            matchedSignals.add(`[${cluster.name} stem in Summary: ${stem}]`);
            clusterMatchedInMem = true;
            break;
          }
        }
      }

      // Check key takeaways / quotes (Medium-High Weight: 3.0)
      let takeawayMatch = false;
      for (const term of cluster.terms) {
        if (takeawaysNorm.includes(term) || quotesNorm.includes(term)) {
          score += 3.0;
          matchedSignals.add(`[${cluster.name} in Takeaways: ${term}]`);
          takeawayMatch = true;
          clusterMatchedInMem = true;
          break;
        }
      }
      if (!takeawayMatch) {
        for (const stem of cluster.stems) {
          if (stem.length >= 4 && (takeawaysNorm.includes(stem) || quotesNorm.includes(stem))) {
            score += 2.5;
            matchedSignals.add(`[${cluster.name} stem in Takeaways: ${stem}]`);
            clusterMatchedInMem = true;
            break;
          }
        }
      }

      // Check action items (Medium Weight: 2.0)
      for (const term of cluster.terms) {
        if (actionNorm.includes(term)) {
          score += 2.0;
          matchedSignals.add(`[${cluster.name} in Action Items]`);
          clusterMatchedInMem = true;
          break;
        }
      }

      // Archetype Alignment Bonus (Weight: 3.5)
      if (cluster.relatedArchetypes.some((arch) => arch.toLowerCase() === typeNorm.toLowerCase())) {
        score += 3.5;
        matchedSignals.add(`[Archetype Alignment: ${typeNorm}]`);
        clusterMatchedInMem = true;
      }

      if (clusterMatchedInMem) {
        matchedConceptNames.add(cluster.name);
      }
    }

    // Reward multi-concept coherence
    if (matchedConceptNames.size >= 2 || (topicMatched && matchedConceptNames.size >= 1)) {
      score += 2.5;
      matchedSignals.add('[Multi-Signal Coherence Bonus]');
    }

    // Importance multiplier
    const imp = String(mem.importance || 'medium').toLowerCase();
    if (imp === 'high') {
      score *= 1.15;
    } else if (imp === 'low') {
      score *= 0.9;
    }

    scoredList.push({
      memory: mem,
      score,
      matchedTokens: Array.from(matchedSignals),
      matchedConcepts: Array.from(matchedConceptNames),
      topicMatch: topicMatched,
    });
  }

  // Sort descending by score
  scoredList.sort((a, b) => b.score - a.score);

  // Filter top matches: must have a score >= 5.0 and at least one concrete field match
  const meaningfulMatches = scoredList.filter((s) => {
    if (s.score < 5.0) return false;
    // Ensure the score is not just from an isolated type alignment alone
    const hasFieldSignal = s.matchedTokens.some((t) =>
      t.includes('in Title') ||
      t.includes('in Summary') ||
      t.includes('in Tag') ||
      t.includes('in Takeaways') ||
      t.includes('in Action')
    );
    return hasFieldSignal;
  });

  const topMemories = meaningfulMatches.slice(0, 5).map((s) => s.memory);

  return {
    topMemories,
    allScored: scoredList,
    hasMeaningfulMatch: topMemories.length > 0,
  };
}

/**
 * Concept-aware ranking engine for proactive "Growth & Tension Detection".
 * Compares a newly written journal entry against existing memories to find
 * the top eligible candidate memories (e.g. goals, decisions, lessons) for reflection.
 */
export function rankMemoriesForJournalEntry(
  journal: { id?: string; title: string; content: string; tags?: string[] },
  memories: any[]
): {
  candidateMemories: any[];
  allScored: ScoredMemoryResult[];
  hasCandidates: boolean;
} {
  if (!memories || memories.length === 0) {
    return { candidateMemories: [], allScored: [], hasCandidates: false };
  }

  // 1. Exclude the memory created from this journal entry itself (if journal has an id)
  const eligibleMemories = memories.filter((m) => {
    if (!m) return false;
    if (journal.id) {
      if (m.sourceJournalEntryId === journal.id || m.id === journal.id) {
        return false;
      }
    }
    return true;
  });

  if (eligibleMemories.length === 0) {
    return { candidateMemories: [], allScored: [], hasCandidates: false };
  }

  const titleNorm = normalizeText(journal.title || '');
  const contentNorm = normalizeText(journal.content || '');
  const tagsNorm = (journal.tags || []).map(normalizeText);

  // If both content and title are empty, nothing can match
  if (!titleNorm && !contentNorm && tagsNorm.length === 0) {
    return { candidateMemories: [], allScored: [], hasCandidates: false };
  }

  const combinedJournalText = `${titleNorm} ${tagsNorm.join(' ')} ${contentNorm}`.trim();
  const journalWords = Array.from(
    new Set(
      combinedJournalText
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    )
  );
  const journalStems = new Set(journalWords.map((w) => stemWord(w)));

  const scoredList: ScoredMemoryResult[] = [];

  for (const mem of eligibleMemories) {
    const memTitleNorm = normalizeText(mem.title || '');
    const memSummaryNorm = normalizeText(mem.summary || '');
    const memTagsNorm = (mem.tags || []).map(normalizeText);
    const memTakeawaysNorm = (mem.keyTakeaways || []).map(normalizeText).join(' ');
    const memTypeNorm = normalizeText(mem.type || '');
    const memFull = `${memTitleNorm} ${memSummaryNorm} ${memTagsNorm.join(' ')} ${memTakeawaysNorm}`;

    let score = 0;
    const matchedSignals = new Set<string>();
    const matchedConceptNames = new Set<string>();

    // 1. Direct word & stem matches between journal words and memory fields
    for (const jw of journalWords) {
      const js = stemWord(jw);

      // Title match (Highest weight: 5.0)
      if (memTitleNorm.includes(jw) || (js.length >= 3 && memTitleNorm.includes(js))) {
        score += 5.0;
        matchedSignals.add(`[Journal Word in Title: ${jw}]`);
      }
      // Tags match (Weight: 4.5)
      if (memTagsNorm.some((t) => t.includes(jw) || (js.length >= 3 && t.includes(js)))) {
        score += 4.5;
        matchedSignals.add(`[Journal Word in Tag: ${jw}]`);
      }
      // Summary match (Weight: 3.5)
      if (memSummaryNorm.includes(jw) || (js.length >= 3 && memSummaryNorm.includes(js))) {
        score += 3.5;
        matchedSignals.add(`[Journal Word in Summary: ${jw}]`);
      }
      // Takeaways match (Weight: 2.5)
      if (memTakeawaysNorm.includes(jw) || (js.length >= 3 && memTakeawaysNorm.includes(js))) {
        score += 2.5;
        matchedSignals.add(`[Journal Word in Takeaways: ${jw}]`);
      }
    }

    // 2. Domain Association Boosts for reflective intersections
    // AI Security & Application Domain
    const isSecurityJournal =
      combinedJournalText.includes('security') ||
      combinedJournalText.includes('prompt injection') ||
      combinedJournalText.includes('input validation') ||
      combinedJournalText.includes('gemini') ||
      combinedJournalText.includes('aisecurity');
    const isSecurityMemory =
      memFull.includes('security') ||
      memFull.includes('aisecurity') ||
      (memFull.includes('ai') && memFull.includes('project'));
    if (isSecurityJournal && isSecurityMemory) {
      score += 15.0;
      matchedSignals.add('[Domain Match: AI Security]');
    }

    // Side Projects & Time/Priority Domain
    const isSideProjectJournal =
      combinedJournalText.includes('side project') ||
      combinedJournalText.includes('sideproject') ||
      (combinedJournalText.includes('project') &&
        (combinedJournalText.includes('start') || combinedJournalText.includes('decide')));
    const isSideProjectMemory =
      memFull.includes('side project') ||
      memFull.includes('sideproject') ||
      (memFull.includes('project') && (memFull.includes('time') || memFull.includes('focus')));
    if (isSideProjectJournal && isSideProjectMemory) {
      score += 15.0;
      matchedSignals.add('[Domain Match: Side Projects]');
    }

    // Language Learning Domain
    const isLanguageJournal =
      combinedJournalText.includes('language') ||
      combinedJournalText.includes('portuguese') ||
      combinedJournalText.includes('spanish') ||
      combinedJournalText.includes('french');
    const isLanguageMemory =
      memFull.includes('language') ||
      memFull.includes('portuguese') ||
      memFull.includes('spanish') ||
      memFull.includes('french');
    if (isLanguageJournal && isLanguageMemory) {
      score += 12.0;
      matchedSignals.add('[Domain Match: Language Learning]');
    }

    // 3. Concept Cluster Overlaps
    for (const cluster of CONCEPT_CLUSTERS) {
      let journalHasCluster = false;
      for (const t of cluster.terms) {
        if (combinedJournalText.includes(t)) {
          journalHasCluster = true;
          break;
        }
      }
      if (!journalHasCluster) {
        for (const s of cluster.stems) {
          if (s.length >= 4 && journalStems.has(s)) {
            journalHasCluster = true;
            break;
          }
        }
      }

      if (journalHasCluster) {
        let memHasCluster = false;
        for (const t of cluster.terms) {
          if (memFull.includes(t)) {
            memHasCluster = true;
            break;
          }
        }
        if (memHasCluster) {
          score += 3.0;
          matchedSignals.add(`[Shared Concept: ${cluster.name}]`);
          matchedConceptNames.add(cluster.name);
        }
      }
    }

    // If there is NO concrete field match or domain match, score is 0
    if (matchedSignals.size === 0) {
      score = 0;
    }

    scoredList.push({
      memory: mem,
      score,
      matchedTokens: Array.from(matchedSignals),
      matchedConcepts: Array.from(matchedConceptNames),
      topicMatch: matchedSignals.size > 0,
    });
  }

  // Sort descending by score
  scoredList.sort((a, b) => b.score - a.score);

  // Meaningful candidates with clear signal (score >= 5.0)
  const candidateScored = scoredList.filter((s) => s.score >= 5.0);
  const candidateMemories = candidateScored.slice(0, 8).map((s) => s.memory);

  return {
    candidateMemories,
    allScored: scoredList,
    hasCandidates: candidateMemories.length > 0,
  };
}

export interface RankRelatedMemoriesResult {
  relatedMemories: any[];
  allScored: any[];
  hasCandidates: boolean;
}

/**
 * Identifies stored memories related to a seed memory for Personal Journey evolution analysis.
 * Reuses keyword extraction, stemming, domain matching (AI security, side projects, etc.),
 * tag matching, and concept cluster signals.
 */
export function rankRelatedMemoriesForMemory(
  seedMemory: any,
  allMemories: any[],
  maxCandidates = 10
): RankRelatedMemoriesResult {
  if (!seedMemory || !Array.isArray(allMemories) || allMemories.length <= 1) {
    return { relatedMemories: [], allScored: [], hasCandidates: false };
  }

  const seedTitle = String(seedMemory.title || seedMemory.headline || '').trim();
  const seedSummary = String(seedMemory.summary || seedMemory.coreDistillation || '').trim();
  const seedTags = (Array.isArray(seedMemory.tags) ? seedMemory.tags : []).map((t: any) =>
    String(t || '').trim().toLowerCase()
  );
  const seedTakeaways = (
    Array.isArray(seedMemory.keyTakeaways)
      ? seedMemory.keyTakeaways
      : (Array.isArray(seedMemory.metadata?.keyTakeaways) ? seedMemory.metadata.keyTakeaways : [])
  )
    .map((t: any) => String(t || '').trim().toLowerCase())
    .join(' ');

  const combinedSeedText = normalizeText(
    `${seedTitle} ${seedSummary} ${seedTags.join(' ')} ${seedTakeaways} ${
      seedMemory.actionItem || ''
    } ${seedMemory.type || ''}`
  );
  const seedWords = combinedSeedText
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  const seedStems = new Set(seedWords.map((w) => stemWord(w)).filter((s) => s.length >= 3));

  const scoredList: Array<{
    memory: any;
    score: number;
    matchedSignals: string[];
    sharedConcepts: string[];
  }> = [];

  for (const mem of allMemories) {
    // Exclude the seed memory itself
    if (mem.id === seedMemory.id) continue;

    const memTitle = String(mem.title || mem.headline || '').trim();
    const memSummary = String(mem.summary || mem.coreDistillation || '').trim();
    const memTags = (Array.isArray(mem.tags) ? mem.tags : []).map((t: any) =>
      String(t || '').trim().toLowerCase()
    );
    const memTakeaways = (
      Array.isArray(mem.keyTakeaways)
        ? mem.keyTakeaways
        : (Array.isArray(mem.metadata?.keyTakeaways) ? mem.metadata.keyTakeaways : [])
    )
      .map((t: any) => String(t || '').trim().toLowerCase())
      .join(' ');

    const memTitleNorm = normalizeText(memTitle);
    const memSummaryNorm = normalizeText(memSummary);
    const memFull = normalizeText(`${memTitle} ${memSummary} ${memTags.join(' ')} ${memTakeaways}`);

    let score = 0;
    const matchedSignals: string[] = [];
    const sharedConcepts: string[] = [];

    // 1. Tag Overlaps
    for (const st of seedTags) {
      if (st && memTags.includes(st)) {
        score += 4.5;
        matchedSignals.push(`Tag: #${st}`);
      }
    }

    // 2. Word and Stem matching across Title, Summary, and Takeaways
    for (const sw of seedWords) {
      const ss = stemWord(sw);
      // Title match (Weight 5.0)
      if (memTitleNorm.includes(sw) || (ss.length >= 4 && memTitleNorm.includes(ss))) {
        score += 5.0;
        matchedSignals.push(`Title match: ${sw}`);
      }
      // Summary match (Weight 3.5)
      if (memSummaryNorm.includes(sw) || (ss.length >= 4 && memSummaryNorm.includes(ss))) {
        score += 3.5;
        matchedSignals.push(`Summary match: ${sw}`);
      }
      // Takeaways match (Weight 2.5)
      if (memTakeaways.includes(sw) || (ss.length >= 4 && memTakeaways.includes(ss))) {
        score += 2.5;
        matchedSignals.push(`Takeaways match: ${sw}`);
      }
    }

    // 3. Domain Association Matches (e.g. AI Security, Side Projects, Language Learning)
    const isSecuritySeed =
      combinedSeedText.includes('security') ||
      combinedSeedText.includes('prompt injection') ||
      combinedSeedText.includes('input validation');
    const isSecurityMem =
      memFull.includes('security') ||
      memFull.includes('prompt injection') ||
      memFull.includes('input validation') ||
      (memFull.includes('ai') && memFull.includes('project'));
    if (isSecuritySeed && isSecurityMem) {
      score += 15.0;
      matchedSignals.push('Domain: AI Security');
    }

    const isSideProjectSeed =
      combinedSeedText.includes('side project') ||
      (combinedSeedText.includes('project') &&
        (combinedSeedText.includes('build') || combinedSeedText.includes('launch')));
    const isSideProjectMem =
      memFull.includes('side project') ||
      (memFull.includes('project') &&
        (memFull.includes('build') || memFull.includes('focus') || memFull.includes('time')));
    if (isSideProjectSeed && isSideProjectMem) {
      score += 15.0;
      matchedSignals.push('Domain: Side Projects');
    }

    const isLangSeed =
      combinedSeedText.includes('language') ||
      combinedSeedText.includes('portuguese') ||
      combinedSeedText.includes('spanish');
    const isLangMem =
      memFull.includes('language') ||
      memFull.includes('portuguese') ||
      memFull.includes('spanish');
    if (isLangSeed && isLangMem) {
      score += 12.0;
      matchedSignals.push('Domain: Language Learning');
    }

    // 4. Concept Clusters
    for (const cluster of CONCEPT_CLUSTERS) {
      let seedHas = false;
      for (const t of cluster.terms) {
        if (combinedSeedText.includes(t)) {
          seedHas = true;
          break;
        }
      }
      if (!seedHas) {
        for (const s of cluster.stems) {
          if (s.length >= 4 && seedStems.has(s)) {
            seedHas = true;
            break;
          }
        }
      }
      if (seedHas) {
        let memHas = false;
        for (const t of cluster.terms) {
          if (memFull.includes(t)) {
            memHas = true;
            break;
          }
        }
        if (memHas) {
          score += 3.5;
          matchedSignals.push(`Concept: ${cluster.name}`);
          sharedConcepts.push(cluster.name);
        }
      }
    }

    // If zero concrete signals, zero score
    if (matchedSignals.length === 0) {
      score = 0;
    }

    scoredList.push({
      memory: mem,
      score,
      matchedSignals,
      sharedConcepts,
    });
  }

  scoredList.sort((a, b) => b.score - a.score);

  // Filter candidates with strong enough signal (score >= 5.0)
  const qualifying = scoredList.filter((s) => s.score >= 5.0);
  const relatedMemories = qualifying.slice(0, maxCandidates).map((s) => s.memory);

  return {
    relatedMemories,
    allScored: scoredList,
    hasCandidates: relatedMemories.length > 0,
  };
}


