import type { StoredConsent, ConsentConfig, CookieConfigDefaults } from "./types";
import { DEFAULT_CONFIG } from "./types";

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
export function deleteCookie(name: string, path = "/"): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
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
  deleteCookie(cookieName, path);
}
