// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConsentManager } from "../core/consent-manager";
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
    // Regression: a detector answering isEU: false for Norway (ipapi's in_eu, Cloudflare's flag,
    // a custom detector) granted every category silently.
    const { manager, showBanner } = await started({
      geoDetector: detecting({ isEU: false, countryCode: "NO", method: "api" }),
    });

    expect(showBanner).toHaveBeenCalledTimes(1);
    expect(manager.isConsentRequired()).toBe(true);
    expect(manager.getConsent()).toBeNull();
  });

  it("does not ask a visitor whose country is outside the jurisdictions", async () => {
    // The wrong-result direction: a detector's stale `true` for a non-consent country does not
    // stand once the country is known.
    const { manager, showBanner } = await started({
      geoDetector: detecting({ isEU: true, countryCode: "US", method: "api" }),
    });

    expect(showBanner).not.toHaveBeenCalled();
    expect(manager.isConsentRequired()).toBe(false);
  });

  it("asks a visitor in Switzerland only when CH is configured", async () => {
    const swiss = { isEU: false, countryCode: "CH", method: "api" as const };

    const byDefault = await started({ geoDetector: detecting(swiss) });
    expect(byDefault.showBanner).not.toHaveBeenCalled();

    const withCH = await started({
      geoDetector: detecting(swiss),
      consentJurisdictions: ["EEA", "UK", "CH"],
    });
    expect(withCH.showBanner).toHaveBeenCalledTimes(1);
    expect(withCH.manager.getGeoResult()?.isEU).toBe(true);
  });

  it("follows the detector's answer when it gives no country", async () => {
    const asked = await started({ geoDetector: detecting({ isEU: true, method: "manual" }) });
    expect(asked.showBanner).toHaveBeenCalledTimes(1);

    const notAsked = await started({ geoDetector: detecting({ isEU: false, method: "manual" }) });
    expect(notAsked.showBanner).not.toHaveBeenCalled();
  });

  it("keeps isEUUser() as an alias of isConsentRequired()", async () => {
    const { manager } = await started({
      geoDetector: detecting({ isEU: false, countryCode: "GB", method: "api" }),
    });

    expect(manager.isEUUser()).toBe(true);
    expect(manager.isEUUser()).toBe(manager.isConsentRequired());
  });

  it("stores the choice of a visitor asked by country as given in a consent jurisdiction", async () => {
    // The stored flag lets a later visit skip the roaming check, as for a choice made in the EU.
    const { manager } = await started({
      geoDetector: detecting({ isEU: false, countryCode: "IS", method: "api" }),
    });

    await manager.rejectAll();

    expect(manager.getConsent()?.isEU).toBe(true);
    expect(manager.getConsent()?.countryCode).toBe("IS");
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
        isEU: false,
        countryCode: "US",
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
        isEU: false,
        countryCode: "US",
      },
      { version: "1.0" }
    );

    const { manager, showBanner } = await started({ geoDetector: failing, geoFailure: "grant" });

    expect(showBanner).not.toHaveBeenCalled();
    expect(manager.getConsent()?.categories.analytics).toBe(true);
    expect(manager.isConsentRequired()).toBe(false);
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
