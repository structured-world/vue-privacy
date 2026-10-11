import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { enhanceWithConsent, ConsentBanner } from "../../../src/vitepress/index";
import { ConsentPreferenceModal } from "../../../src/vue/index";
import "./style.css";
import BugReportWidget from "./components/BugReportWidget.vue";
import ConsentDebugPanel from "./components/ConsentDebugPanel.vue";

// The site runs the setup it recommends: basic mode loads nothing from Google before the
// visitor allows analytics, and asking everyone needs no country lookup, so no third party
// sees the visitor's address before a choice. The site measures visits only, so only
// analytics is offered. GitHub Pages serves no API: the choice stays in the consent cookie.
const consentTheme = enhanceWithConsent(DefaultTheme, {
  gaId: "G-DX5Y29J2QQ",
  consentMode: "basic",
  geoDetection: "always",
  usedCategories: ["analytics"],
});

export default {
  ...consentTheme,
  Layout() {
    return h(consentTheme.Layout ?? DefaultTheme.Layout, null, {
      "layout-bottom": () => [
        h(ConsentBanner),
        h(ConsentPreferenceModal),
        h(BugReportWidget),
        h(ConsentDebugPanel),
      ],
    });
  },
} satisfies Theme;
