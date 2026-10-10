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

/** A manager whose visitor refused everything. */
async function refusedVisitor(config: ConsentConfig = {}): Promise<ConsentManager> {
  const m = manager(config);
  await m.init();
  await m.rejectAll();
  return m;
}

/** A refused visitor's manager with a preference centre callback pair. */
async function refusedManager(config: ConsentConfig = {}) {
  const m = await refusedVisitor(config);
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
  vi.restoreAllMocks();
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

  it("answers pending callers even when a hide callback throws", async () => {
    const { m } = await refusedManager();
    m.getConfig().onPreferenceCenterHide = () => {
      throw new Error("site callback failed");
    };
    const answer = m.requestConsent("functional");

    expect(() => m.hidePreferenceCenter()).toThrow("site callback failed");
    await expect(answer).resolves.toBe(false);
  });

  it("answers false after destroy() instead of waiting for a dialog that cannot come", async () => {
    const { m } = await refusedManager();
    m.destroy();

    const answer = m.requestConsent("functional");
    expect(await settled(answer)).toBe(true);
    await expect(answer).resolves.toBe(false);
  });

  it("does not trust a stored grant before init() checked where it was given", async () => {
    // Granted outside consent jurisdictions; the visitor is now in the EEA, where init()'s roaming
    // check rejects that grant.
    const outside = manager({}, false);
    await outside.init();
    await outside.acceptAll();
    const m = manager();
    const show = vi.fn();
    m.onShowPreferenceCenter(show);

    const answer = m.requestConsent("functional", { reason: SIGN_IN });
    expect(await settled(answer)).toBe(false);
    await m.init();
    await Promise.resolve();
    expect(show).toHaveBeenCalled();
    expect(m.getConsentRequest()?.categories).toEqual(["functional"]);
    m.hidePreferenceCenter();
    await expect(answer).resolves.toBe(false);
  });

  it("answers a request made before init() once init() settled a valid grant", async () => {
    const m = manager();
    const answer = m.requestConsent("functional");
    await m.init();
    await m.acceptAll();
    await expect(answer).resolves.toBe(true);
  });

  it("keeps a request a consent callback makes during a choice open, and asks it", async () => {
    // The video feature asks for marketing when the visitor grants functional for sign-in.
    const { m, show } = await refusedManager();
    let video: Promise<boolean> | undefined;
    m.onConsentChange((categories) => {
      if (categories.functional && !categories.marketing && !video) {
        video = m.requestConsent("marketing", { reason: VIDEO });
      }
    });
    const signIn = m.requestConsent("functional", { reason: SIGN_IN });
    const hide = vi.fn();
    m.onHidePreferenceCenter(hide);

    await m.savePreferences({ analytics: false, marketing: false, functional: true });
    await expect(signIn).resolves.toBe(true);
    expect(video).toBeDefined();
    expect(await settled(video as Promise<boolean>)).toBe(false);
    expect(m.getConsentRequest()).toEqual({ categories: ["marketing"], reasons: [VIDEO] });
    // The answered dialog closed, then opened again for the new question.
    expect(hide).toHaveBeenCalledOnce();
    expect(show.mock.invocationCallOrder.at(-1)).toBeGreaterThan(hide.mock.invocationCallOrder[0]);

    await m.acceptAll();
    await expect(video).resolves.toBe(true);
  });

  it("a dialog that fails to reopen for a callback's request answers it false", async () => {
    // The reopening after a choice goes through the same failure path as an opening: the new
    // request answers false instead of waiting on a dialog that never showed.
    const { m } = await refusedManager();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let video: Promise<boolean> | undefined;
    m.onConsentChange((categories) => {
      if (categories.functional && !video) video = m.requestConsent("marketing", { reason: VIDEO });
    });
    const signIn = m.requestConsent("functional", { reason: SIGN_IN });
    let opened = 1;
    m.onShowPreferenceCenter(() => {
      // The joining request refreshes the open dialog; the reopening after the choice fails
      if (opened++ >= 2) throw new Error("site dialog failed");
    });

    await expect(m.savePreferences({ functional: true })).resolves.toBeUndefined();
    await expect(signIn).resolves.toBe(true);
    await expect(video).resolves.toBe(false);
    expect(m.getConsentRequest()).toBeNull();
    expect(error).toHaveBeenCalledWith(
      "[vue-privacy] preference centre failed to open",
      expect.any(Error)
    );
  });

  it("answers from a choice made in another tab once this tab follows it (basic mode)", async () => {
    // Basic mode follows the shared cookie when the tab regains focus; a request open here is
    // answered by the visitor's choice there, and its dialog closes.
    const config: ConsentConfig = { consentMode: "basic", gaId: "G-REQUEST1" };
    const { m } = await refusedManager(config);
    const hide = vi.fn();
    m.onHidePreferenceCenter(hide);
    const answer = m.requestConsent("functional", { reason: SIGN_IN });

    // The other tab chooses later: a record is told apart by its timestamp.
    const later = Date.now() + 1000;
    vi.spyOn(Date, "now").mockReturnValue(later);
    const otherTab = manager(config);
    await otherTab.init();
    await otherTab.savePreferences({ analytics: false, marketing: false, functional: true });
    window.dispatchEvent(new Event("focus"));

    await expect(answer).resolves.toBe(true);
    expect(hide).toHaveBeenCalled();
    expect(m.getConsentRequest()).toBeNull();
  });

  it("a reset answers the open request false and closes its dialog before the banner asks", async () => {
    const { m } = await refusedManager();
    const hide = vi.fn();
    m.onHidePreferenceCenter(hide);
    const showBanner = vi.fn();
    m.onShowBanner(showBanner);
    const answer = m.requestConsent("functional", { reason: SIGN_IN });

    m.resetConsent();
    await expect(answer).resolves.toBe(false);
    expect(hide).toHaveBeenCalledOnce();
    expect(hide.mock.invocationCallOrder[0]).toBeLessThan(showBanner.mock.invocationCallOrder[0]);
    expect(m.getConsentRequest()).toBeNull();
  });

  it("a reset still asks with the banner when closing the open dialog throws", async () => {
    // The reset already cleared the choice: a failing hide hook must not leave the visitor
    // undecided with nothing asking.
    const { m } = await refusedManager();
    const showBanner = vi.fn();
    m.onShowBanner(showBanner);
    m.getConfig().onPreferenceCenterHide = () => {
      throw new Error("hook failed");
    };
    const answer = m.requestConsent("functional", { reason: SIGN_IN });

    expect(() => m.resetConsent()).toThrow("hook failed");
    expect(showBanner).toHaveBeenCalledOnce();
    await expect(answer).resolves.toBe(false);
  });

  it("a throwing show callback leaves no stale request: it answers false and the next call asks", async () => {
    const { m } = await refusedManager();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.onShowPreferenceCenter(() => {
      throw new Error("site dialog failed");
    });

    await expect(m.requestConsent("functional")).resolves.toBe(false);
    expect(error).toHaveBeenCalled();
    expect(m.getConsentRequest()).toBeNull();

    const show = vi.fn();
    m.onShowPreferenceCenter(show);
    void m.requestConsent("functional");
    expect(show).toHaveBeenCalledOnce();
  });

  it("a throwing onPreferenceCenterShow leaves no stale request either", async () => {
    const { m, show } = await refusedManager();
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.getConfig().onPreferenceCenterShow = () => {
      throw new Error("site callback failed");
    };

    await expect(m.requestConsent("functional")).resolves.toBe(false);
    expect(m.getConsentRequest()).toBeNull();
    m.getConfig().onPreferenceCenterShow = undefined;
    void m.requestConsent("functional");
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("a throwing onPreferenceCenterShow closes the dialog its component already showed", async () => {
    // The request already answered false; a dialog left open would ask a question nobody waits on.
    const { m } = await refusedManager();
    const hide = vi.fn();
    m.onHidePreferenceCenter(hide);
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.getConfig().onPreferenceCenterShow = () => {
      throw new Error("site callback failed");
    };

    await expect(m.requestConsent("functional", { reason: SIGN_IN })).resolves.toBe(false);
    expect(hide).toHaveBeenCalledOnce();
  });

  it("a dialog that fails to open and to close still answers false and reports both", async () => {
    const { m } = await refusedManager();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.onShowPreferenceCenter(() => {
      throw new Error("site dialog failed to open");
    });
    m.onHidePreferenceCenter(() => {
      throw new Error("site dialog failed to close");
    });

    await expect(m.requestConsent("functional")).resolves.toBe(false);
    expect(error).toHaveBeenCalledWith(
      "[vue-privacy] preference centre failed to open",
      expect.any(Error)
    );
    expect(error).toHaveBeenCalledWith(
      "[vue-privacy] preference centre failed to close",
      expect.any(Error)
    );
    expect(m.getConsentRequest()).toBeNull();
  });

  it("a reset made in another tab answers the open request and closes its dialog (basic mode)", async () => {
    const config: ConsentConfig = { consentMode: "basic", gaId: "G-REQUEST2" };
    const { m } = await refusedManager(config);
    const hide = vi.fn();
    m.onHidePreferenceCenter(hide);
    const showBanner = vi.fn();
    m.onShowBanner(showBanner);
    const answer = m.requestConsent("functional", { reason: SIGN_IN });

    cookieStore = "";
    window.dispatchEvent(new Event("focus"));

    await expect(answer).resolves.toBe(false);
    expect(hide).toHaveBeenCalledOnce();
    expect(hide.mock.invocationCallOrder[0]).toBeLessThan(showBanner.mock.invocationCallOrder[0]);
  });

  it("keeps a request a consent callback makes while following another tab (basic mode)", async () => {
    const config: ConsentConfig = { consentMode: "basic", gaId: "G-REQUEST3" };
    const { m, show } = await refusedManager(config);
    let video: Promise<boolean> | undefined;
    m.onConsentChange((categories) => {
      if (categories.functional && !video) video = m.requestConsent("marketing", { reason: VIDEO });
    });
    const signIn = m.requestConsent("functional", { reason: SIGN_IN });

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1000);
    const otherTab = manager(config);
    await otherTab.init();
    await otherTab.savePreferences({ functional: true });
    const shownBefore = show.mock.calls.length;
    window.dispatchEvent(new Event("focus"));

    await expect(signIn).resolves.toBe(true);
    expect(video).toBeDefined();
    expect(await settled(video as Promise<boolean>)).toBe(false);
    expect(m.getConsentRequest()).toEqual({ categories: ["marketing"], reasons: [VIDEO] });
    expect(show.mock.calls.length).toBeGreaterThan(shownBefore);
  });

  it("closes the dialog once when a callback hides it while following another tab (basic mode)", async () => {
    // hidePreferenceCenter() closes the dialog and answers its requests without a new decision;
    // following the other tab must not close it a second time.
    const config: ConsentConfig = { consentMode: "basic", gaId: "G-REQUEST5" };
    const { m } = await refusedManager(config);
    const hide = vi.fn();
    m.onHidePreferenceCenter(hide);
    const onHide = vi.fn();
    m.getConfig().onPreferenceCenterHide = onHide;
    m.onConsentChange((categories) => {
      if (categories.functional) m.hidePreferenceCenter();
    });
    const answer = m.requestConsent("functional", { reason: SIGN_IN });

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1000);
    const otherTab = manager(config);
    await otherTab.init();
    await otherTab.savePreferences({ functional: true });
    window.dispatchEvent(new Event("focus"));

    await expect(answer).resolves.toBe(true);
    expect(hide).toHaveBeenCalledOnce();
    expect(onHide).toHaveBeenCalledOnce();
  });

  it("closes the dialog once when a callback resets while following another tab (basic mode)", async () => {
    // The callback's reset closes the dialog and asks with the banner itself; following the other
    // tab must not do either a second time.
    const config: ConsentConfig = { consentMode: "basic", gaId: "G-REQUEST4" };
    const { m } = await refusedManager(config);
    const hide = vi.fn();
    m.onHidePreferenceCenter(hide);
    const onBannerShow = vi.fn();
    m.getConfig().onBannerShow = onBannerShow;
    let reset = false;
    m.onConsentChange((categories) => {
      if (categories.functional && !reset) {
        reset = true;
        m.resetConsent();
      }
    });
    const answer = m.requestConsent("functional", { reason: SIGN_IN });

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1000);
    const otherTab = manager(config);
    await otherTab.init();
    await otherTab.savePreferences({ functional: true });
    window.dispatchEvent(new Event("focus"));

    expect(reset).toBe(true);
    // The reset cleared the grant the other tab made
    await expect(answer).resolves.toBe(false);
    expect(hide).toHaveBeenCalledOnce();
    expect(onBannerShow).toHaveBeenCalledOnce();
  });

  it("a dialog that fails when it mounts late answers every waiting request false", async () => {
    // Requests made before any dialog is mounted wait for one; if that one throws on showing,
    // nothing was asked.
    const m = manager();
    await m.init();
    await m.rejectAll();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const first = m.requestConsent("functional", { reason: SIGN_IN });
    const second = m.requestConsent("marketing", { reason: VIDEO });

    m.onShowPreferenceCenter(() => {
      throw new Error("site dialog failed");
    });
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
    expect(m.getConsentRequest()).toBeNull();

    const show = vi.fn();
    m.onShowPreferenceCenter(show);
    void m.requestConsent("functional");
    expect(show).toHaveBeenCalledOnce();
  });

  it("a request the open dialog fails to show answers false; the ones it shows keep waiting", async () => {
    const { m } = await refusedManager();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const signIn = m.requestConsent("functional", { reason: SIGN_IN });
    m.onShowPreferenceCenter(() => {
      throw new Error("site dialog failed to refresh");
    });

    await expect(m.requestConsent("marketing", { reason: VIDEO })).resolves.toBe(false);
    expect(await settled(signIn)).toBe(false);
    expect(m.getConsentRequest()).toEqual({ categories: ["functional"], reasons: [SIGN_IN] });
  });

  it("closes the dialog once when a consent callback resets during the choice", async () => {
    // The reset closes the dialog itself; the choice that triggered it must not close it again,
    // or the site's hide hooks run twice for one action.
    const { m } = await refusedManager();
    const hide = vi.fn();
    m.onHidePreferenceCenter(hide);
    const onHide = vi.fn();
    m.getConfig().onPreferenceCenterHide = onHide;
    let reset = false;
    m.onConsentChange(() => {
      if (!reset) {
        reset = true;
        m.resetConsent();
      }
    });
    const answer = m.requestConsent("functional", { reason: SIGN_IN });

    await m.savePreferences({ functional: true });
    expect(hide).toHaveBeenCalledOnce();
    expect(onHide).toHaveBeenCalledOnce();
    // The reset cleared the choice the visitor made
    await expect(answer).resolves.toBe(false);
  });

  it("answers false to pending callers when the manager is destroyed", async () => {
    const { m } = await refusedManager();
    const answer = m.requestConsent("functional");

    m.destroy();
    await expect(answer).resolves.toBe(false);
  });
});

/** The Vue preference centre, mounted for a refused visitor. */
async function vueDialog() {
  const m = await refusedVisitor();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(ConsentPreferenceModal) });
  app.provide("consentManager", m);
  app.mount(host);
  return { m, app };
}

/** The vanilla preference centre, created for a refused visitor. */
async function vanillaDialog() {
  const m = await refusedVisitor();
  return { m, modal: createModal({ manager: m }) };
}

describe("requestConsent in the preference centres", () => {
  it("Vue: shows the reason, highlights the category, and closing answers false", async () => {
    const { m, app } = await vueDialog();

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
    const { m, app } = await vueDialog();

    const answer = m.requestConsent("functional", { reason: SIGN_IN });
    await nextTick();
    const toggle = document.querySelector('[data-category="functional"]') as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    (document.querySelector(".consent-modal__btn--save") as HTMLButtonElement).click();
    await expect(answer).resolves.toBe(true);
    app.unmount();
  });

  it("Vue: an undecided visitor gets the requested category unticked", async () => {
    // functional defaults to on in the dialog; a request for it must not arrive pre-ticked.
    const m = manager();
    await m.init();
    const app = createApp({ render: () => h(ConsentPreferenceModal) });
    app.provide("consentManager", m);
    app.mount(document.body.appendChild(document.createElement("div")));

    void m.requestConsent("functional", { reason: SIGN_IN });
    await nextTick();
    await nextTick();
    expect(
      (document.querySelector('[data-category="functional"]') as HTMLInputElement).checked
    ).toBe(false);
    app.unmount();
  });

  it("Vue: toggles of a dialog closed without saving do not come back on the next open", async () => {
    // An undecided visitor ticks marketing, then closes: nothing was chosen, so the next open
    // starts unticked again, as the vanilla dialog does.
    const m = manager();
    await m.init();
    const app = createApp({ render: () => h(ConsentPreferenceModal) });
    app.provide("consentManager", m);
    app.mount(document.body.appendChild(document.createElement("div")));
    const marketing = () =>
      document.querySelector('[data-category="marketing"]') as HTMLInputElement;

    m.showPreferenceCenter();
    await nextTick();
    marketing().checked = true;
    marketing().dispatchEvent(new Event("change"));
    (document.querySelector(".consent-modal__close") as HTMLButtonElement).click();
    await nextTick();
    m.showPreferenceCenter();
    await nextTick();
    await nextTick();
    expect(marketing().checked).toBe(false);
    app.unmount();
  });

  it("Vue: a request joining the open dialog keeps the visitor's own tick", async () => {
    // Only the visitor ticks a box; a request arriving after that tick must not undo it.
    const m = manager();
    await m.init();
    const app = createApp({ render: () => h(ConsentPreferenceModal) });
    app.provide("consentManager", m);
    app.mount(document.body.appendChild(document.createElement("div")));
    const functional = () =>
      document.querySelector('[data-category="functional"]') as HTMLInputElement;

    void m.requestConsent("marketing", { reason: VIDEO });
    await nextTick();
    await nextTick();
    expect(functional().checked).toBe(false);
    functional().checked = true;
    functional().dispatchEvent(new Event("change"));
    void m.requestConsent("functional", { reason: SIGN_IN });
    await nextTick();
    expect(functional().checked).toBe(true);
    app.unmount();
  });

  it("Vue: a dialog reopened in the same turn shows the stored choice, not the old toggles", async () => {
    // The visitor ticks marketing, then rejects all; a consent callback asks for marketing again
    // at once. The new prompt must not carry the old dialog's unsaved tick.
    const { m, app } = await vueDialog();
    let video: Promise<boolean> | undefined;
    m.onConsentChange((categories) => {
      if (!categories.marketing && !video) video = m.requestConsent("marketing", { reason: VIDEO });
    });
    const marketing = () =>
      document.querySelector('[data-category="marketing"]') as HTMLInputElement;

    m.showPreferenceCenter();
    await nextTick();
    marketing().checked = true;
    marketing().dispatchEvent(new Event("change"));
    // The tick renders, as between two clicks in a browser
    await nextTick();
    (document.querySelector(".consent-modal__btn--reject-all") as HTMLButtonElement).click();
    await nextTick();
    await nextTick();

    expect(video).toBeDefined();
    expect(m.getConsentRequest()?.categories).toEqual(["marketing"]);
    expect(marketing().checked).toBe(false);
    app.unmount();
  });

  it("Vue: unmounting the dialog while a request is open answers it", async () => {
    const { m, app } = await vueDialog();
    const answer = m.requestConsent("functional", { reason: SIGN_IN });
    await nextTick();

    app.unmount();
    await expect(answer).resolves.toBe(false);
    expect(m.getConsentRequest()).toBeNull();
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
    const { m, modal } = await vanillaDialog();

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

  it("vanilla: an undecided visitor gets the requested category unticked", async () => {
    const m = manager();
    await m.init();
    const modal = createModal({ manager: m });

    void m.requestConsent("functional", { reason: SIGN_IN });
    expect(
      (document.querySelector('[data-category="functional"]') as HTMLInputElement).checked
    ).toBe(false);
    modal.destroy();
  });

  it("vanilla: a request joining the open dialog keeps the visitor's own tick", async () => {
    const m = manager();
    await m.init();
    const modal = createModal({ manager: m });
    const functional = () =>
      document.querySelector('[data-category="functional"]') as HTMLInputElement;

    void m.requestConsent("marketing", { reason: VIDEO });
    expect(functional().checked).toBe(false);
    functional().checked = true;
    void m.requestConsent("functional", { reason: SIGN_IN });
    expect(functional().checked).toBe(true);
    modal.destroy();
  });

  it("vanilla: the public hide() answers a pending request", async () => {
    const { m, modal } = await vanillaDialog();
    const answer = m.requestConsent("functional");

    modal.hide();
    await expect(answer).resolves.toBe(false);
    expect(modal.isVisible()).toBe(false);
    expect(m.getConsentRequest()).toBeNull();
    modal.destroy();
  });

  it("vanilla: destroying the dialog while a request is open answers it", async () => {
    const { m, modal } = await vanillaDialog();
    const answer = m.requestConsent("functional");

    modal.destroy();
    await expect(answer).resolves.toBe(false);
    // A dialog created later is not left believing one is open.
    const next = createModal({ manager: m });
    void m.requestConsent("functional");
    expect(next.isVisible()).toBe(true);
    next.destroy();
  });

  it("vanilla: a later dialog the visitor opens shows no stale reason", async () => {
    const { m, modal } = await vanillaDialog();
    void m.requestConsent("functional", { reason: SIGN_IN });
    (document.querySelector(".consent-modal__close") as HTMLButtonElement).click();

    m.showPreferenceCenter();
    expect(document.querySelectorAll(".consent-modal__reason")).toHaveLength(0);
    expect(document.querySelector(".consent-modal__category--requested")).toBeNull();
    modal.destroy();
  });

  it("vanilla: granting in the dialog answers true and stores it", async () => {
    const { m, modal } = await vanillaDialog();
    const answer = m.requestConsent("functional", { reason: SIGN_IN });

    (document.querySelector('[data-category="functional"]') as HTMLInputElement).checked = true;
    (document.querySelector(".consent-modal__btn--save") as HTMLButtonElement).click();
    await expect(answer).resolves.toBe(true);
    expect(m.getConsent()?.categories).toEqual({ ...REFUSED, functional: true });
    modal.destroy();
  });
});
