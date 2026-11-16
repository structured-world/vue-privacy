// Correct consumer code against every entry point: must type-check without a single error,
// including inside the package's own declarations (skipLibCheck is off).
import {
  VERSION,
  createConsentManager,
  getStoredConsent,
  type ConsentConfig,
  type StoredConsent,
} from "@structured-world/vue-privacy";
import { useConsent, ConsentBanner } from "@structured-world/vue-privacy/vue";
import { enhanceWithConsent } from "@structured-world/vue-privacy/vitepress";
import { consentBoot } from "@structured-world/vue-privacy/quasar";
import { createBanner } from "@structured-world/vue-privacy/vanilla";
import { h } from "vue";
import type { Theme } from "vitepress";

declare const theme: Theme;

export const version: string = VERSION;
const config: ConsentConfig = { gaId: "G-TEST", googleAnalytics: { config: { debug_mode: true } } };
const manager = createConsentManager(config);
export const stored: StoredConsent | null = getStoredConsent();
export const viaVue: StoredConsent | null = useConsent().getConsent();
export const banner = h(ConsentBanner, { position: "top" });
export const enhanced: Theme = enhanceWithConsent(theme, config);
export const boot = consentBoot({ gaId: "G-TEST" });
export const vanilla = createBanner({ manager, position: "bottom" });
