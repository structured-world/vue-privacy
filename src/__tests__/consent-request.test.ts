// @vitest-environment jsdom
// A feature that needs a category the visitor refused asks again when it is needed, saying why:
// requestConsent() opens the preference centre with the site's reason and the category
// highlighted, and answers whether the category is granted after the visitor's choice.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApp, h, nextTick } from "vue";
import { ConsentManager } from "../core/consent-manager";
import type { ConsentConfig } from "../core/types";
import { createModal } from "../vanilla/modal";
import ConsentPreferenceModal from "../vue/ConsentPreferenceModal.vue";
import { useConsent } from "../vue/index";
import { installCookieJar } from "./helpers/cookie-jar";

const SIGN_IN = "Sign-in needs functional cookies to keep you logged in.";
const VIDEO = "The video player needs marketing cookies.";
const REFUSED = { analytics: false, marketing: false, functional: false };

let cookieStore = "";
const created: ConsentManager[] = [];

function manager(config: ConsentConfig = {}, consentRequired = true): ConsentManager {
  const m = new ConsentManager({
    geoDetector: { detect: vi.fn().mockResolvedValue({ consentRequired, method: "manual" }) },
    ...config,
  });
  created.push(m);
  return m;
}

/** A manager whose visitor refused everything, with a preference centre callback pair. */
async function refusedManager(config: ConsentConfig = {}) {
  const m = manager(config);
  await m.init();
  await m.rejectAll();
  const show = vi.fn();
  m.onShowPreferenceCenter(show);
  m.onHidePreferenceCenter(vi.fn());
  return { m, show };
}

/** Whether a promise has settled, after pending microtasks ran. */
async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  void promise.then(() => (done = true));
  await Promise.resolve();
  await Promise.resolve();
  return done;
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
});

afterEach(() => {
  for (const m of created.splice(0)) m.destroy();
});

describe("requestConsent", () => {
  it("answers true at once for a granted category and shows nothing", async () => {
    const m = manager();
    await m.init();
    await m.acceptAll();
    const show = vi.fn();
    const onShow = vi.fn();
    m.onShowPreferenceCenter(show);
    m.getConfig().onPreferenceCenterShow = onShow;

    await expect(m.requestConsent("functional", { reason: SIGN_IN })).resolves.toBe(true);
    expect(show).not.toHaveBeenCalled();
    expect(onShow).not.toHaveBeenCalled();
    expect(m.getConsentRequest()).toBeNull();
  });

  it("answers true at once where the jurisdiction grants the category", async () => {
    // Outside consent jurisdictions nothing was refused: there is nothing to ask.
    const m = manager({}, false);
    await m.init();
    const show = vi.fn();
    m.onShowPreferenceCenter(show);

    await expect(m.requestConsent("analytics")).resolves.toBe(true);
    expect(show).not.toHaveBeenCalled();
  });

  it("opens the preference centre with the reason and the category for a refused one", async () => {
    const { m, show } = await refusedManager();
    const answer = m.requestConsent("functional", { reason: SIGN_IN });

    expect(show).toHaveBeenCalledOnce();
    expect(m.getConsentRequest()).toEqual({ categories: ["functional"], reasons: [SIGN_IN] });
    expect(await settled(answer)).toBe(false);
  });

  it("asks an undecided visitor too", async () => {
    const m = manager();
    await m.init();
    const show = vi.fn();
    m.onShowPreferenceCenter(show);

    void m.requestConsent("marketing");
    expect(show).toHaveBeenCalledOnce();
    expect(m.getConsentRequest()).toEqual({ categories: ["marketing"], reasons: [] });
  });

  it("answers true once the visitor grants the category, and stores the grant", async () => {
    const { m } = await refusedManager();
    const answer = m.requestConsent("functional", { reason: SIGN_IN });

    await m.savePreferences({ analytics: false, marketing: false, functional: true });
    await expect(answer).resolves.toBe(true);
    expect(m.getConsent()?.categories).toEqual({
      analytics: false,
      marketing: false,
      functional: true,
    });
    expect(m.getConsentRequest()).toBeNull();
  });

  it("answers true on accept all", async () => {
    const { m } = await refusedManager();
    const answer = m.requestConsent("marketing", { reason: VIDEO });

    await m.acceptAll();
    await expect(answer).resolves.toBe(true);
  });

  it("answers false when the visitor saves without the category, which stays refused", async () => {
    const { m } = await refusedManager();
    const answer = m.requestConsent("functional", { reason: SIGN_IN });

    await m.savePreferences({ analytics: true, marketing: false, functional: false });
    await expect(answer).resolves.toBe(false);
    expect(m.getConsent()?.categories.functional).toBe(false);
  });

  it("answers false on reject all", async () => {
    const { m } = await refusedManager();
    const answer = m.requestConsent("functional");

    await m.rejectAll();
    await expect(answer).resolves.toBe(false);
  });

  it("answers false when the visitor closes the dialog, keeping the stored refusal", async () => {
    const { m } = await refusedManager();
    const before = m.getConsent();
    const onHide = vi.fn();
    m.getConfig().onPreferenceCenterHide = onHide;
    const answer = m.requestConsent("functional", { reason: SIGN_IN });

    m.hidePreferenceCenter();
    await expect(answer).resolves.toBe(false);
    expect(m.getConsent()).toEqual(before);
    expect(onHide).toHaveBeenCalledOnce();
    expect(m.getConsentRequest()).toBeNull();
  });

  it("opens one dialog for calls made while it is open; each caller gets its answer", async () => {
    const { m, show } = await refusedManager();
    const onShow = vi.fn();
    m.getConfig().onPreferenceCenterShow = onShow;
    const signIn = m.requestConsent("functional", { reason: SIGN_IN });
    const video = m.requestConsent("marketing", { reason: VIDEO });
    const again = m.requestConsent("functional", { reason: SIGN_IN });

    // The open dialog is refreshed to show the new request, not opened a second time.
    expect(onShow).toHaveBeenCalledOnce();
    expect(show.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(m.getConsentRequest()).toEqual({
      categories: ["marketing", "functional"],
      reasons: [SIGN_IN, VIDEO],
    });

    await m.savePreferences({ analytics: false, marketing: false, functional: true });
    await expect(signIn).resolves.toBe(true);
    await expect(again).resolves.toBe(true);
    await expect(video).resolves.toBe(false);
  });

  it("joins a dialog the visitor opened, without opening another", async () => {
    const { m } = await refusedManager();
    const onShow = vi.fn();
    m.getConfig().onPreferenceCenterShow = onShow;
    m.showPreferenceCenter();
    const answer = m.requestConsent("functional", { reason: SIGN_IN });

    expect(onShow).toHaveBeenCalledOnce();
    expect(m.getConsentRequest()?.reasons).toEqual([SIGN_IN]);
    m.hidePreferenceCenter();
    await expect(answer).resolves.toBe(false);
  });

  it("asks again after an answered request", async () => {
    const { m, show } = await refusedManager();
    const first = m.requestConsent("functional");
    m.hidePreferenceCenter();
    await first;

    void m.requestConsent("functional");
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("rejects a category the site does not use, which no choice can grant", async () => {
    const { m, show } = await refusedManager({ usedCategories: ["analytics"] });

    await expect(m.requestConsent("marketing")).rejects.toThrow(/marketing/);
    expect(show).not.toHaveBeenCalled();
  });

  it("answers false to pending callers when the manager is destroyed", async () => {
    const { m } = await refusedManager();
    const answer = m.requestConsent("functional");

    m.destroy();
    await expect(answer).resolves.toBe(false);
  });
});

describe("requestConsent in the preference centres", () => {
  it("Vue: shows the reason, highlights the category, and closing answers false", async () => {
    const m = manager();
    await m.init();
    await m.rejectAll();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp({ render: () => h(ConsentPreferenceModal) });
    app.provide("consentManager", m);
    app.mount(host);

    const answer = m.requestConsent("functional", { reason: SIGN_IN });
    await nextTick();
    expect(document.querySelector(".consent-modal__reason")?.textContent?.trim()).toBe(SIGN_IN);
    const requested = document.querySelector(".consent-modal__category--requested");
    expect(requested?.querySelector('[data-category="functional"]')).not.toBeNull();
    // No pre-ticked box: the visitor grants it, or not.
    expect(
      (document.querySelector('[data-category="functional"]') as HTMLInputElement).checked
    ).toBe(false);

    (document.querySelector(".consent-modal__close") as HTMLButtonElement).click();
    await expect(answer).resolves.toBe(false);
    // The leave transition keeps the markup in jsdom (no transitionend); the request is closed.
    expect(m.getConsentRequest()).toBeNull();
    expect(m.getConsent()?.categories).toEqual(REFUSED);
    app.unmount();
  });

  it("Vue: granting in the dialog answers true", async () => {
    const m = manager();
    await m.init();
    await m.rejectAll();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp({ render: () => h(ConsentPreferenceModal) });
    app.provide("consentManager", m);
    app.mount(host);

    const answer = m.requestConsent("functional", { reason: SIGN_IN });
    await nextTick();
    const toggle = document.querySelector('[data-category="functional"]') as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    (document.querySelector(".consent-modal__btn--save") as HTMLButtonElement).click();
    await expect(answer).resolves.toBe(true);
    app.unmount();
  });

  it("Vue: useConsent() exposes requestConsent", async () => {
    const m = manager();
    await m.init();
    await m.acceptAll();
    let consent: ReturnType<typeof useConsent> | undefined;
    const app = createApp({
      setup() {
        consent = useConsent();
        return () => null;
      },
    });
    app.provide("consentManager", m);
    app.mount(document.createElement("div"));

    await expect(consent?.requestConsent("functional")).resolves.toBe(true);
    app.unmount();
  });

  it("vanilla: shows the reasons, highlights the categories, and Escape answers false", async () => {
    const m = manager();
    await m.init();
    await m.rejectAll();
    const modal = createModal({ manager: m });

    const signIn = m.requestConsent("functional", { reason: SIGN_IN });
    const video = m.requestConsent("marketing", { reason: VIDEO });
    const reasons = Array.from(document.querySelectorAll(".consent-modal__reason")).map((p) =>
      p.textContent?.trim()
    );
    expect(reasons).toEqual([SIGN_IN, VIDEO]);
    const highlighted = Array.from(
      document.querySelectorAll(".consent-modal__category--requested [data-category]")
    ).map((input) => input.getAttribute("data-category"));
    expect(highlighted.sort()).toEqual(["functional", "marketing"]);
    expect(modal.isVisible()).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await expect(signIn).resolves.toBe(false);
    await expect(video).resolves.toBe(false);
    expect(modal.isVisible()).toBe(false);
    modal.destroy();
  });

  it("vanilla: a later dialog the visitor opens shows no stale reason", async () => {
    const m = manager();
    await m.init();
    await m.rejectAll();
    const modal = createModal({ manager: m });
    void m.requestConsent("functional", { reason: SIGN_IN });
    (document.querySelector(".consent-modal__close") as HTMLButtonElement).click();

    m.showPreferenceCenter();
    expect(document.querySelectorAll(".consent-modal__reason")).toHaveLength(0);
    expect(document.querySelector(".consent-modal__category--requested")).toBeNull();
    modal.destroy();
  });

  it("vanilla: granting in the dialog answers true and stores it", async () => {
    const m = manager();
    await m.init();
    await m.rejectAll();
    const modal = createModal({ manager: m });
    const answer = m.requestConsent("functional", { reason: SIGN_IN });

    (document.querySelector('[data-category="functional"]') as HTMLInputElement).checked = true;
    (document.querySelector(".consent-modal__btn--save") as HTMLButtonElement).click();
    await expect(answer).resolves.toBe(true);
    expect(m.getConsent()?.categories).toEqual({ ...REFUSED, functional: true });
    modal.destroy();
  });
});
