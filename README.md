# Ask My Past Self — Personal Gemini Journal Foundation

A secure, production-ready, user-authenticated journaling web application built with **React**, **Google Gemini**, **Firebase Authentication (Google Sign-In)**, and **Cloud Firestore**.

This repository implements the secure foundation for the **"Ask My Past Self"** product, enabling users to maintain a private, owner-isolated reflection journal with multi-turn Gemini AI conversational guidance, structured metadata persistence, and strict owner isolation.

---

## 🏗️ Architecture Overview

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend Service**: Express.js server on Node.js / Google Cloud Run (Container Port `3000`)
- **Authentication**: Firebase Authentication (Google Sign-In via OAuth popup)
- **Database**: Cloud Firestore with owner-bound rules (`users/{userId}/...`)
- **AI Engine**: Google Gemini API via `@google/genai` with automated resilient fallback ladder
- **Secret Management**: Google Cloud Secret Manager / Server-side environment variable injection

---

## 🔒 Security & Threat Mitigation Summary

| Threat Zone | Identified Risk | Production Countermeasure |
| :--- | :--- | :--- |
| **Input Surfaces** | Malicious / untrusted journal entries, memory queries | Strict schema validation, defensive JSON ingestion, text length limits (max 500 chars for inquiries) |
| **Planning & Reasoning** | Indirect prompt injection via journal or memory context | Memory text and questions treated as plain untrusted data; system prompt explicitly commands model not to execute instructions inside retrieved memories |
| **Tool & API Execution** | Unauthorized API calls / cross-user spoofing | Cryptographically verified Firebase ID tokens on backend (`verifyFirebaseIdToken`); `userId` derived from token, never client payload; server-side Gemini proxy (`/api/gemini/*`) |
| **Memory & State** | Cross-user memory data leakage | Path-based owner-checking (`request.auth.uid == userId`) in `firestore.rules`; backend queries strictly scoped to authenticated user UID |
| **Inter-System Communication** | Gemini service exhaustion / outages | Resilient fallback ladder (`gemini-3.6-flash` &rarr; `gemini-3.1-flash-lite` &rarr; `gemini-flash-latest` &rarr; `gemini-3.7-flash`) |

---

## 🧭 Personal Memory Retrieval ("Ask My Past Self")

### Target Production Architecture

```
Browser
  │
  │ Firebase Authentication ID token (Authorization: Bearer <idToken>)
  ▼
Cloud Run / Express Backend
  │
  │ Cryptographically verify Firebase ID token (verifyFirebaseIdToken)
  ▼
verifiedUid
  │
  ▼
Cloud Firestore (Authoritative Server-Side Query)
users/{verifiedUid}/memories
  │
  ▼
Concept-Aware Ranking & Threshold Gating
  │
  ▼
Google Gemini API (Server-Side Grounding with Untrusted Data Isolation)
  │
  ▼
Grounded Answer + Validated Evidence Citations
  │
  ▼
Browser
```

The **Ask My Past Self** engine connects user inquiries directly with their historical memory vault:

1. **Authentication & Token Derivation**: The client passes the current user's Firebase ID token via `Authorization: Bearer <idToken>`. The backend validates the cryptographic signature and derives the verified `userId`. Frontend-supplied `userId`, `uid`, or `ownerId` parameters in request bodies or queries are strictly rejected.
2. **Authoritative Server-Side Memory Retrieval**: In production (`NODE_ENV=production`), the server exclusively and authoritatively fetches all memories stored under `users/{verifiedUserId}/memories` using the Firebase Admin SDK and Google Cloud Application Default Credentials (ADC). The browser is **never** authoritative for memory data, and client memory payloads are completely ignored and rejected in production.
3. **Fail-Closed Principle**: If Firestore access is unavailable on the server in production, the endpoint immediately fails closed and returns an error response (`"Your past memories are temporarily unavailable. Please try again."`), never fabricating data or trusting unverified client input.
4. **Intent & Keyword Relevance Scoring**: Evaluates question tokens against memory titles (4x weight), tags (3.5x weight), summaries (2.5x weight), takeaways/quotes/action items (2x weight), and question intent archetypes (e.g. "goals", "decisions", "lessons") with dynamic scoring thresholds.
5. **Zero-Hallucination Safe Fallback**: If no memories pass the relevance threshold, the system returns an immediate polite notice without making an ungrounded inference:
   > *"I couldn't find a relevant memory in your Past Self Vault for that question."*
6. **Gemini Grounding & Untrusted Data Isolation**: When relevant memories exist, Gemini is invoked with strict grounding directives and a structured JSON schema. All memory texts are treated as untrusted user data with prompt-injection defenses. The model returns:
   - `answer`: Grounded response referencing the user's past thoughts
   - `confidence`: `high`, `medium`, or `low`
   - `evidence`: Array of memory citations linking each supporting point to a specific memory ID and reason. Memory IDs and citations are validated on the server against the candidate list.

---

## 🧭 Personal Journey ("Evolve")

The **Personal Journey** engine traces how a goal, intention, idea, or decision progressed over time into action and reflection:

1. **User-Triggered Exploration**: Activated from any memory card in the Memory Vault via **"View Journey"** or **"See How This Evolved"**.
2. **Authoritative Candidate Memory Ranking**: Reuses server-side semantic signals, stem matching, and concept clusters (`rankRelatedMemoriesForMemory`) to assemble chronologically ordered historical evidence.
3. **Strict Zero-Fabrication Grounding**:
   - Model receives memories marked strictly as untrusted evidence inside `<historical_evidence>`.
   - Never invents stages, dates, motivations, or achievements.
   - Requires high-confidence progression across at least 2 distinct chronological evidence points (`intention`, `exploration`, `decision`, `action`, `progress`, `reflection`).
   - If evidence is ambiguous or insufficient, safely returns `hasJourney: false` with clear user feedback.
4. **Server-Side Validation**: Validates that all stage `memoryId`s belong to the user's authentic candidate pool. Rejects hallucinated IDs or unsourced claims.
5. **Interactive Navigation**: Each journey stage links directly back to the original preserved memory and source journal entry.

---

## 📦 Cloud Firestore Data Model

```
users/{userId}
  ├── uid: string
  ├── email: string
  ├── displayName: string
  ├── photoURL: string
  ├── lastLoginAt: number
  │
  ├── journalEntries/{entryId}
  │     ├── id: string
  │     ├── userId: string
  │     ├── title: string
  │     ├── content: string
  │     ├── mood: string (e.g. "Grateful", "Reflective")
  │     ├── tags: string[]
  │     ├── createdAt: number (epoch ms)
  │     ├── updatedAt: number (epoch ms)
  │     ├── wordCount: number
  │     ├── aiReflection: string (optional)
  │     ├── aiSummary: string (optional)
  │     ├── growthTensionInsight: GrowthTensionInsight (optional)
  │     └── metadata: { formatVersion: number, clientPlatform: string }
  │
  ├── memories/{memoryId}
  │     ├── id: string
  │     ├── userId: string
  │     ├── sourceJournalEntryId: string (optional)
  │     ├── sourceJournalTitle: string (optional)
  │     ├── type: string ('Goal' | 'Decision' | 'Idea' | 'Lesson' | 'Event' | 'Realization' | 'Intention')
  │     ├── title: string
  │     ├── summary: string
  │     ├── tags: string[]
  │     ├── importance: string ('low' | 'medium' | 'high')
  │     ├── keyQuotes: string[] (optional)
  │     ├── actionItems: string[] (optional)
  │     ├── emotionalContext: string (optional)
  │     ├── timeframe: string (optional)
  │     ├── extractedWithModel: string (optional)
  │     ├── personalJourney: PersonalJourney (optional, cached evolution analysis)
  │     ├── createdAt: number (epoch ms)
  │     └── updatedAt: number (epoch ms)
  │
  └── interactions/{interactionId}
        ├── id: string
        ├── userId: string
        ├── title: string
        ├── createdAt: number
        ├── updatedAt: number
        ├── journalEntryId: string (optional)
        └── messages: Array<{ id, role, text, timestamp, modelUsed }>
```

---

## 🛡️ Cloud Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /journalEntries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /memories/{memoryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

---

## 🚀 Deployment to Google Cloud Run

### 1. Prerequisites & API Activation

Ensure you have the Google Cloud SDK (`gcloud`) installed and configured:

```bash
# Set active project
gcloud config set project YOUR_PROJECT_ID

# Enable required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com
```

### 2. Secret Manager Configuration

Store the Gemini API key securely in Google Cloud Secret Manager:

```bash
# Create the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"

# Add the secret payload
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant Cloud Run default compute service account access to read the secret
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Cloud Firestore IAM Configuration for Cloud Run (Authoritative Server-Side Access)

For the backend to authoritatively read and query the user's memory collections (`users/{verifiedUid}/memories`) using Application Default Credentials (ADC), grant the Cloud Run runtime service account the `roles/datastore.user` IAM role:

```bash
# Grant minimum required permission for authoritative server-side Firestore operations
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

> **Security Note on Environments:**
> - In **Production Cloud Run** (`NODE_ENV=production`), the backend solely queries Firestore via the Admin SDK with Application Default Credentials and the `roles/datastore.user` role. Client memory arrays are strictly ignored and rejected.
> - The AI Studio preview session fallback was an isolated non-production shim necessitated solely by sandbox container IAM limitations, and is **never** used in production.

### 4. Deploy to Cloud Run

Deploy the container to Cloud Run with Secret Manager environment injection:

```bash
gcloud run deploy ask-my-past-self \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

### 5. Mandatory Campaign Resource Labeling

Register the Cloud Run service for the challenge verification:

```bash
gcloud run services update ask-my-past-self \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 🧪 Verification & User Testing Walkthrough

1. **Authentication Flow**:
   - Navigate to the landing page.
   - Click **"Continue with Google Sign-In"** to authenticate via Firebase Google Auth popup.
   - Verify that the authenticated dashboard displays your name, email, and avatar.

2. **Journal Entry Lifecycle & Resilience**:
   - In the **Daily Journal Studio**, write a title, journal reflections, select a mood chip (e.g. *✨ Grateful*), and add tags (e.g. `#growth`).
   - Click **"Save Entry"**. Verify the instant persistence confirmation.
   - Switch to **"Journal History"** tab to verify the entry is listed with creation time, word count, and mood pill.
   - Click on an entry card to open the reader modal and verify the owner-isolated user UID isolation badge.

3. **Gemini Reflection Toolkit**:
   - Inside the Journal Studio with text entered, click **"Reflect & Elevate"**, **"Get Prompts"**, or **"Summarize Themes"**.
   - Verify that Gemini generates structured feedback and displays the active model (e.g. `gemini-3.6-flash`).
   - Click **"Append to Journal Content"** to merge the reflection into your entry text.

4. **Memory Capture & Vault Workflow**:
   - In the **Daily Journal Studio** or from any entry in **Journal History**, click **"Remember This"** or **"Distill into Memory"**.
   - Gemini automatically analyzes the entry with prompt-isolation safeguards and categorizes it into a structured archetype (Goal, Decision, Idea, Lesson, Event, Realization, or Intention).
   - In the modal review dialog, inspect or edit the memory title, category, summary, tags, quotes, and action items.
   - Click **"Save to Memory Vault"**. Confirm that the memory is persisted to `users/{userId}/memories`.
   - Click the **"Memories"** tab in the navigation bar to explore the structured memory cards, filter by category/importance, search keywords, or click **"View Source Journal Entry"** to jump back to the original entry context.

5. **Ask My Past Self (Personal Memory Retrieval)**:
   - Click the **"Ask Past Self"** tab in the navigation bar.
   - You can choose one of the suggested inquiry chips (e.g. *"What goals did I set for myself?"*, *"What were the things I wanted to improve?"*) or type a custom question.
   - Click **"Ask My Past Self"** (or press `Cmd+Enter` / `Ctrl+Enter`).
   - The backend validates your cryptographically signed Firebase ID token, securely retrieves your memories from `users/{userId}/memories`, performs intent and keyword relevance scoring, and invokes Gemini with zero-hallucination grounding.
   - Verify the rendered response:
     - Clear, empathetic grounded answer synthesized from your past thoughts.
     - Confidence indicator badge (`High Grounding Confidence` or `Moderate Grounding`).
     - **"Based on your memories"** evidence citations showing exact matching memories, category tags, importance levels, and specific explanations for why each memory was cited.
     - Click **"View Journal Entry"** on any cited evidence card to open the source journal entry.
   - Test asking an inquiry about a topic you have never written about (e.g., *"What did I learn about astrophysics?"*).
   - Verify that the system safely and politely states: *"I couldn't find a relevant memory in your Past Self Vault for that question."* and offers quick buttons to write a journal entry or browse the vault.

6. **Growth & Tension Detection (Proactive Personal Reflection)**:
   - In the **Daily Journal Studio**, write a reflection that directly connects with a prior recorded memory (for instance, if you have a memory about *"Setting a daily morning walk routine"*, write an entry about how you went walking today and felt invigorated, or conversely about how work deadlines disrupted morning walks).
   - Click **"Save Entry"**.
   - As the entry saves to Firestore, an analyzing badge appears: *"Comparing reflection against your past memories to identify growth or tension..."*.
   - Once completed, if a high-confidence relationship exists, an elegant proactive insight card appears:
     - **Growth Detected (🌱)**: Identifies how the new reflection reinforces or builds upon an existing decision or goal.
     - **Tension Detected (⚡)**: Identifies a gentle, non-judgmental difference between current thoughts and past commitments/lessons.
     - **Pattern Continued (🔗)**: Identifies how a past idea or realization is extended into a new phase.
   - Inspect the card: it contains an empathetic neutral summary, a side-by-side evidence comparison (*"In your new reflection"* vs. *"In your past memory"*), a constructive reflection question to explore, and a direct button to **"Open Memory in Vault"**.
   - Click **"Open Memory in Vault"** to immediately navigate to the Memory Vault with that specific memory opened and highlighted.
   - Navigate to **"Journal History"** and verify that the entry card displays the proactive badge (e.g. *🌱 Growth*, *⚡ Tension*, or *🔗 Pattern*), and opening the entry reader modal renders the preserved insight card.

7. **Conversational Multi-Turn Dialogue**:
   - Switch to the **"Gemini Dialogue"** tab.
   - Attach a journal entry as grounding context from the dropdown or ask an open reflection prompt.
   - Verify that multi-turn dialogue maintains context and persists the conversation to Firestore.

8. **Security & Sign-Out**:
   - Click **"Logout"** in the top bar.
   - Verify that the private dashboard unmounts immediately and resets to the Landing Page.
