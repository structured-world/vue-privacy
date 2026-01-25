import { defineConfig } from "vitepress";

const hostname = "https://consent.sw.foundation";

export default defineConfig({
  title: "@structured-world/consent",
  description: "GDPR-compliant cookie consent with Google Consent Mode v2",

  head: [
    ["link", { rel: "icon", href: "/favicon.ico" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "@structured-world/consent" }],
    [
      "meta",
      {
        property: "og:description",
        content: "GDPR-compliant cookie consent with Google Consent Mode v2",
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

    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "API", link: "/api/" },
      { text: "GitHub", link: "https://github.com/structured-world/consent" },
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
            { text: "VitePress", link: "/guide/vitepress" },
            { text: "Quasar", link: "/guide/quasar" },
          ],
        },
        {
          text: "Features",
          items: [
            { text: "Google Consent Mode v2", link: "/guide/consent-mode" },
            { text: "EU Detection", link: "/guide/eu-detection" },
            { text: "Customization", link: "/guide/customization" },
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
      { icon: "github", link: "https://github.com/structured-world/consent" },
      { icon: "npm", link: "https://www.npmjs.com/package/@structured-world/consent" },
    ],

    footer: {
      message: "Released under the Apache 2.0 License.",
      copyright: "Copyright 2025 Dmitry Prudnikov",
    },

    editLink: {
      pattern: "https://github.com/structured-world/consent/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    search: {
      provider: "local",
    },
  },
});
