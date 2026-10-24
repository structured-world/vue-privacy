---
description: Run Google Tag Manager under Google Consent Mode v2 with Vue Privacy. The consent default before the container, basic mode that loads no container before consent, withdrawal, and how to set up the container's tags.
---

# Google Tag Manager

A site that runs Google Analytics 4, Google Ads or other tags through a Google Tag Manager container passes the container ID as `gtmId`. The manager then does for the container what it does for gtag.js with `gaId`: the page's single `consent default` comes first, the container follows it, and every later choice is a `consent update`.

```typescript
createConsentPlugin({
  gtmId: 'GTM-XXXXXXX',
});
```

Remove the container snippet Tag Manager gives you, both the `<script>` in `<head>` and the `<noscript>` iframe after `<body>`: the manager queues the snippet's `gtm.js` event and loads `gtm.js` itself. `gtmId` works alone or next to `gaId`, when GA4 runs from gtag.js and the container carries other tags.

## What the Manager Does

The `dataLayer` starts like this, in both modes:

```javascript
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500,
});
dataLayer.push({ 'gtm.start': 1761300000000, event: 'gtm.js' });
```

Then `https://www.googletagmanager.com/gtm.js?id=GTM-XXXXXXX` loads. A returning visitor's stored choice is known before the container loads, so the default carries it and needs no update, as for gtag.js (see [Google Consent Mode v2](/guide/consent-mode)). `googleAnalytics.adsDataRedaction`, `googleAnalytics.urlPassthrough` and `googleAnalytics.set` go out as one `gtag('set', ...)` between the default and `gtm.js`, so they cover every hit of the container; `googleAnalytics.config` and `customParameters` apply to `gaId` only, since a container configures its own tags.

In the default advanced mode the container loads for every visitor once the manager has decided the consent state (a stored choice, the visitor's jurisdiction), and its Google tags send cookieless pings before a choice and after a refusal. A container that fails to load (an ad blocker) calls `onGoogleAnalyticsError`, and the next consent change retries it.

## Basic Mode

With `consentMode: 'basic'` the container stays off the page until the visitor allows analytics: no `dataLayer` entry, no `gtm.js`, no request to `googletagmanager.com`.

```typescript
createConsentPlugin({
  gtmId: 'GTM-XXXXXXX',
  consentMode: 'basic',
  reloadOnWithdrawal: true,
});
```

- **A grant on this page** issues the default with the granted signals, queues `gtm.js` and loads the container.
- **A stored grant** loads the container on the next page at once, without the banner.
- **A grant implied by the jurisdiction** (CCPA, outside consent jurisdictions) is not the visitor's choice and loads nothing; use `geoDetection: 'always'` to ask every visitor.
- **A withdrawal** sends `consent update` with the denied signals and deletes the `_ga` and `_ga_<ID>` cookies of the container's GA4 tags. A container that already runs cannot be unloaded, and unlike gtag.js it has no switch the manager could turn off, so its tags keep sending cookieless pings until the page goes. With `reloadOnWithdrawal: true` the manager saves the choice and reloads the page; the reloaded page holds the refusal and loads no container. The option is off by default because the reload drops in-page state.

A withdrawal also takes the reload path when the container was loaded by an earlier manager on the same page (an app remount) and the new one finds the refusal on start. A container the site loads with its own snippet never triggers a reload: it would come back with every load. Basic mode needs `gtmId` for that reason: the manager can keep its promise only for a container it loads itself.

## Keeping Your Own Snippet

A site that keeps the container snippet (to load the container as early as possible, before the manager has decided anything) uses advanced mode without `gtmId` and issues the default itself, in `<head>`, before the snippet:

```html
<head>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500,
    });
    gtag('set', 'ads_data_redaction', true);
  </script>
  <!-- Google Tag Manager snippet follows -->
</head>
```

The default must be the first consent command the container sees; tags that fire before any default count as granted. The manager finds this default and sends the visitor's state as an update. `wait_for_update` is how long the container's tags hold their first hits for that update: a choice made in a consent jurisdiction is restored without a lookup, while other visitors wait for the geo lookup, so raise it if the update arrives later on your site. `VuePrivacy.setConsentDefaults(signals, waitForUpdate)` issues the same default when the UMD build is already loaded synchronously in `<head>`.

Leave out the `<noscript>` iframe: it loads `ns.html` from `googletagmanager.com` for visitors without JavaScript, who are never asked and so never consent. Without JavaScript the manager cannot run either.

## Setting Up the Container

The manager supplies the consent state; the container decides what each tag does with it.

- **Google tags** (the Google tag, GA4 events, Google Ads, Floodlight, Conversion Linker) have built-in consent checks and adjust to the signals themselves. Turn on **Admin → Container Settings → Enable consent overview** to see them per tag.
- **Other tags** (Meta Pixel, Hotjar, a Custom HTML tag) have none. Open the tag's **Advanced Settings → Consent Settings**, pick **Require additional consent for tag to fire** and add `ad_storage` for advertising tags, `analytics_storage` for analytics ones. Such a tag waits until the signal is granted and fires then.
- **No consent management template** and no **Consent Initialization** tag for another CMP: the manager is the CMP, and a second default from the container would compete with its own.

Events the site sends to the container (`dataLayer.push({ event: 'sign_up' })`) are the site's own: the manager does not gate them. In basic mode a container loaded later processes the events queued before it, so push events only while `getConsent()?.categories.analytics` is `true` if none may be counted from before the grant.
