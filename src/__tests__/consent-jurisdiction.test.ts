// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp } from "vue";
import { ConsentManager } from "../core/consent-manager";
import { useConsent } from "../vue/index";
import { storeConsent } from "../core/storage";
import { installCookieJar } from "./helpers/cookie-jar";
import type { ConsentConfig, GeoDetectionResult } from "../core/types";

// Whether the banner is shown follows the consent jurisdictions (EEA and UK by default, CH on
// request), decided from the visitor's country, and a failed lookup asks for consent unless
// the site chose `geoFailure: 'grant'`.

let cookieStore = "";

beforeEach(() => {
  cookieStore = "";
  installCookieJar(
    () => cookieStore,
    (jar) => {
      cookieStore = jar;
    }
  );
  vi.restoreAllMocks();
});

function detecting(result: GeoDetectionResult): ConsentConfig["geoDetector"] {
  return { detect: vi.fn().mockResolvedValue(result) };
}

const failing: ConsentConfig["geoDetector"] = {
  detect: vi.fn().mockRejectedValue(new Error("lookup blocked")),
};

async function started(config: ConsentConfig): Promise<{
  manager: ConsentManager;
  showBanner: ReturnType<typeof vi.fn>;
}> {
  const manager = new ConsentManager({ version: "1.0", ...config });
  const showBanner = vi.fn();
  manager.onShowBanner(showBanner);
  await manager.init();
  return { manager, showBanner };
}

describe("consent jurisdictions", () => {
  it("asks a visitor whose country requires consent, whatever the detector's EU flag", async () => {
    // Regression: a detector answering consentRequired:false for Norway (ipapi's in_eu, Cloudflare's flag,
    // a custom detector) granted every category silently.
    const { manager, showBanner } = await started({
      geoDetector: detecting({ consentRequired: false, countryCode: "NO", method: "api" }),
    });

    expect(showBanner).toHaveBeenCalledTimes(1);
    expect(manager.isConsentRequired()).toBe(true);
    expect(manager.getConsent()).toBeNull();
  });

  it("does not ask a visitor whose country is outside the jurisdictions", async () => {
    // The wrong-result direction: a detector's stale `true` for a non-consent country does not
    // stand once the country is known.
    const { manager, showBanner } = await started({
      geoDetector: detecting({ consentRequired: true, countryCode: "US", method: "api" }),
    });

    expect(showBanner).not.toHaveBeenCalled();
    expect(manager.isConsentRequired()).toBe(false);
  });

  it("asks a visitor in Switzerland only when CH is configured", async () => {
    const swiss = { consentRequired: false, countryCode: "CH", method: "api" as const };

    const byDefault = await started({ geoDetector: detecting(swiss) });
    expect(byDefault.showBanner).not.toHaveBeenCalled();

    const withCH = await started({
      geoDetector: detecting(swiss),
      consentJurisdictions: ["EEA", "UK", "CH"],
    });
    expect(withCH.showBanner).toHaveBeenCalledTimes(1);
    expect(withCH.manager.getGeoResult()?.consentRequired).toBe(true);
  });

  it("follows the detector's answer when it gives no country", async () => {
    const asked = await started({
      geoDetector: detecting({ consentRequired: true, method: "manual" }),
    });
    expect(asked.showBanner).toHaveBeenCalledTimes(1);

    const notAsked = await started({
      geoDetector: detecting({ consentRequired: false, method: "manual" }),
    });
    expect(notAsked.showBanner).not.toHaveBeenCalled();
  });

  it("reads isEU from a custom detector written for an earlier version", async () => {
    // Regression: a detector returning only isEU (the field's earlier name) gave undefined for
    // consentRequired, read as false: a visitor in the EU was granted every category.
    const legacy = { isEU: true, method: "manual" } as unknown as GeoDetectionResult;

    const { manager, showBanner } = await started({ geoDetector: detecting(legacy) });

    expect(showBanner).toHaveBeenCalledTimes(1);
    expect(manager.isConsentRequired()).toBe(true);
    expect(manager.getGeoResult()).not.toHaveProperty("isEU");
  });

  it("treats a detector answer with neither flag nor country as a failed lookup", async () => {
    // Nothing tells where the visitor is: geoFailure decides, asking by default.
    const empty = { method: "manual" } as unknown as GeoDetectionResult;

    const asked = await started({ geoDetector: detecting(empty) });
    expect(asked.showBanner).toHaveBeenCalledTimes(1);

    const granted = await started({ geoDetector: detecting(empty), geoFailure: "grant" });
    expect(granted.showBanner).not.toHaveBeenCalled();
  });

  it("shows the configured decision in the attempt log of a chained detector", async () => {
    // The chain decided with the default jurisdictions; with CH configured the attempt that
    // answered reports the manager's decision, as getGeoResult() does. Failed attempts stay.
    const failed = {
      method: "cloudflare" as const,
      status: "failed" as const,
      error: "no headers",
      duration: 3,
    };
    const answered = {
      method: "api" as const,
      status: "success" as const,
      result: { consentRequired: false, countryCode: "CH" },
      duration: 5,
    };
    const { manager } = await started({
      consentJurisdictions: ["EEA", "UK", "CH"],
      geoDetector: {
        detect: vi.fn().mockResolvedValue({
          consentRequired: false,
          countryCode: "CH",
          method: "api",
          log: [failed, answered],
        }),
      },
    });

    expect(manager.getGeoDetectionLog()).toEqual([
      failed,
      { ...answered, result: { consentRequired: true, countryCode: "CH" } },
    ]);
  });

  it("exposes isConsentRequired() through useConsent()", async () => {
    // The Vue composable hands the decision to templates.
    const { manager } = await started({
      geoDetector: detecting({ consentRequired: false, countryCode: "NO", method: "api" }),
    });
    const app = createApp({});
    app.provide("consentManager", manager);

    const consent = app.runWithContext(() => useConsent());

    expect(consent.isConsentRequired()).toBe(true);
  });

  it("stores the choice of a visitor asked by country as given in a consent jurisdiction", async () => {
    // The stored flag lets a later visit skip the roaming check, as for a choice made in the EU.
    const { manager } = await started({
      geoDetector: detecting({ consentRequired: false, countryCode: "IS", method: "api" }),
    });

    await manager.rejectAll();

    expect(manager.getConsent()?.consentRequired).toBe(true);
  });
});

/** A consent cookie as earlier versions wrote it, with the location flag under `isEU`. */
function legacyCookie(isEU: boolean): string {
  return `consent_preferences=${encodeURIComponent(
    JSON.stringify({
      categories: { analytics: true, marketing: false, functional: true },
      timestamp: Date.now(),
      version: "1.0",
      isEU,
      countryCode: isEU ? "DE" : "US",
    })
  )}`;
}

describe("consent cookies written before consentRequired", () => {
  it("restores a choice made in a consent jurisdiction without asking again", async () => {
    // The flag was renamed; a visitor's stored choice must survive the upgrade.
    cookieStore = legacyCookie(true);
    const detect = vi.fn();

    const { manager, showBanner } = await started({ geoDetector: { detect } });

    expect(detect).not.toHaveBeenCalled();
    expect(showBanner).not.toHaveBeenCalled();
    expect(manager.isConsentRequired()).toBe(true);
    expect(manager.getConsent()?.consentRequired).toBe(true);
    expect(manager.getConsent()).not.toHaveProperty("isEU");
  });

  it("checks the location of a choice made outside, as before", async () => {
    cookieStore = legacyCookie(false);
    const detect = vi.fn().mockResolvedValue({ consentRequired: false, countryCode: "NO" });

    const { showBanner } = await started({ geoDetector: { detect } });

    expect(detect).toHaveBeenCalledTimes(1);
    expect(showBanner).toHaveBeenCalledTimes(1);
  });

  it("writes the flag under its new name only", async () => {
    storeConsent(
      {
        categories: { analytics: false, marketing: false, functional: false },
        consentRequired: true,
      },
      { version: "1.0" }
    );

    const raw = JSON.parse(decodeURIComponent(cookieStore.split("=").slice(1).join("=")));
    expect(raw.consentRequired).toBe(true);
    expect(raw).not.toHaveProperty("isEU");
  });
});

describe("geoFailure", () => {
  it("asks for consent when the lookup fails, by default", async () => {
    // Regression: a failed lookup (an ad blocker on the IP API) was taken for a visitor outside
    // consent jurisdictions and granted every category.
    const { manager, showBanner } = await started({ geoDetector: failing });

    expect(showBanner).toHaveBeenCalledTimes(1);
    expect(manager.isConsentRequired()).toBe(true);
    expect(manager.getConsent()).toBeNull();
    expect(manager.getGeoDetectionLog()).toEqual([
      expect.objectContaining({ method: "fallback", status: "failed" }),
    ]);
  });

  it("grants as outside consent jurisdictions when the lookup fails with 'grant'", async () => {
    const { manager, showBanner } = await started({ geoDetector: failing, geoFailure: "grant" });

    expect(showBanner).not.toHaveBeenCalled();
    expect(manager.isConsentRequired()).toBe(false);
    expect(manager.getSettledConsent()).toBeNull();
  });

  it("asks again when the roaming check of a choice made outside fails, by default", async () => {
    // A failed lookup is not evidence the visitor is still outside: the choice stored outside a
    // consent jurisdiction does not stand, and the visitor is asked.
    storeConsent(
      {
        categories: { analytics: true, marketing: true, functional: true },
        consentRequired: false,
      },
      { version: "1.0" }
    );

    const { manager, showBanner } = await started({ geoDetector: failing });

    expect(showBanner).toHaveBeenCalledTimes(1);
    expect(manager.hasConsent()).toBe(false);
    expect(manager.isConsentRequired()).toBe(true);
  });

  it("keeps a choice made outside when the roaming check fails with 'grant'", async () => {
    storeConsent(
      {
        categories: { analytics: true, marketing: false, functional: true },
        consentRequired: false,
      },
      { version: "1.0" }
    );

    const { manager, showBanner } = await started({ geoDetector: failing, geoFailure: "grant" });

    expect(showBanner).not.toHaveBeenCalled();
    expect(manager.getConsent()?.categories.analytics).toBe(true);
    expect(manager.isConsentRequired()).toBe(false);
  });

  it("restores a remote refusal when the lookup fails with 'grant'", async () => {
    // Regression: the failed lookup inside the remote restore was taken for a failed storage
    // read; the outside-jurisdiction grant then replaced the stored refusal.
    cookieStore = "consent_uid=visitor-1";
    const refusal = {
      categories: { analytics: false, marketing: false, functional: false },
      timestamp: Date.now(),
      version: "1.0",
    };
    const storage = { get: vi.fn().mockResolvedValue(refusal), set: vi.fn() };

    const { manager, showBanner } = await started({
      storage,
      geoDetector: failing,
      geoFailure: "grant",
    });

    expect(storage.get).toHaveBeenCalledWith("visitor-1", "1.0");
    expect(showBanner).not.toHaveBeenCalled();
    expect(manager.getConsent()?.categories).toEqual(refusal.categories);
  });

  it("asks, keeping the remote identity, when the lookup fails for a remote choice", async () => {
    // By default a failed lookup counts as a consent jurisdiction: the remote choice, made
    // without the disclosure, is not adopted, but the location is only unknown, so the
    // identifier that reaches it stays.
    cookieStore = "consent_uid=visitor-1";
    const grant = {
      categories: { analytics: true, marketing: true, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };
    const storage = { get: vi.fn().mockResolvedValue(grant), set: vi.fn() };

    const { manager, showBanner } = await started({ storage, geoDetector: failing });

    expect(showBanner).toHaveBeenCalledTimes(1);
    expect(manager.getConsent()).toBeNull();
    expect(cookieStore).toContain("consent_uid=visitor-1");
  });

  it("keeps the attempts of a failed auto detection in the log", async () => {
    // The debug panel shows which methods failed, not a single generic entry.
    const log = [
      { method: "cloudflare" as const, status: "failed" as const, error: "x", duration: 1 },
      { method: "api" as const, status: "failed" as const, error: "y", duration: 2 },
    ];
    const { GeoDetectionError } = await import("../geo/index");
    const { manager } = await started({
      geoDetector: { detect: vi.fn().mockRejectedValue(new GeoDetectionError("all failed", log)) },
    });

    expect(manager.getGeoDetectionLog()).toEqual([
      ...log,
      expect.objectContaining({ method: "fallback", status: "failed" }),
    ]);
  });
});
