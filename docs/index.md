---
layout: home

hero:
  name: "Vue Privacy"
  text: Google Analytics for Vue — GDPR Out of the Box
  tagline: Add GA4 to Vue 3, VitePress, Nuxt 3 or Quasar with one line. Google Consent Mode v2, EU auto-detection, cookie banner, and SPA page tracking included.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: View on GitHub
      link: https://github.com/structured-world/vue-privacy

features:
  - icon: "\U0001F4CA"
    title: Google Analytics in One Line
    details: Pass your GA4 measurement ID and you're done. Loads gtag.js, configures Consent Mode v2, tracks page views — all automatically.
  - icon: "\U0001F512"
    title: Google Consent Mode v2
    details: Full support for analytics_storage, ad_storage, ad_user_data, and ad_personalization. Required by Google since March 2024 for EU traffic.
  - icon: "\U0001F30D"
    title: EU Auto-Detection
    details: Automatically detects EU users via Cloudflare headers, IP geolocation, or timezone heuristics. Shows consent banner only when required.
  - icon: "\U0001F680"
    title: SPA Page Tracking
    details: Built-in router integration for VitePress, Vue Router, and Quasar. Tracks page views on navigation without extra code.
  - icon: "\U0001F3A8"
    title: Customizable Banner
    details: CSS custom properties for theming, configurable UI text, and callback hooks. Adapts to your site's design.
  - icon: "\U0001F4E6"
    title: Lightweight & SSR Safe
    details: Zero runtime dependencies. Tree-shakeable exports. Works with SSR and static site generation.
---
