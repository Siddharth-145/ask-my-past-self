import { GoogleGenAI } from '@google/genai';
import type { Response } from 'express';

export const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
];

export interface FallbackGenOptions {
  systemInstruction?: string;
  contents: unknown;
  temperature?: number;
  responseMimeType?: string;
  responseSchema?: unknown;
}

export type GeminiErrorCategory =
  | 'RATE_LIMIT'
  | 'TEMPORARY_GEMINI_FAILURE'
  | 'AUTHENTICATION_OR_CONFIGURATION_FAILURE'
  | 'VALIDATION_FAILURE'
  | 'UNKNOWN_FAILURE';

export interface ClassifiedGeminiError {
  category: GeminiErrorCategory;
  httpStatus: number;
  code: string;
  title: string;
  message: string;
  retryable: boolean;
  cooldownSeconds?: number;
}

/**
 * Classify Gemini / API runtime errors into bounded, customer-safe error categories.
 * Handles diverse HTTP statuses, gRPC codes, and SDK error shapes dynamically
 * without relying solely on exact error string matches.
 */
export function classifyGeminiError(err: unknown): ClassifiedGeminiError {
  if (!err) {
    return {
      category: 'UNKNOWN_FAILURE',
      httpStatus: 500,
      code: 'AI_TEMPORARILY_UNAVAILABLE',
      title: 'Your Past Self is temporarily unavailable',
      message: 'Something interrupted the AI response. Your memories are safe. Please try again.',
      retryable: true,
      cooldownSeconds: 3,
    };
  }

  const errObj = typeof err === 'object' && err !== null ? (err as Record<string, any>) : {};

  // Extract HTTP status code from error object or message
  let status =
    Number(errObj.status) ||
    Number(errObj.statusCode) ||
    Number(errObj.response?.status) ||
    Number(errObj.cause?.status) ||
    0;

  const rawMessage = String(errObj.message || err || '');
  const rawCode = String(errObj.code || errObj.statusText || '');
  const rawDetails = String(errObj.details || JSON.stringify(errObj.statusDetails || ''));
  const combined = `${rawMessage} ${rawCode} ${rawDetails}`.toLowerCase();

  // If status is 0, attempt to detect status numbers embedded in the message
  if (status === 0) {
    const statusMatch = combined.match(/\b(429|500|502|503|504|400|401|403)\b/);
    if (statusMatch) {
      status = parseInt(statusMatch[1], 10);
    }
  }

  // 1. RATE_LIMIT / QUOTA_EXCEEDED
  const isRateLimit =
    status === 429 ||
    combined.includes('resource_exhausted') ||
    combined.includes('quota') ||
    combined.includes('rate limit') ||
    combined.includes('too many requests') ||
    combined.includes('exhausted');

  if (isRateLimit) {
    // Check for explicit retry-delay hints if provided
    let cooldown = 5;
    const retryMatch = combined.match(/(?:retry|wait|reset)\s+(?:in|after)?\s*(\d+)\s*(?:s|sec|seconds)?/i);
    if (retryMatch) {
      const parsedSeconds = parseInt(retryMatch[1], 10);
      if (parsedSeconds > 0 && parsedSeconds <= 60) {
        cooldown = parsedSeconds;
      }
    }

    return {
      category: 'RATE_LIMIT',
      httpStatus: 429,
      code: 'AI_RATE_LIMITED',
      title: 'Gemini is temporarily busy',
      message: "We've reached the current AI request limit. Your memories are safe. Please try again in a moment.",
      retryable: true,
      cooldownSeconds: cooldown,
    };
  }

  // 2. AUTHENTICATION OR CONFIGURATION FAILURE
  const isAuthOrConfig =
    status === 401 ||
    status === 403 ||
    combined.includes('unauthenticated') ||
    combined.includes('permission_denied') ||
    combined.includes('api key') ||
    combined.includes('api_key') ||
    combined.includes('not configured') ||
    combined.includes('unauthorized') ||
    combined.includes('forbidden');

  if (isAuthOrConfig) {
    return {
      category: 'AUTHENTICATION_OR_CONFIGURATION_FAILURE',
      httpStatus: 503,
      code: 'AI_AUTH_OR_CONFIG_ERROR',
      title: 'AI service temporarily unavailable',
      message: 'The AI service is currently unavailable. Your memories are safe. Please try again later.',
      retryable: false,
    };
  }

  // 3. VALIDATION FAILURE
  const isValidation =
    status === 400 ||
    combined.includes('invalid_argument') ||
    combined.includes('bad request') ||
    combined.includes('schema mismatch');

  if (isValidation) {
    return {
      category: 'VALIDATION_FAILURE',
      httpStatus: 400,
      code: 'VALIDATION_ERROR',
      title: 'Inquiry could not be processed',
      message: 'The request could not be processed. Please try rephrasing your inquiry.',
      retryable: false,
    };
  }

  // 4. TEMPORARY_GEMINI_FAILURE (500, 502, 503, 504, etc.)
  const isTemporary =
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    combined.includes('unavailable') ||
    combined.includes('overloaded') ||
    combined.includes('deadline_exceeded') ||
    combined.includes('bad gateway') ||
    combined.includes('gateway timeout') ||
    combined.includes('internal server error') ||
    combined.includes('service unavailable');

  if (isTemporary) {
    return {
      category: 'TEMPORARY_GEMINI_FAILURE',
      httpStatus: 503,
      code: 'AI_TEMPORARILY_UNAVAILABLE',
      title: 'Your Past Self is temporarily unavailable',
      message: 'Something interrupted the AI response. Your memories are safe. Please try again.',
      retryable: true,
      cooldownSeconds: 3,
    };
  }

  // 5. UNKNOWN_FAILURE fallback
  return {
    category: 'UNKNOWN_FAILURE',
    httpStatus: 500,
    code: 'AI_TEMPORARILY_UNAVAILABLE',
    title: 'Your Past Self is temporarily unavailable',
    message: 'Something interrupted the AI response. Your memories are safe. Please try again.',
    retryable: true,
    cooldownSeconds: 3,
  };
}

export class GeminiServiceError extends Error {
  public readonly classified: ClassifiedGeminiError;

  constructor(classified: ClassifiedGeminiError, internalDetails?: string) {
    super(classified.message);
    this.name = 'GeminiServiceError';
    this.classified = classified;
    if (internalDetails) {
      this.stack = internalDetails;
    }
  }
}

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiServiceError(
      {
        category: 'AUTHENTICATION_OR_CONFIGURATION_FAILURE',
        httpStatus: 503,
        code: 'AI_AUTH_OR_CONFIG_ERROR',
        title: 'AI service temporarily unavailable',
        message: 'The AI service is currently unavailable. Your memories are safe. Please try again later.',
        retryable: false,
      },
      'GEMINI_API_KEY environment variable is not configured'
    );
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * Resilient Gemini generation with ordered model fallback ladder.
 * Avoids hammering models that returned definitive quota errors and gracefully
 * translates final unrecoverable failures into structured application errors.
 */
export async function generateContentWithFallback(
  options: FallbackGenOptions
): Promise<{ text: string; modelUsed: string }> {
  const ai = getGeminiClient();
  let lastClassified: ClassifiedGeminiError | null = null;
  let lastErrorRaw: unknown = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      const configObj: Record<string, any> = {
        systemInstruction: options.systemInstruction,
        temperature: options.temperature ?? 0.7,
      };

      if (options.responseMimeType) {
        configObj.responseMimeType = options.responseMimeType;
      }
      if (options.responseSchema) {
        configObj.responseSchema = options.responseSchema;
      }

      const response = await ai.models.generateContent({
        model,
        contents: options.contents as any,
        config: configObj,
      });

      if (response && response.text) {
        return {
          text: response.text,
          modelUsed: model,
        };
      }
    } catch (err: any) {
      const classified = classifyGeminiError(err);
      lastClassified = classified;
      lastErrorRaw = err;

      // Safe internal logging without exposing keys, tokens, or private memory content
      console.warn(
        `[Gemini Fallback] Model ${model} encountered ${classified.category} (code=${classified.code}). Moving to next fallback.`
      );

      // If error is configuration/authentication or validation, trying other models won't help
      if (
        classified.category === 'AUTHENTICATION_OR_CONFIGURATION_FAILURE' ||
        classified.category === 'VALIDATION_FAILURE'
      ) {
        throw new GeminiServiceError(classified, err?.message);
      }

      // If error is rate limited or temporary, we proceed immediately to the NEXT fallback model
      // without repeatedly hammering the exhausted model.
    }
  }

  const finalClassified =
    lastClassified ||
    classifyGeminiError(lastErrorRaw || new Error('All models in fallback ladder failed.'));

  throw new GeminiServiceError(finalClassified, (lastErrorRaw as any)?.message);
}

/**
 * Standardized server-side error responder for all Gemini endpoints.
 * Guarantees zero leakage of API keys, tokens, raw prompts, or internal stack traces.
 */
export function sendSafeGeminiErrorResponse(
  res: Response,
  err: unknown,
  contextLabel?: string
): void {
  const classified: ClassifiedGeminiError =
    err instanceof GeminiServiceError ? err.classified : classifyGeminiError(err);

  // Log diagnostic context strictly on the server
  console.error(`[Gemini Safe Error] ${contextLabel || 'Operation failed'}:`, {
    category: classified.category,
    httpStatus: classified.httpStatus,
    code: classified.code,
  });

  res.status(classified.httpStatus).json({
    ok: false,
    success: false,
    error: {
      code: classified.code,
      title: classified.title,
      message: classified.message,
      retryable: classified.retryable,
      cooldownSeconds: classified.cooldownSeconds,
    },
  });
}
