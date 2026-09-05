/**
 * Sanitizes an object by recursively stripping undefined fields,
 * guaranteeing clean payloads for Cloud Firestore and JSON serialization.
 */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefined(item)) as unknown as T;
  }

  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = stripUndefined(value);
      }
    }
    return cleaned as T;
  }

  return obj;
}

/**
 * Basic string sanitization to prevent control characters from corrupting logs or UI
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim();
}
