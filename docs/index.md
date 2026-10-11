---
layout: home
description: Cookie consent for Vue 3, Nuxt, VitePress and Quasar where the visitor's choice controls tracking. Google Consent Mode v2 with a basic mode that sends nothing to Google before consent, 31 languages, no backend required.

hero:
  name: "Vue Privacy"
  text: Consent that controls tracking
  tagline: Cookie consent for Vue 3, Nuxt, Quasar and VitePress where the visitor's choice decides what runs, across page navigation, reloads, open tabs and changed minds. Google Consent Mode v2, with a basic mode that sends nothing to Google before consent. Open source, no backend required.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: Basic vs Advanced Mode
      link: /guide/consent-mode
    - theme: alt
      text: View on GitHub
      link: https://github.com/structured-world/vue-privacy

features:
  - icon: "\U0001F6E1️"
    title: Nothing Reaches Google Before Consent
    details: "With consentMode: 'basic', no gtag.js, no dataLayer entry and no request leaves the page until the visitor allows analytics. Withdrawing stops the tag and deletes the Google Analytics cookies. This site runs that mode: open the Network tab and check."
    link: /guide/consent-mode
    linkText: How the two modes differ
  - icon: "\U0001F501"
    title: Holds Across the SPA Lifecycle
    details: The choice survives reloads and client-side navigation, a slow region lookup or remote storage read never overrides a newer choice, and in basic mode a choice or reset made in another tab is followed here.
  - icon: "\U0001F511"
    title: Asks When a Feature Needs It
    details: "A feature that needs a refused category asks at that moment, saying why: requestConsent('functional', { reason }). Nothing is asked up front that the site does not use."
    link: /guide/preference-center#asking-again-when-a-feature-needs-a-category
    linkText: Consent on demand
  - icon: "⚖️"
    title: Fair by Design
    details: Refusing takes one click, as accepting does, in the same style. Nothing is pre-ticked. Offer only the categories the site really uses.
  - icon: "\U0001F30D"
    title: Ask Everyone, or Where the Law Requires
    details: Ask every visitor, or only in the EEA and the UK (Switzerland on request), found through Cloudflare headers, a Worker, IP geolocation or the time zone. A failed lookup asks rather than guesses.
    link: /guide/consent-jurisdictions
    linkText: Consent jurisdictions
  - icon: "\U0001F4E6"
    title: Vue-Native, Light, 31 Languages
    details: A plugin and components for Vue 3, Nuxt and Quasar, one line for VitePress, a script tag anywhere else. No runtime dependencies, SSR safe, every official EU language and more.
---
