import { defineConfig } from "vitepress";

const hostname = "https://privacy.sw.foundation";

export default defineConfig({
  title: "Vue Privacy",
  description: "Privacy-first consent & analytics for Vue ecosystem",

  head: [
    ["link", { rel: "icon", href: "/favicon.ico" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Vue Privacy" }],
    [
      "meta",
      {
        property: "og:description",
        content: "Privacy-first consent & analytics for Vue ecosystem",
      },
    ],
    ["meta", { property: "og:url", content: hostname }],
    ["meta", { name: "twitter:card", content: "summary" }],
  ],

  sitemap: {
    hostname,
  },

  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "Vue Privacy",

    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "API", link: "/api/" },
      { text: "Platform", link: "https://privacy.structured.world" },
      { text: "GitHub", link: "https://github.com/structured-world/vue-privacy" },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Getting Started",
          items: [
            { text: "Introduction", link: "/guide/" },
            { text: "Installation", link: "/guide/installation" },
            { text: "Quick Start", link: "/guide/quick-start" },
          ],
        },
        {
          text: "Framework Integration",
          items: [
            { text: "Vue 3", link: "/guide/vue" },
            { text: "Nuxt 3", link: "/guide/nuxt" },
            { text: "VitePress", link: "/guide/vitepress" },
            { text: "Quasar", link: "/guide/quasar" },
          ],
        },
        {
          text: "Features",
          items: [
            { text: "Consent Banner", link: "/guide/consent-banner" },
            { text: "Preference Center", link: "/guide/preference-center" },
            { text: "Google Consent Mode v2", link: "/guide/consent-mode" },
            { text: "Script Blocking", link: "/guide/script-blocking" },
            { text: "Geo Detection", link: "/guide/geo-detection" },
            { text: "Customization", link: "/guide/customization" },
          ],
        },
        {
          text: "Platform Integration",
          items: [
            { text: "Privacy Platform", link: "/guide/platform" },
            { text: "Analytics", link: "/guide/analytics" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          items: [
            { text: "Core", link: "/api/" },
            { text: "Vue Plugin", link: "/api/vue" },
            { text: "Types", link: "/api/types" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/structured-world/vue-privacy" },
      { icon: "npm", link: "https://www.npmjs.com/package/@structured-world/vue-privacy" },
    ],

    footer: {
      message: "Released under the Apache 2.0 License. Powered by structured.world",
      copyright: "Copyright 2025 Dmitry Prudnikov",
    },

    editLink: {
      pattern: "https://github.com/structured-world/vue-privacy/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    search: {
      provider: "local",
    },
  },
});
