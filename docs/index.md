---
layout: home
description: GDPR cookie consent banner and Google Analytics 4 for Vue 3, Nuxt, VitePress and Quasar. Google Consent Mode v2, 31 languages, region detection, refusing as easy as accepting, and SPA page tracking.

hero:
  name: "Vue Privacy"
  text: Cookie Consent and Google Analytics for Vue
  tagline: A GDPR cookie consent banner with Google Consent Mode v2 for GA4, in 31 languages. One line for VitePress and Quasar, a plugin for Vue 3 and Nuxt, a script tag anywhere else.
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
    details: Pass your GA4 measurement ID and you're done. Loads gtag.js, configures Consent Mode v2, and tracks page views on every navigation in VitePress, Quasar and Vue Router apps.
  - icon: "\U0001F512"
    title: Google Consent Mode v2
    details: All four signals (analytics_storage, ad_storage, ad_user_data, ad_personalization), so Google receives the visitor's choice where its EU user consent policy requires it. Advanced mode with cookieless pings, or basic mode that loads nothing before consent.
  - icon: "\U0001F30D"
    title: Consent Jurisdictions
    details: Asks visitors in the EEA and the UK (Switzerland on request), found through Cloudflare headers, a Worker, IP geolocation or the time zone. A failed lookup asks rather than guesses.
  - icon: "⚖️"
    title: Fair by Design
    details: Refusing takes one click, as accepting does. Nothing is pre-ticked. A feature that needs a refused category asks again at that moment, saying why.
  - icon: "\U0001F5E3️"
    title: 31 Languages
    details: Every official EU language plus Norwegian, Icelandic, Japanese, Korean, Russian, Ukrainian and Chinese, chosen from the browser's languages or your site's switcher.
  - icon: "\U0001F4E6"
    title: Lightweight & SSR Safe
    details: No runtime dependencies. Tree-shakeable exports, light and dark themes, CSS custom properties. Works with SSR and static site generation.
---
