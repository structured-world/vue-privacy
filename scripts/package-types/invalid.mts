// Wrong consumer code: each marked line must fail with exactly the marked error. A declaration
// that fails to resolve degrades its exports to `any`, and these lines would then pass silently.
import { VERSION, createConsentManager, getStoredConsent } from "@structured-world/vue-privacy";
import { useConsent, ConsentBanner } from "@structured-world/vue-privacy/vue";
import { enhanceWithConsent } from "@structured-world/vue-privacy/vitepress";
import { consentBoot } from "@structured-world/vue-privacy/quasar";
import { createBanner } from "@structured-world/vue-privacy/vanilla";
import { h } from "vue";
import type { Theme } from "vitepress";

declare const theme: Theme;

export const version: symbol = VERSION; // @expect TS2322
createConsentManager({ googleAnalytics: { config: { debug_mode: false } } }); // @expect TS2322
export const stored: number = getStoredConsent(); // @expect TS2322
// Reached through a type the compiler synthesized in vue/index.d.ts, not a written import.
export const viaVue: number = useConsent().getConsent(); // @expect TS2322
// Props of a component declared in a `.vue.d.ts` file.
export const banner = h(ConsentBanner, { position: "left" }); // @expect TS2769
enhanceWithConsent(theme, { gaId: 1 }); // @expect TS2322
consentBoot({ gaId: 1 }); // @expect TS2322
createBanner({ manager: "not a manager" }); // @expect TS2322
