import type { GeoDetector, GeoDetectionResult } from "../core/types";

/**
 * Cloudflare geo-detection using headers
 *
 * Requires Cloudflare Worker or Transform Rule to set X-Is-EU-Country header
 */
export class CloudflareGeoDetector implements GeoDetector {
  private headerName: string;

  constructor(headerName = "X-Is-EU-Country") {
    this.headerName = headerName;
  }

  async detect(): Promise<GeoDetectionResult> {
    if (typeof document === "undefined") {
      return { isEU: false, method: "cloudflare" };
    }

    try {
      // Try to get the header by making a HEAD request to current page
      const response = await fetch(window.location.href, {
        method: "HEAD",
        cache: "no-store",
      });

      const isEUHeader = response.headers.get(this.headerName);
      const countryCode = response.headers.get("CF-IPCountry") ?? undefined;

      if (isEUHeader !== null) {
        return {
          isEU: isEUHeader.toLowerCase() === "true",
          countryCode,
          method: "cloudflare",
        };
      }

      // Header not present - Cloudflare not configured
      throw new Error("Cloudflare header not present");
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
        in_eu?: boolean;
        country_code?: string;
      };

      return {
        isEU: data.in_eu === true,
        countryCode: data.country_code,
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
      const data = (await response.json()) as {
        isEU?: boolean;
        countryCode?: string;
      };

      return {
        isEU: data.isEU === true,
        countryCode: data.countryCode ?? undefined,
        method: "worker",
      };
    } catch {
      throw new Error("Worker geo-detection failed");
    }
  }
}

/**
 * Fallback detector that uses browser timezone heuristics
 *
 * Not 100% accurate but works without external requests
 */
export class TimezoneGeoDetector implements GeoDetector {
  // EU timezones (not exhaustive but covers most)
  private euTimezones = new Set([
    "Europe/Amsterdam",
    "Europe/Andorra",
    "Europe/Athens",
    "Europe/Berlin",
    "Europe/Bratislava",
    "Europe/Brussels",
    "Europe/Bucharest",
    "Europe/Budapest",
    "Europe/Copenhagen",
    "Europe/Dublin",
    "Europe/Helsinki",
    "Europe/Lisbon",
    "Europe/Ljubljana",
    "Europe/Luxembourg",
    "Europe/Madrid",
    "Europe/Malta",
    "Europe/Monaco",
    "Europe/Oslo",
    "Europe/Paris",
    "Europe/Prague",
    "Europe/Riga",
    "Europe/Rome",
    "Europe/San_Marino",
    "Europe/Sarajevo",
    "Europe/Skopje",
    "Europe/Sofia",
    "Europe/Stockholm",
    "Europe/Tallinn",
    "Europe/Tirane",
    "Europe/Vaduz",
    "Europe/Vatican",
    "Europe/Vienna",
    "Europe/Vilnius",
    "Europe/Warsaw",
    "Europe/Zagreb",
    "Atlantic/Canary",
    "Atlantic/Faroe",
    "Atlantic/Madeira",
  ]);

  async detect(): Promise<GeoDetectionResult> {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const isEU = this.euTimezones.has(timezone);

      return {
        isEU,
        method: "fallback",
      };
    } catch {
      // If we can't determine, assume EU for safety
      return {
        isEU: true,
        method: "fallback",
      };
    }
  }
}

/**
 * Auto-detection chain:
 * Cloudflare headers → Worker /api/geo (if geoUrl set) → IP API → Timezone
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

  async detect(): Promise<GeoDetectionResult> {
    // Try Cloudflare headers first (fastest, most reliable if available)
    try {
      return await this.cloudflare.detect();
    } catch {
      // Cloudflare not available, continue
    }

    // Try Worker /api/geo (free, no rate limits, accurate)
    if (this.worker) {
      try {
        return await this.worker.detect();
      } catch {
        // Worker not available, continue
      }
    }

    // Try IP API (external service, rate-limited)
    try {
      return await this.ipapi.detect();
    } catch {
      // IP API failed, continue
    }

    // Fallback to timezone heuristics
    return await this.timezone.detect();
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
        detect: async () => ({ isEU: true, method: "manual" as const }),
      };
    case "never":
      return {
        detect: async () => ({ isEU: false, method: "manual" as const }),
      };
    case "auto":
    default:
      return new AutoGeoDetector(geoUrl);
  }
}
