// @vitest-environment jsdom
// A site offers only the optional categories it uses (`usedCategories`): the preference centres
// show only those, and an unused category is never granted, so its Google signals stay denied
// and it never makes a refusal look like a grant.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApp, nextTick } from "vue";
import { ConsentManager } from "../core/consent-manager";
import { storeConsent } from "../core/storage";
import { createModal } from "../vanilla/modal";
import ConsentPreferenceModal from "../vue/ConsentPreferenceModal.vue";
import type { ConsentConfig, ConsentStorage } from "../core/types";
import { installCookieJar } from "./helpers/cookie-jar";

const GA_ID = "G-USED123";
const ANALYTICS_ONLY = {
  analytics_storage: "granted",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

let cookieStore = "";
const created: ConsentManager[] = [];

function manager(config: ConsentConfig = {}, isEU = true): ConsentManager {
  const m = new ConsentManager({
    gaId: GA_ID,
    geoDetector: { detect: vi.fn().mockResolvedValue({ isEU, method: "manual" }) },
    usedCategories: ["analytics"],
    ...config,
  });
  created.push(m);
  return m;
}

/** The last consent command Google received (default or update). */
function lastConsentSignals(): unknown {
  const consent = window.dataLayer
    .map((entry) => Array.from(entry as ArrayLike<unknown>))
    .filter((c) => c[0] === "consent");
  return consent[consent.length - 1]?.[2];
}

beforeEach(() => {
  cookieStore = "";
  installCookieJar(
    () => cookieStore,
    (jar) => {
      cookieStore = jar;
    }
  );
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  window.dataLayer = [];
  delete (window as Partial<Window>).gtag;
});

afterEach(() => {
  for (const m of created.splice(0)) m.destroy();
});

describe("usedCategories: what a choice grants", () => {
  it("acceptAll() grants only the used categories and keeps the ad signals denied", async () => {
    const m = manager();
    await m.init();
    await m.acceptAll();

    expect(m.getConsent()?.categories).toEqual({
      analytics: true,
      marketing: false,
      functional: false,
    });
    expect(lastConsentSignals()).toEqual(ANALYTICS_ONLY);
  });

  it("savePreferences() cannot grant an unused category", async () => {
    const m = manager();
    await m.init();
    await m.savePreferences({ analytics: true, marketing: true, functional: true });

    expect(m.getConsent()?.categories).toEqual({
      analytics: true,
      marketing: false,
      functional: false,
    });
  });

  it("the grant a jurisdiction implies covers only the used categories", async () => {
    const onConsentChange = vi.fn();
    const m = manager({ onConsentChange }, false);
    await m.init();

    expect(onConsentChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        categories: { analytics: true, marketing: false, functional: false },
      })
    );
    expect(lastConsentSignals()).toEqual(ANALYTICS_ONLY);
  });

  it("without usedCategories every optional category is offered and granted, as before", async () => {
    const m = manager({ usedCategories: undefined });
    await m.init();
    await m.acceptAll();

    expect(m.getConsent()?.categories).toEqual({
      analytics: true,
      marketing: true,
      functional: true,
    });
  });
});

describe("usedCategories: withdrawing", () => {
  it("turning the only used category off stores a refusal, clears consent_uid, and the next page keeps it", async () => {
    const storage: ConsentStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("uid-1"),
    };
    const m = manager({ storage });
    await m.init();
    await m.acceptAll();
    await vi.waitFor(() => expect(cookieStore).toContain("consent_uid=uid-1"));

    await m.savePreferences({ analytics: false });

    // The hidden marketing no longer keeps the withdrawal looking like a grant.
    expect(cookieStore).not.toContain("consent_uid");
    expect(m.getConsent()?.categories).toEqual({
      analytics: false,
      marketing: false,
      functional: false,
    });
    expect(lastConsentSignals()).toMatchObject({ analytics_storage: "denied" });

    const next = manager({ storage });
    const showBanner = vi.fn();
    next.onShowBanner(showBanner);
    await next.init();
    expect(next.getConsent()?.categories).toEqual({
      analytics: false,
      marketing: false,
      functional: false,
    });
    expect(showBanner).not.toHaveBeenCalled();
  });
});

describe("usedCategories: restoring", () => {
  it("a stored grant of an unused category is restored with that category off", async () => {
    storeConsent({
      categories: { analytics: true, marketing: true, functional: true },
      isEU: true,
    });
    const m = manager();
    await m.init();

    expect(m.getConsent()?.categories).toEqual({
      analytics: true,
      marketing: false,
      functional: false,
    });
    expect(lastConsentSignals()).toEqual(ANALYTICS_ONLY);
  });
});

describe("usedCategories: a restored grant of unused categories only", () => {
  // consent_uid is kept for a grant only: a restored consent that the limit turns into a full
  // refusal must not leave the visitor identifiable to the remote store.
  it("from the cookie clears consent_uid", async () => {
    storeConsent({
      categories: { analytics: false, marketing: true, functional: true },
      isEU: true,
    });
    document.cookie = "consent_uid=uid-old; path=/";
    const m = manager();
    await m.init();

    expect(m.getConsent()?.categories).toEqual({
      analytics: false,
      marketing: false,
      functional: false,
    });
    expect(cookieStore).not.toContain("consent_uid");
  });

  it("from the remote store clears consent_uid", async () => {
    document.cookie = "consent_uid=uid-old; path=/";
    const storage: ConsentStorage = {
      get: vi.fn().mockResolvedValue({
        categories: { analytics: false, marketing: true, functional: false },
        timestamp: Date.now(),
        version: "1.0",
      }),
      set: vi.fn().mockResolvedValue(null),
    };
    const m = manager({ storage }, false);
    await m.init();

    expect(m.getConsent()?.categories.marketing).toBe(false);
    expect(cookieStore).not.toContain("consent_uid");
  });

  it("keeps consent_uid when a used category stays granted", async () => {
    storeConsent({
      categories: { analytics: true, marketing: true, functional: true },
      isEU: true,
    });
    document.cookie = "consent_uid=uid-old; path=/";
    const m = manager();
    await m.init();

    expect(cookieStore).toContain("consent_uid=uid-old");
  });
});

describe("usedCategories: preference centres", () => {
  function shownCategories(): string[] {
    return Array.from(
      document.querySelectorAll<HTMLInputElement>(".consent-modal .consent-toggle__input")
    ).map((input) => input.getAttribute("data-category") ?? "necessary");
  }

  it("vanilla: shows necessary and the used categories only", async () => {
    const m = manager();
    const modal = createModal({ manager: m });
    m.showPreferenceCenter();

    expect(shownCategories()).toEqual(["necessary", "analytics"]);
    modal.destroy();
  });

  it("vanilla: saving sends only the used categories", async () => {
    const onSave = vi.fn();
    const m = manager();
    const modal = createModal({ manager: m, onSave });
    m.showPreferenceCenter();
    document.querySelector<HTMLInputElement>('[data-category="analytics"]')!.checked = true;
    document.querySelector<HTMLButtonElement>('[data-action="save"]')!.click();
    await nextTick();

    expect(m.getConsent()?.categories).toEqual({
      analytics: true,
      marketing: false,
      functional: false,
    });
    modal.destroy();
  });

  it("Vue: shows necessary and the used categories only", async () => {
    const m = manager();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp(ConsentPreferenceModal);
    app.provide("consentManager", m);
    app.mount(host);
    m.showPreferenceCenter();
    await nextTick();

    expect(document.querySelectorAll(".consent-modal__category")).toHaveLength(2);
    expect(document.body.textContent).not.toContain("Marketing");
    app.unmount();
  });

  it("without usedCategories both centres show all four categories, as before", async () => {
    const m = manager({ usedCategories: undefined });
    const modal = createModal({ manager: m });
    m.showPreferenceCenter();

    expect(shownCategories()).toEqual(["necessary", "analytics", "marketing", "functional"]);
    modal.destroy();
  });
});
