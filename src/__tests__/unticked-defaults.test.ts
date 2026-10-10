// @vitest-environment jsdom
// A pre-ticked box the visitor has to untick to refuse is no consent (CJEU, Planet49, C-673/17;
// GDPR Recital 32): a visitor who has not chosen finds every optional category unticked, and
// only the visitor's own tick grants one.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApp, h, nextTick } from "vue";
import { ConsentManager } from "../core/consent-manager";
import { DEFAULT_CONFIG } from "../core/types";
import { createModal } from "../vanilla/modal";
import ConsentPreferenceModal from "../vue/ConsentPreferenceModal.vue";
import { installCookieJar } from "./helpers/cookie-jar";

let cookieStore = "";
const created: ConsentManager[] = [];
const NOTHING = { analytics: false, marketing: false, functional: false };
// Every optional toggle is rendered, and none is ticked (an empty list would prove nothing)
const UNTICKED_TOGGLES = [
  ["analytics", false],
  ["marketing", false],
  ["functional", false],
];

async function undecided(): Promise<ConsentManager> {
  const m = new ConsentManager({
    geoDetector: {
      detect: vi.fn().mockResolvedValue({ consentRequired: true, method: "manual" as const }),
    },
  });
  created.push(m);
  await m.init();
  return m;
}

const toggles = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>("input[data-category]")).map(
    (input) => [input.getAttribute("data-category"), input.checked] as const
  );

beforeEach(() => {
  cookieStore = "";
  installCookieJar(
    () => cookieStore,
    (jar) => {
      cookieStore = jar;
    }
  );
  document.body.innerHTML = "";
});

afterEach(() => {
  for (const m of created.splice(0)) m.destroy();
});

describe("optional categories start unticked", () => {
  it("vanilla: an undecided visitor sees no optional category ticked, and saving grants none", async () => {
    const m = await undecided();
    const modal = createModal({ manager: m });

    m.showPreferenceCenter();
    expect(toggles()).toEqual(UNTICKED_TOGGLES);
    (document.querySelector(".consent-modal__btn--save") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(m.getConsent()?.categories).toEqual(NOTHING));
    modal.destroy();
  });

  it("Vue: an undecided visitor sees no optional category ticked, and saving grants none", async () => {
    const m = await undecided();
    const app = createApp({ render: () => h(ConsentPreferenceModal) });
    app.provide("consentManager", m);
    app.mount(document.body.appendChild(document.createElement("div")));

    m.showPreferenceCenter();
    await nextTick();
    await nextTick();
    expect(toggles()).toEqual(UNTICKED_TOGGLES);
    (document.querySelector(".consent-modal__btn--save") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(m.getConsent()?.categories).toEqual(NOTHING));
    app.unmount();
  });

  it("savePreferences() refuses a category it is not given", async () => {
    const m = await undecided();
    await m.savePreferences({ analytics: true });
    expect(m.getConsent()?.categories).toEqual({ ...NOTHING, analytics: true });
  });

  it("offers no way to configure pre-ticked categories", () => {
    expect("categories" in DEFAULT_CONFIG).toBe(false);
  });
});
