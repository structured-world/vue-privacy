import type {
  GeoDetector,
  GeoDetectionResult,
  GeoDetectionLogEntry,
  GeoDetectionResultWithLog,
} from "../core/types";
import { TIMEZONE_COUNTRIES, knownCountry, requiresConsent } from "./jurisdictions";

/**
 * Cloudflare geo-detection using headers
 *
 * Requires a Cloudflare Worker or Transform Rule to set `CF-IPCountry` (and optionally
 * `X-Is-EU-Country`) on the response. Cloudflare's EU flag covers EU members only, so `false`
 * without a country is not an answer for the EEA or the UK and counts as a failure.
 */
export class CloudflareGeoDetector implements GeoDetector {
  private headerName: string;

  constructor(headerName = "X-Is-EU-Country") {
    this.headerName = headerName;
  }

  async detect(): Promise<GeoDetectionResult> {
    // Without a page (server rendering) there is no response to read: no answer.
    if (typeof document === "undefined") throw new Error("Cloudflare geo-detection failed");

    try {
      // Try to get the header by making a HEAD request to current page
      const response = await fetch(window.location.href, {
        method: "HEAD",
        cache: "no-store",
      });

      const isEUHeader = response.headers.get(this.headerName);
      // XX (unknown) and T1 (Tor) name no country.
      const countryCode = knownCountry(response.headers.get("CF-IPCountry") ?? undefined);
      const inEU = isEUHeader?.toLowerCase() === "true";

      // Neither a country nor a positive EU flag: Cloudflare is not configured, or its flag
      // cannot tell a visitor in Norway or the UK from one in the US.
      if (!countryCode && !inEU) throw new Error("Cloudflare headers not present");
      return {
        consentRequired: requiresConsent(countryCode, inEU),
        countryCode,
        method: "cloudflare",
      };
    } catch {
      throw new Error("Cloudflare geo-detection failed");
    }
  }
}

/**
 * IP API geo-detection using ipapi.co
 *
 * Free tier: 1000 requests/day
 * No API key required for basic usage
 */
export class IPAPIGeoDetector implements GeoDetector {
  private apiUrl: string;

  constructor(apiUrl = "https://ipapi.co/json/") {
    this.apiUrl = apiUrl;
  }

  async detect(): Promise<GeoDetectionResult> {
    try {
      const response = await fetch(this.apiUrl);
      const data = (await response.json()) as {
        country_code?: string;
        region?: string;
      };
      // `in_eu` is false for the EEA EFTA states and the UK; the country decides instead. An
      // error body (rate limit, invalid request) carries no country and is no answer.
      const countryCode = knownCountry(data.country_code);
      if (countryCode === undefined) throw new Error("No country in the response");

      return {
        consentRequired: requiresConsent(countryCode, false),
        countryCode,
        region: data.region ?? undefined,
        method: "api",
      };
    } catch {
      throw new Error("IP API geo-detection failed");
    }
  }
}

/**
 * Worker-based geo-detection using Cloudflare Worker /api/geo endpoint
 *
 * Uses request.cf data from Cloudflare edge — free, no rate limits, accurate.
 * Requires vue-privacy-worker (or compatible endpoint) deployed on the same domain.
 */
export class WorkerGeoDetector implements GeoDetector {
  private geoUrl: string;

  constructor(geoUrl: string) {
    this.geoUrl = geoUrl;
  }

  async detect(): Promise<GeoDetectionResult> {
    try {
      const response = await fetch(this.geoUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // The endpoint's own response format (vue-privacy-worker): `isEU` is Cloudflare's EU flag.
      const data = (await response.json()) as {
        isEU?: boolean;
        countryCode?: string;
        region?: string;
      };
      const inEU = data.isEU === true;
      // It copies Cloudflare's request.cf.country: XX (unknown) and T1 (Tor) name no country.
      const countryCode = knownCountry(data.countryCode);
      // Like Cloudflare's, the endpoint's EU flag says nothing about the EEA or the UK.
      if (countryCode === undefined && !inEU) throw new Error("No country in the response");

      return {
        consentRequired: requiresConsent(countryCode, inEU),
        countryCode,
        region: data.region ?? undefined,
        method: "worker",
      };
    } catch {
      throw new Error("Worker geo-detection failed");
    }
  }
}

/** Zones that carry no location: privacy-hardened browsers report UTC wherever they are. */
const LOCATIONLESS_ZONE = /^(?:Etc\/.*|UTC|UCT|GMT|Universal|Zulu|Greenwich)$/;

/**
 * Fallback detector that uses the browser's time zone
 *
 * A zone of a consent country gives that country; any other zone a visitor outside them. Not
 * fully accurate (a traveller keeps a home zone) but works without external requests.
 */
export class TimezoneGeoDetector implements GeoDetector {
  async detect(): Promise<GeoDetectionResult> {
    let timezone: string | undefined;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Leaves the zone unknown, a failure below.
    }
    if (!timezone || LOCATIONLESS_ZONE.test(timezone)) {
      throw new Error("Timezone geo-detection failed");
    }
    const countryCode = TIMEZONE_COUNTRIES[timezone];
    if (countryCode === undefined) return { consentRequired: false, method: "fallback" };
    return {
      consentRequired: requiresConsent(countryCode, false),
      countryCode,
      method: "fallback",
    };
  }
}

/** Every detection method failed; `log` holds each attempt. */
export class GeoDetectionError extends Error {
  readonly log: GeoDetectionLogEntry[];

  constructor(message: string, log: GeoDetectionLogEntry[]) {
    super(message);
    this.name = "GeoDetectionError";
    this.log = log;
  }
}

/**
 * Auto-detection chain:
 * Cloudflare headers → Worker /api/geo (if geoUrl set) → IP API → Timezone
 *
 * Returns extended result with log of all detection attempts for debugging.
 */
export class AutoGeoDetector implements GeoDetector {
  private cloudflare: CloudflareGeoDetector;
  private worker: WorkerGeoDetector | null;
  private ipapi: IPAPIGeoDetector;
  private timezone: TimezoneGeoDetector;

  constructor(geoUrl?: string) {
    this.cloudflare = new CloudflareGeoDetector();
    this.worker = geoUrl ? new WorkerGeoDetector(geoUrl) : null;
    this.ipapi = new IPAPIGeoDetector();
    this.timezone = new TimezoneGeoDetector();
  }

  async detect(): Promise<GeoDetectionResultWithLog> {
    const log: GeoDetectionLogEntry[] = [];

    // Try Cloudflare headers first (fastest, most reliable if available)
    const cfStart = Date.now();
    try {
      const result = await this.cloudflare.detect();
      log.push({
        method: "cloudflare",
        status: "success",
        result: {
          consentRequired: result.consentRequired,
          countryCode: result.countryCode,
          region: result.region,
        },
        duration: Date.now() - cfStart,
      });
      return { ...result, log };
    } catch (e) {
      log.push({
        method: "cloudflare",
        status: "failed",
        error: e instanceof Error ? e.message : "Unknown error",
        duration: Date.now() - cfStart,
      });
    }

    // Try Worker /api/geo (free, no rate limits, accurate)
    if (this.worker) {
      const workerStart = Date.now();
      try {
        const result = await this.worker.detect();
        log.push({
          method: "worker",
          status: "success",
          result: {
            consentRequired: result.consentRequired,
            countryCode: result.countryCode,
            region: result.region,
          },
          duration: Date.now() - workerStart,
        });
        return { ...result, log };
      } catch (e) {
        log.push({
          method: "worker",
          status: "failed",
          error: e instanceof Error ? e.message : "Unknown error",
          duration: Date.now() - workerStart,
        });
      }
    } else {
      // Worker skipped (not a failure, just not configured)
      log.push({
        method: "worker",
        status: "skipped",
        duration: 0,
      });
    }

    // Try IP API (external service, rate-limited)
    const apiStart = Date.now();
    try {
      const result = await this.ipapi.detect();
      log.push({
        method: "api",
        status: "success",
        result: {
          consentRequired: result.consentRequired,
          countryCode: result.countryCode,
          region: result.region,
        },
        duration: Date.now() - apiStart,
      });
      return { ...result, log };
    } catch (e) {
      log.push({
        method: "api",
        status: "failed",
        error: e instanceof Error ? e.message : "Unknown error",
        duration: Date.now() - apiStart,
      });
    }

    // Fallback to timezone heuristics
    const tzStart = Date.now();
    try {
      const result = await this.timezone.detect();
      log.push({
        method: "fallback",
        status: "success",
        result: { consentRequired: result.consentRequired, countryCode: result.countryCode },
        duration: Date.now() - tzStart,
      });
      return { ...result, log };
    } catch (e) {
      log.push({
        method: "fallback",
        status: "failed",
        error: e instanceof Error ? e.message : "Unknown error",
        duration: Date.now() - tzStart,
      });
    }
    // The manager's geoFailure option decides; the log stays readable on the error.
    throw new GeoDetectionError("All geo-detection methods failed", log);
  }
}

/**
 * Create a geo-detector based on mode
 */
export function createGeoDetector(
  mode: "auto" | "cloudflare" | "worker" | "api" | "always" | "never",
  geoUrl?: string
): GeoDetector {
  switch (mode) {
    case "cloudflare":
      return new CloudflareGeoDetector();
    case "worker":
      if (!geoUrl) throw new Error("geoUrl is required for worker geo-detection mode");
      return new WorkerGeoDetector(geoUrl);
    case "api":
      return new IPAPIGeoDetector();
    case "always":
      return {
        detect: async () => ({ consentRequired: true, method: "manual" as const }),
      };
    case "never":
      return {
        detect: async () => ({ consentRequired: false, method: "manual" as const }),
      };
    case "auto":
    default:
      return new AutoGeoDetector(geoUrl);
  }
}
