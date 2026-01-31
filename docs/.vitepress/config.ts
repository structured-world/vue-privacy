import { defineConfig, type HeadConfig } from "vitepress";

const hostname = "https://privacy.sw.foundation";

export default defineConfig({
  title: "Vue Privacy",
  titleTemplate: ":title | Vue Privacy",
  cleanUrls: true,
  description: "Privacy-first consent & analytics for Vue ecosystem",

  transformHead({ pageData }) {
    const head: HeadConfig[] = [];
    const title = pageData.title || "Vue Privacy";
    const description =
      pageData.description || "Privacy-first consent & analytics for Vue ecosystem";
    const cleanPath = pageData.relativePath.replace(/(?:index)?\.md$/, "");
    const url = `${hostname}/${cleanPath}`;

    head.push(["meta", { property: "og:title", content: title }]);
    head.push(["meta", { property: "og:description", content: description }]);
    head.push(["meta", { property: "og:url", content: url }]);
    head.push(["meta", { name: "twitter:card", content: "summary_large_image" }]);
    head.push(["meta", { name: "twitter:title", content: title }]);
    head.push(["meta", { name: "twitter:description", content: description }]);
    head.push(["meta", { name: "twitter:image", content: `${hostname}/og-image.png` }]);
    head.push(["meta", { name: "twitter:image:alt", content: title }]);
    head.push(["link", { rel: "canonical", href: url }]);

    return head;
  },

  // Enable git-based lastUpdated timestamps for sitemap and page metadata
  lastUpdated: true,

  sitemap: {
    hostname,
    transformItems: (items) =>
      items.map((item) => ({
        ...item,
        // Prefer existing lastmod from git timestamps; fall back to build date
        lastmod: item.lastmod || new Date().toISOString().split("T")[0],
      })),
  },

  head: [
    ["link", { rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
    ["link", { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" }],
    ["link", { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" }],
    ["meta", { property: "og:image", content: `${hostname}/og-image.png` }],
    ["meta", { property: "og:image:width", content: "1200" }],
    ["meta", { property: "og:image:height", content: "630" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "Vue Privacy" }],
  ],

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
