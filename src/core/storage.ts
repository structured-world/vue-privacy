import type {
  StoredConsent,
  ConsentConfig,
  CookieConfigDefaults,
  ConsentStorage,
  KVStorageOptions,
} from "./types";
import { DEFAULT_CONFIG } from "./types";
import { limitToUsed } from "./categories";

/** Default total number of fetch attempts for rate-limited requests (initial + retries) */
const DEFAULT_MAX_ATTEMPTS = 3;

/** Maximum delay in milliseconds to prevent excessive waits from malicious Retry-After headers */
const MAX_RETRY_DELAY_MS = 30_000; // 30 seconds

/**
 * Sleep for a given number of milliseconds; an abort ends the wait early.
 * @internal
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    // An abort that already happened (from the onRateLimited callback) fires no event.
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
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
    // Note: Only numeric delay-seconds format supported (HTTP-date format is rare and not used by vue-privacy-worker)
    const retryAfterHeader = response.headers.get("Retry-After");
    const parsedRetryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
    // Validate: must be a positive number (0 and negative values are treated as invalid, use exponential backoff instead)
    const retryAfterSeconds =
      parsedRetryAfter !== null && !isNaN(parsedRetryAfter) && parsedRetryAfter > 0
        ? parsedRetryAfter
        : null;

    // Use Retry-After header if valid, otherwise exponential backoff: 1s, 2s, 4s
    // Cap at MAX_RETRY_DELAY_MS to prevent excessive waits from malicious headers
    const rawDelayMs =
      retryAfterSeconds !== null ? retryAfterSeconds * 1000 : Math.pow(2, attempt - 1) * 1000;
    const delayMs = Math.min(rawDelayMs, MAX_RETRY_DELAY_MS);

    // Notify callback before waiting
    // Wrap in try-catch so callback errors don't abort the retry loop
    try {
      onRateLimited?.(retryAfterSeconds, attempt);
    } catch {
      // Callback errors are ignored - retry continues regardless
    }

    // Don't wait after the last attempt. An aborted request stops waiting; its next fetch then
    // rejects at once with the abort.
    if (attempt < effectiveMaxRetries) {
      await sleep(delayMs, options.signal ?? undefined);
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

  // document.cookie throws a SecurityError in a sandboxed (opaque-origin) document; there is
  // nothing stored to read then.
  let jar: string;
  try {
    jar = document.cookie;
  } catch {
    return null;
  }
  const cookies = jar.split(";");
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split("=");
    if (key === name) {
      // A value written raw by another app or a server (a lone `%`) does not decode; it is no
      // value of ours, so it counts as absent instead of failing whatever reads it.
      try {
        return decodeURIComponent(value);
      } catch {
        return null;
      }
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

  writeCookie(cookieString);
}

/**
 * Cookie storage is best-effort: in a sandboxed (opaque-origin) document the write throws a
 * SecurityError, and a visitor's choice must still take effect on the page without it.
 */
function writeCookie(cookie: string): void {
  try {
    document.cookie = cookie;
  } catch {
    // Nothing to persist into; the consent manager keeps this page's choice in memory.
  }
}

/**
 * Delete cookie
 */
export function deleteCookie(name: string, path = "/", domain?: string): void {
  if (typeof document === "undefined") return;
  let cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
  if (domain) cookie += `; domain=${domain}`;
  writeCookie(cookie);
}

/** A plain JSON object (not null, not an array). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The categories every written record holds. */
const OPTIONAL_CATEGORIES = ["analytics", "marketing", "functional"] as const;

/**
 * Whether a parsed cookie has the fields and types the library writes. Categories are read by
 * truthiness downstream, so a string "false" would count as a grant and a missing one as a
 * refusal nobody made: anything else is no choice, and the visitor is asked again.
 */
function hasStoredTypes(record: Record<string, unknown>, categories: Record<string, unknown>) {
  const isFlag = (value: unknown) => value === undefined || typeof value === "boolean";
  return (
    OPTIONAL_CATEGORIES.every((category) => typeof categories[category] === "boolean") &&
    Object.values(categories).every((granted) => typeof granted === "boolean") &&
    // JSON.stringify writes no Infinity, so an overflowing literal (1e400) was never ours.
    Number.isFinite(record.timestamp) &&
    typeof record.version === "string" &&
    (record.revision === undefined || typeof record.revision === "string") &&
    // Each flag present is checked itself: a malformed consentRequired is not replaced by isEU.
    isFlag(record.consentRequired) &&
    isFlag(record.isEU)
  );
}

/** The fields the consent cookie holds. */
const STORED_FIELDS = new Set([
  "categories",
  "timestamp",
  "version",
  "consentRequired",
  "revision",
]);

/**
 * The consent cookie, as stored, whatever its version, or null. `outdated`: it was written by an
 * earlier version, with the location (`countryCode`, `region`, `geoMethod`) or with
 * `consentRequired` under its earlier name `isEU`; those are not kept.
 */
function parseConsentCookie(
  config: Partial<ConsentConfig>
): { consent: StoredConsent; outdated: boolean } | null {
  const raw = getCookie(config.cookie?.name ?? DEFAULT_CONFIG.cookie.name);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  // Valid JSON that is no consent record (null, a number, a record without categories, written
  // by hand or by another app under the same name) counts as no cookie.
  if (!isRecord(parsed) || !isRecord(parsed.categories)) return null;
  if (!hasStoredTypes(parsed, parsed.categories)) return null;
  const stored = parsed as unknown as StoredConsent & { isEU?: boolean };
  const consentRequired = stored.consentRequired ?? stored.isEU;
  return {
    consent: {
      categories: stored.categories,
      timestamp: stored.timestamp,
      version: stored.version,
      ...(stored.revision !== undefined && { revision: stored.revision }),
      ...(consentRequired !== undefined && { consentRequired }),
    },
    outdated: Object.keys(parsed).some((key) => !STORED_FIELDS.has(key)),
  };
}

/**
 * Get stored consent from cookie
 */
export function getStoredConsent(config: Partial<ConsentConfig> = {}): StoredConsent | null {
  const read = parseConsentCookie(config);
  // A different version: the consent no longer applies.
  if (read === null || read.consent.version !== (config.version ?? DEFAULT_CONFIG.version)) {
    return null;
  }
  // A category the site no longer uses was never asked about in its current dialog. When that
  // leaves nothing granted, the consent manager's restore drops consent_uid too.
  return { ...read.consent, categories: limitToUsed(read.consent.categories, config) };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rewrite a consent cookie an earlier version wrote, keeping the choice and its timestamp (the
 * other open tabs see no new decision) and dropping what it no longer holds. The rewrite keeps
 * what is left of the lifetime counted from the choice; one past it, or one for another consent
 * version (no consent any more), is deleted instead. A cookie already in the current format is
 * left alone: rewriting it would restart its lifetime on every visit.
 */
export function migrateConsentCookie(config: Partial<ConsentConfig> = {}): void {
  const read = parseConsentCookie(config);
  if (!read?.outdated) return;
  if (read.consent.version !== (config.version ?? DEFAULT_CONFIG.version)) {
    clearConsent(config);
    return;
  }
  const lifetime = config.cookie?.expiry ?? DEFAULT_CONFIG.cookie.expiry;
  const { timestamp } = read.consent;
  const remaining = Number.isFinite(timestamp)
    ? lifetime - (Date.now() - timestamp) / DAY_MS
    : lifetime;
  if (remaining <= 0) {
    clearConsent(config);
    return;
  }
  storeConsent(read.consent, { ...config, cookie: { ...config.cookie, expiry: remaining } });
}

/**
 * Store consent in cookie
 */
export function storeConsent(
  consent: Omit<StoredConsent, "timestamp" | "version"> & { timestamp?: number },
  config: Partial<ConsentConfig> = {}
): void {
  const cookieConfig: CookieConfigDefaults = {
    ...DEFAULT_CONFIG.cookie,
    ...config.cookie,
  };
  const version = config.version ?? DEFAULT_CONFIG.version;

  const stored: StoredConsent = {
    ...(consent.revision !== undefined && { revision: consent.revision }),
    categories: consent.categories,
    // The caller's own record keeps its time: the page compares its choice to the cookie by it.
    timestamp: consent.timestamp ?? Date.now(),
    version,
    // Whether it was made in a consent jurisdiction; no location (StoredConsent).
    ...(consent.consentRequired !== undefined && { consentRequired: consent.consentRequired }),
  };

  setCookie(cookieConfig.name, JSON.stringify(stored), {
    expiry: cookieConfig.expiry,
    domain: cookieConfig.domain,
    path: cookieConfig.path,
  });
}

/** A decision identity independent of clock precision, also outside secure browser contexts. */
export function createConsentRevision(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(4));
  return Array.from(bytes, (value) => value.toString(16).padStart(8, "0")).join("");
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
 * Whether a cookie set with `cookiePath` is sent on `requestPath` (RFC 6265 5.1.4 path-match): the
 * paths are equal, or the cookie path is a prefix that ends with "/" or is followed by "/".
 * @internal
 */
export function cookiePathMatches(requestPath: string, cookiePath: string): boolean {
  if (requestPath === cookiePath) return true;
  if (!requestPath.startsWith(cookiePath)) return false;
  return cookiePath.endsWith("/") || requestPath.charAt(cookiePath.length) === "/";
}

/** Where a consent_uid cookie lives: the domain it was set for ("" host-only) and its path. */
interface CookieScope {
  domain: string;
  path: string;
}

function cookieScope(config: Partial<ConsentConfig>): CookieScope {
  return {
    domain: config.cookie?.domain ?? "",
    path: config.cookie?.path ?? DEFAULT_CONFIG.cookie.path,
  };
}

/**
 * One change of consent_uid by the site (setConsentUid() or clearConsentUid(), here or in
 * another tab): the ID (null: cleared), the scope of the cookie it changed, when it was made
 * (`at`, with `tie` for the same millisecond), the revision this page gave it on arrival, and the
 * value the cookie still showed here although the change replaced it (null: none).
 */
interface SiteUidChange {
  uid: string | null;
  scope: CookieScope;
  at: number;
  tie: string;
  revision: number;
  replaced: string | null;
}

/** The site's latest change for each cookie scope, by `${domain}:${path}`. */
const siteUidChanges = new Map<string, SiteUidChange>();

/** Advanced by each change this page applies, so a newer change always carries a newer revision. */
let siteUidRevision = 0;

/**
 * The latest `at` this page made or applied: a logical clock (Lamport) that puts each own change
 * after every change seen so far, in call order and also when the system clock reads earlier.
 */
let lastChangeAt = 0;

/** Whether change `a` was made after change `b`. */
function madeAfter(a: { at: number; tie: string }, b: { at: number; tie: string }): boolean {
  return a.at !== b.at ? a.at > b.at : a.tie > b.tie;
}

/**
 * The site's latest change of consent_uid that a consent manager with `config` sees: one whose
 * cookie is sent where that manager's consent cookie is (same domain, path-match), so apps of one
 * origin under other paths or domains do not take each other's account. `revision` advances with
 * each such change (0: none), and lets a manager that keeps an ID the cookie does not show (cleared
 * by a refusal, or a route outside cookie.path) tell a sign-in or sign-out apart from a route that
 * cannot read the cookie. `replaced` is an ID the cookie kept showing after that change (a blocked
 * write, a cookie of another path): it names a record the site left, not the visitor's.
 * @internal
 */
export function siteConsentUid(config: Partial<ConsentConfig> = {}): {
  revision: number;
  uid: string | null;
  replaced: string | null;
} {
  const own = cookieScope(config);
  let latest: SiteUidChange | null = null;
  for (const change of siteUidChanges.values()) {
    if (change.scope.domain !== own.domain || !cookiePathMatches(own.path, change.scope.path)) {
      continue;
    }
    if (latest === null || madeAfter(change, latest)) latest = change;
  }
  return latest
    ? { revision: latest.revision, uid: latest.uid, replaced: latest.replaced }
    : { revision: 0, uid: null, replaced: null };
}

/**
 * Apply a change of consent_uid, after it reached the cookie. One older than the latest change
 * already applied for its scope is dropped: broadcasts arrive asynchronously, and one from another
 * tab may come after this page's own newer change.
 */
function applySiteUidChange(change: Omit<SiteUidChange, "revision" | "replaced">): void {
  const key = `${change.scope.domain}:${change.scope.path}`;
  const current = siteUidChanges.get(key);
  if (current && !madeAfter(change, current)) return;
  lastChangeAt = Math.max(lastChangeAt, change.at);
  const shown = getConsentUid();
  siteUidChanges.set(key, {
    ...change,
    revision: ++siteUidRevision,
    replaced: shown !== null && shown !== change.uid ? shown : null,
  });
}

/** Carries the site's changes of consent_uid, with their scope, to its other open tabs. */
const SITE_UID_CHANNEL = "vue-privacy:consent_uid";

/** Open the channel; null where the browser refuses one (an opaque origin, sandboxed frames). */
function openChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(SITE_UID_CHANNEL);
  } catch {
    return null;
  }
}

/** This page's listening channel (null: refused), once a manager with remote storage asked. */
let siteUidChannel: BroadcastChannel | null | undefined;

/** A change another tab announced, or null for a message of any other shape. */
function announcedChange(data: unknown): Omit<SiteUidChange, "revision" | "replaced"> | null {
  if (typeof data !== "object" || data === null) return null;
  const { uid, domain, path, at, tie } = data as Record<string, unknown>;
  if (typeof domain !== "string" || typeof path !== "string") return null;
  if (typeof at !== "number" || typeof tie !== "string") return null;
  return { uid: typeof uid === "string" ? uid || null : null, scope: { domain, path }, at, tie };
}

/**
 * Follow the site's sign-ins and sign-outs in other tabs of this origin. A page that keeps a
 * record ID the consent_uid cookie does not show (a refusal removed it) cannot see another tab
 * clear it; the change is applied here as if the site had made it on this page. Without a channel
 * (Safari before 15.4, or refused, as in an opaque-origin frame) other tabs are not followed.
 * @internal
 */
export function followSiteConsentUid(): void {
  if (typeof document === "undefined" || siteUidChannel !== undefined) return;
  siteUidChannel = openChannel();
  if (!siteUidChannel) return;
  siteUidChannel.onmessage = (event: MessageEvent<unknown>) => {
    const change = announcedChange(event.data);
    if (change) applySiteUidChange(change);
  };
}

/** Record the site's change of consent_uid here and tell its other open tabs; best effort. */
function noteSiteConsentUid(uid: string | null, config: Partial<ConsentConfig>): void {
  const scope = cookieScope(config);
  const change = {
    uid,
    scope,
    at: Math.max(Date.now(), lastChangeAt + 1),
    tie: createConsentRevision(),
  };
  applySiteUidChange(change);
  // A posted message is queued for every other channel of the name at once, so a channel opened
  // only to send can close right away.
  const channel = siteUidChannel ?? openChannel();
  if (!channel) return;
  try {
    channel.postMessage({
      uid,
      domain: scope.domain,
      path: scope.path,
      at: change.at,
      tie: change.tie,
    });
  } catch {
    // Not delivered: other tabs then learn of the change from the cookie only.
  } finally {
    if (channel !== siteUidChannel) channel.close();
  }
}

/**
 * Get consent UID from cookie (used for KV re-identification). An empty value names no record.
 */
export function getConsentUid(): string | null {
  return getCookie("consent_uid") || null;
}

/**
 * Set consent UID cookie for re-identification. An empty ID names no record, as if cleared.
 */
export function setConsentUid(uid: string, config: Partial<ConsentConfig> = {}): void {
  if (typeof document === "undefined") return;
  writeConsentUid(uid, config);
  noteSiteConsentUid(uid || null, config);
}

/**
 * Clear consent UID cookie
 */
export function clearConsentUid(config: Partial<ConsentConfig> = {}): void {
  if (typeof document === "undefined") return;
  deleteConsentUid(config);
  noteSiteConsentUid(null, config);
}

/**
 * Write the consent_uid cookie for the consent manager itself, which tracks its own record and
 * is no sign-in or sign-out of the site.
 * @internal
 */
export function writeConsentUid(uid: string, config: Partial<ConsentConfig> = {}): void {
  setCookie("consent_uid", uid, {
    expiry: config.cookie?.expiry ?? DEFAULT_CONFIG.cookie.expiry,
    domain: config.cookie?.domain,
    path: config.cookie?.path ?? DEFAULT_CONFIG.cookie.path,
  });
}

/**
 * Remove the consent_uid cookie for the consent manager itself (see writeConsentUid()).
 * @internal
 */
export function deleteConsentUid(config: Partial<ConsentConfig> = {}): void {
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
 * @param signal - Aborts the request (and its rate-limit retries); the result is then null
 */
export async function pushRemoteConsent(
  storageUrl: string,
  uid: string | null,
  consent: StoredConsent,
  retryOptions?: RetryOptions,
  signal?: AbortSignal
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
      ...(signal && { signal }),
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
    maxRetries: options?.maxRetries ?? DEFAULT_MAX_ATTEMPTS,
    onRateLimited: options?.onRateLimited,
  };

  return {
    get: (uid, version) => fetchRemoteConsent(url, uid, version, retryOptions),
    set: (uid, consent, signal) => pushRemoteConsent(url, uid, consent, retryOptions, signal),
  };
}
