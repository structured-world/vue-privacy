import { defineConfig, type HeadConfig } from "vitepress";
// `with { type: "json" }` requires Node 20.10+ (aligned with package.json engines).
import pkg from "../../package.json" with { type: "json" };

const hostname = "https://privacy.sw.foundation";

// Page title mappings for breadcrumbs
const pageTitles: Record<string, string> = {
  guide: "Guide",
  api: "API Reference",
  installation: "Installation",
  "quick-start": "Quick Start",
  vue: "Vue 3",
  nuxt: "Nuxt 3",
  vitepress: "VitePress",
  quasar: "Quasar",
  cdn: "CDN / Script Tag",
  "consent-banner": "Consent Banner",
  "preference-center": "Preference Center",
  "consent-mode": "Google Consent Mode v2",
  "script-blocking": "Script Blocking",
  "eu-detection": "EU Detection",
  customization: "Customization",
  analytics: "Analytics Overview",
  ecommerce: "Ecommerce Tracking",
  platform: "Privacy Platform",
  types: "Types",
};

// JSON-LD Schemas
// Organization is sw.foundation (the foundation), logo hosted on docs subdomain is valid per schema.org
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "sw.foundation",
  url: "https://sw.foundation",
  logo: `${hostname}/logo.svg`,
  sameAs: ["https://github.com/structured-world/vue-privacy"],
};

// VitePress local search uses modal overlay, not URL params - omit SearchAction
const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  url: hostname,
  name: "Vue Privacy Documentation",
  description:
    "Add Google Analytics to Vue 3, VitePress & Quasar with GDPR consent. Google Consent Mode v2, EU auto-detection, cookie banner, and SPA page tracking.",
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Vue Privacy",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  // installUrl for package registry page, downloadUrl would require direct file link
  installUrl: "https://www.npmjs.com/package/@structured-world/vue-privacy",
  softwareVersion: pkg.version,
  author: {
    "@type": "Organization",
    name: "sw.foundation",
  },
};

function generateBreadcrumbs(relativePath: string): object | null {
  const cleanPath = relativePath.replace(/(?:index)?\.md$/, "");
  if (!cleanPath) return null; // Home page - no breadcrumbs

  const segments = cleanPath.split("/").filter(Boolean);
  const isApiSection = segments[0] === "api";
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: hostname,
    },
  ];

  let currentPath = "";
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    // /guide/vue -> "Vue 3", /api/vue -> "Vue Plugin"
    let title = pageTitles[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    if (isApiSection && segment === "vue") {
      title = "Vue Plugin";
    }
    items.push({
      "@type": "ListItem",
      position: index + 2,
      name: title,
      item: `${hostname}${currentPath}`,
    });
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

export default defineConfig({
  vite: {
    define: {
      __VUE_PRIVACY_VERSION__: JSON.stringify(pkg.version),
    },
  },

  title: "Vue Privacy",
  titleTemplate: ":title | Vue Privacy",
  cleanUrls: true,
  description:
    "Add Google Analytics to Vue 3, VitePress & Quasar with GDPR consent. Google Consent Mode v2, EU auto-detection, cookie banner, and SPA page tracking.",

  transformHead({ pageData }) {
    const head: HeadConfig[] = [];
    const title = pageData.title || "Vue Privacy";
    const description =
      pageData.description ||
      "Add Google Analytics to Vue 3, VitePress & Quasar with GDPR consent. Google Consent Mode v2, EU auto-detection, cookie banner, and SPA page tracking.";
    // Remove trailing slash for URL consistency with breadcrumbs
    const cleanPath = pageData.relativePath.replace(/(?:index)?\.md$/, "").replace(/\/$/, "");
    const url = `${hostname}/${cleanPath}`;

    // Open Graph and Twitter meta tags
    head.push(["meta", { property: "og:title", content: title }]);
    head.push(["meta", { property: "og:description", content: description }]);
    head.push(["meta", { property: "og:url", content: url }]);
    head.push(["meta", { name: "twitter:card", content: "summary_large_image" }]);
    head.push(["meta", { name: "twitter:title", content: title }]);
    head.push(["meta", { name: "twitter:description", content: description }]);
    head.push(["meta", { name: "twitter:image", content: `${hostname}/og-image.png` }]);
    head.push(["meta", { name: "twitter:image:alt", content: title }]);
    head.push(["link", { rel: "canonical", href: url }]);

    // JSON-LD: BreadcrumbList (for all pages except home)
    const breadcrumbs = generateBreadcrumbs(pageData.relativePath);
    if (breadcrumbs) {
      head.push(["script", { type: "application/ld+json" }, JSON.stringify(breadcrumbs)]);
    }

    // JSON-LD: SoftwareApplication (home page only)
    if (!cleanPath) {
      head.push(["script", { type: "application/ld+json" }, JSON.stringify(softwareAppSchema)]);
    }

    return head;
  },

  // Enable git-based lastUpdated timestamps for sitemap and page metadata
  lastUpdated: true,

  sitemap: {
    hostname,
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
    // JSON-LD: Organization schema (global)
    ["script", { type: "application/ld+json" }, JSON.stringify(organizationSchema)],
    // JSON-LD: WebSite schema (global)
    ["script", { type: "application/ld+json" }, JSON.stringify(webSiteSchema)],
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
            { text: "CDN / Script Tag", link: "/guide/cdn" },
          ],
        },
        {
          text: "Features",
          items: [
            { text: "Consent Banner", link: "/guide/consent-banner" },
            { text: "Preference Center", link: "/guide/preference-center" },
            { text: "Google Consent Mode v2", link: "/guide/consent-mode" },
            { text: "Script Blocking", link: "/guide/script-blocking" },
            { text: "EU Detection", link: "/guide/eu-detection" },
            { text: "Customization", link: "/guide/customization" },
          ],
        },
        {
          text: "Analytics & Tracking",
          items: [
            { text: "Analytics Overview", link: "/guide/analytics" },
            { text: "Ecommerce Tracking", link: "/guide/ecommerce" },
          ],
        },
        {
          text: "Platform Integration",
          items: [{ text: "Privacy Platform", link: "/guide/platform" }],
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
      copyright: "Copyright 2025-2026 Dmitry Prudnikov",
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
