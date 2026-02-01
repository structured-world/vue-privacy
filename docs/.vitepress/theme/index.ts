import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { enhanceWithConsent, ConsentBanner } from "../../../src/vitepress/index";
import { createKVStorage } from "../../../src/index";
import "./style.css";
import BugReportWidget from "./components/BugReportWidget.vue";
import ConsentDebugPanel from "./components/ConsentDebugPanel.vue";

const consentTheme = enhanceWithConsent(DefaultTheme, {
  gaId: "G-DX5Y29J2QQ",
  storage: createKVStorage("/api/consent"),
  geoUrl: "/api/geo",
  euDetection: "auto",
});

export default {
  ...consentTheme,
  Layout() {
    return h(consentTheme.Layout ?? DefaultTheme.Layout, null, {
      "layout-bottom": () => [h(ConsentBanner), h(BugReportWidget), h(ConsentDebugPanel)],
    });
  },
} satisfies Theme;
