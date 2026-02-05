import type {
  StoredConsent,
  ConsentConfig,
  CookieConfigDefaults,
  ConsentStorage,
  KVStorageOptions,
} from "./types";
import { DEFAULT_CONFIG } from "./types";

/** Default maximum retry attempts for rate-limited requests */
const DEFAULT_MAX_RETRIES = 3;

/** Maximum delay in milliseconds to prevent excessive waits from malicious Retry-After headers */
const MAX_RETRY_DELAY_MS = 30_000; // 30 seconds

/**
 * Sleep for a given number of milliseconds.
 * @internal
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Internal options for fetchWithRetry
 */
interface RetryOptions {
  maxRetries: number;
  onRateLimited?: (retryAfter: number | null, attempt: number) => void;
}

/**
 * Fetch with automatic retry on 429 rate limit responses.
 * Uses exponential backoff with optional Retry-After header support.
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param retryOptions - Retry configuration
 * @returns Response from fetch (may be 429 if all retries exhausted)
 * @internal
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOptions: RetryOptions
): Promise<Response> {
  const { maxRetries, onRateLimited } = retryOptions;

  // Ensure at least one attempt is made even if maxRetries is 0 or negative
  const effectiveMaxRetries = Math.max(1, maxRetries);

  for (let attempt = 1; attempt <= effectiveMaxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status !== 429) {
      return response;
    }

    // Rate limited - calculate delay
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;

    // Use Retry-After header if valid, otherwise exponential backoff: 1s, 2s, 4s
    // Cap at MAX_RETRY_DELAY_MS to prevent excessive waits from malicious headers
    const rawDelayMs =
      retryAfterSeconds && !isNaN(retryAfterSeconds)
        ? retryAfterSeconds * 1000
        : Math.pow(2, attempt - 1) * 1000;
    const delayMs = Math.min(rawDelayMs, MAX_RETRY_DELAY_MS);

    // Notify callback before waiting
    onRateLimited?.(retryAfterSeconds, attempt);

    // Don't wait after the last attempt
    if (attempt < effectiveMaxRetries) {
      await sleep(delayMs);
    }
  }

  // All retries exhausted - return the last 429 response
  // The caller will handle !response.ok and return null
  return new Response(null, { status: 429, statusText: "Too Many Requests" });
}

/**
 * Get cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split("=");
    if (key === name) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Set cookie with options
 */
export function setCookie(
  name: string,
  value: string,
  options: {
    expiry?: number;
    domain?: string;
    path?: string;
    sameSite?: "Strict" | "Lax" | "None";
    secure?: boolean;
  } = {}
): void {
  if (typeof document === "undefined") return;

  const { expiry = 365, domain, path = "/", sameSite = "Lax", secure = false } = options;

  let cookieString = `${name}=${encodeURIComponent(value)}`;

  if (expiry) {
    const date = new Date();
    date.setTime(date.getTime() + expiry * 24 * 60 * 60 * 1000);
    cookieString += `; expires=${date.toUTCString()}`;
  }

  if (domain) {
    cookieString += `; domain=${domain}`;
  }

  cookieString += `; path=${path}`;
  cookieString += `; SameSite=${sameSite}`;

  if (secure || sameSite === "None") {
    cookieString += "; Secure";
  }

  document.cookie = cookieString;
}

/**
 * Delete cookie
 */
export function deleteCookie(name: string, path = "/", domain?: string): void {
  if (typeof document === "undefined") return;
  let cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
  if (domain) cookie += `; domain=${domain}`;
  document.cookie = cookie;
}

/**
 * Get stored consent from cookie
 */
export function getStoredConsent(config: Partial<ConsentConfig> = {}): StoredConsent | null {
  const cookieName = config.cookie?.name ?? DEFAULT_CONFIG.cookie.name;
  const version = config.version ?? DEFAULT_CONFIG.version;

  const raw = getCookie(cookieName);
  if (!raw) return null;

  try {
    const stored = JSON.parse(raw) as StoredConsent;

    // Check version - if different, consent is invalid
    if (stored.version !== version) {
      return null;
    }

    return stored;
  } catch {
    return null;
  }
}

/**
 * Store consent in cookie
 */
export function storeConsent(
  consent: Omit<StoredConsent, "timestamp" | "version">,
  config: Partial<ConsentConfig> = {}
): void {
  const cookieConfig: CookieConfigDefaults = {
    ...DEFAULT_CONFIG.cookie,
    ...config.cookie,
  };
  const version = config.version ?? DEFAULT_CONFIG.version;

  const stored: StoredConsent = {
    categories: consent.categories,
    timestamp: Date.now(),
    version,
    // Preserve geo data if provided (use !== undefined for consistent handling)
    ...(consent.isEU !== undefined && { isEU: consent.isEU }),
    ...(consent.geoMethod !== undefined && { geoMethod: consent.geoMethod }),
    ...(consent.countryCode !== undefined && { countryCode: consent.countryCode }),
  };

  setCookie(cookieConfig.name, JSON.stringify(stored), {
    expiry: cookieConfig.expiry,
    domain: cookieConfig.domain,
    path: cookieConfig.path,
  });
}

/**
 * Clear stored consent
 */
export function clearConsent(config: Partial<ConsentConfig> = {}): void {
  const cookieName = config.cookie?.name ?? DEFAULT_CONFIG.cookie.name;
  const path = config.cookie?.path ?? DEFAULT_CONFIG.cookie.path;
  deleteCookie(cookieName, path, config.cookie?.domain);
}

/**
 * Get consent UID from cookie (used for KV re-identification)
 */
export function getConsentUid(): string | null {
  return getCookie("consent_uid");
}

/**
 * Set consent UID cookie for re-identification
 */
export function setConsentUid(uid: string, config: Partial<ConsentConfig> = {}): void {
  setCookie("consent_uid", uid, {
    expiry: config.cookie?.expiry ?? DEFAULT_CONFIG.cookie.expiry,
    domain: config.cookie?.domain,
    path: config.cookie?.path ?? DEFAULT_CONFIG.cookie.path,
  });
}

/**
 * Clear consent UID cookie
 */
export function clearConsentUid(config: Partial<ConsentConfig> = {}): void {
  const path = config.cookie?.path ?? DEFAULT_CONFIG.cookie.path;
  deleteCookie("consent_uid", path, config.cookie?.domain);
}

/**
 * Fetch consent from remote KV storage
 *
 * @param storageUrl - Base URL of the KV storage API
 * @param uid - User ID to fetch consent for
 * @param version - Expected consent version (returns null if mismatch)
 * @param retryOptions - Optional retry configuration for rate limiting
 */
export async function fetchRemoteConsent(
  storageUrl: string,
  uid: string,
  version: string,
  retryOptions?: RetryOptions
): Promise<StoredConsent | null> {
  try {
    const url = `${storageUrl}?id=${encodeURIComponent(uid)}`;
    const res = retryOptions
      ? await fetchWithRetry(url, { method: "GET" }, retryOptions)
      : await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { found?: boolean; consent?: StoredConsent };
    if (!data.found || !data.consent) return null;
    if (data.consent.version !== version) return null;
    return {
      categories: data.consent.categories,
      timestamp: data.consent.timestamp ?? Date.now(),
      version,
    };
  } catch {
    return null;
  }
}

/**
 * Push consent to remote KV storage. Returns the user ID (generated by worker if not provided).
 *
 * @param storageUrl - Base URL of the KV storage API
 * @param uid - User ID (null for new users - worker will generate)
 * @param consent - Consent data to store
 * @param retryOptions - Optional retry configuration for rate limiting
 */
export async function pushRemoteConsent(
  storageUrl: string,
  uid: string | null,
  consent: StoredConsent,
  retryOptions?: RetryOptions
): Promise<string | null> {
  try {
    // Only send categories and version — timestamp is generated server-side by the worker
    const body: Record<string, unknown> = {
      categories: consent.categories,
      version: consent.version,
    };
    if (uid) body.id = uid;

    const fetchOptions: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };

    const res = retryOptions
      ? await fetchWithRetry(storageUrl, fetchOptions, retryOptions)
      : await fetch(storageUrl, fetchOptions);

    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Create a ConsentStorage backed by a Cloudflare KV Worker
 * (vue-privacy-worker compatible API).
 *
 * Supports automatic retry with exponential backoff on 429 rate limit responses.
 *
 * @param url - Base URL of the KV storage API (e.g., '/api/consent')
 * @param options - Optional configuration for rate limiting behavior
 *
 * @example
 * ```ts
 * import { createKVStorage } from '@structured-world/vue-privacy';
 *
 * // Basic usage
 * const manager = createConsentManager({
 *   gaId: 'G-XXXXXXXXXX',
 *   storage: createKVStorage('/api/consent'),
 * });
 *
 * // With rate limit callback
 * const storage = createKVStorage('/api/consent', {
 *   maxRetries: 5,
 *   onRateLimited: (retryAfter, attempt) => {
 *     console.log(`Rate limited, retry ${attempt}. Wait: ${retryAfter ?? 'exponential'}s`);
 *   },
 * });
 * ```
 */
export function createKVStorage(url: string, options?: KVStorageOptions): ConsentStorage {
  const retryOptions: RetryOptions = {
    maxRetries: options?.maxRetries ?? DEFAULT_MAX_RETRIES,
    onRateLimited: options?.onRateLimited,
  };

  return {
    get: (uid, version) => fetchRemoteConsent(url, uid, version, retryOptions),
    set: (uid, consent) => pushRemoteConsent(url, uid, consent, retryOptions),
  };
}
