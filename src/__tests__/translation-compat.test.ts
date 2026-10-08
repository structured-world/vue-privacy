// The preference centre's "Reject all" text is optional in the public types: objects written
// against earlier releases, which had no such member, still compile (checked by `yarn typecheck`,
// which covers this file) and get the banner's text.
import { describe, it, expect } from "vitest";
import { getTranslations, mergeTranslations } from "../i18n/index";
import type { PreferenceCenterTranslations } from "../i18n/types";
import type { PreferenceCenterConfig } from "../core/types";

const withoutRejectAll: PreferenceCenterTranslations = {
  title: "Privacy settings",
  description: "Choose what to allow.",
  savePreferences: "Save",
  acceptAll: "Allow all",
  categories: {
    necessary: { name: "Necessary", description: "Required." },
    analytics: { name: "Analytics", description: "Usage." },
    marketing: { name: "Marketing", description: "Ads." },
    functional: { name: "Functional", description: "Extras." },
  },
};

const configWithoutRejectAll: PreferenceCenterConfig = {
  title: "Privacy settings",
  description: "Choose what to allow.",
  savePreferences: "Save",
  acceptAll: "Allow all",
  categories: { necessary: {}, analytics: {}, marketing: {}, functional: {} },
};

describe("preference-centre types written before 'Reject all' existed", () => {
  it("merge into translations that still label the button", () => {
    const merged = mergeTranslations("de", { preferenceCenter: withoutRejectAll });
    expect(merged.preferenceCenter.title).toBe("Privacy settings");
    expect(merged.preferenceCenter.rejectAll).toBe(getTranslations("de").banner.rejectAll);
  });

  it("take a custom banner 'Reject all' text when the preference centre sets none", () => {
    // The two buttons refuse the same thing, so a site that renamed the banner's keeps one label.
    const merged = mergeTranslations("en", {
      banner: { ...getTranslations("en").banner, rejectAll: "Refuse" },
      preferenceCenter: withoutRejectAll,
    });
    expect(merged.preferenceCenter.rejectAll).toBe("Refuse");
  });

  it("type a preference-centre config without the member", () => {
    expect(configWithoutRejectAll.rejectAll).toBeUndefined();
  });
});
