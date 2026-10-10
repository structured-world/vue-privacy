---
description: Which visitors see the GDPR cookie banner. Consent jurisdictions (EEA and UK by default, Switzerland on request), country detection via Cloudflare headers, a Worker, an IP API or the browser time zone, with consent required when the lookup fails.
---

# Consent Jurisdictions and Region Detection

## Consent Jurisdictions

The banner is shown to visitors in a jurisdiction whose law requires consent before non-essential cookies or tracking. The visitor's country decides:

| Jurisdiction | Countries | Default |
|------|------|------|
| `'EEA'` | Austria, Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Poland, Portugal, Romania, Slovakia, Slovenia, Spain, Sweden; the parts of the EU with their own country codes (Åland, French Guiana, Guadeloupe, Martinique, Réunion, Mayotte, Saint-Martin); Iceland, Liechtenstein, Norway | on |
| `'UK'` | United Kingdom (UK GDPR, PECR regulation 6) | on |
| `'CH'` | Switzerland (revised FADP) | off |

```typescript
createConsentPlugin({
  consentJurisdictions: ['EEA', 'UK', 'CH'], // add Switzerland
});
```

Everywhere else every category is granted without a banner; US states with privacy laws are handled by `ccpaEnabled`. A choice made in a consent jurisdiction is stored as such and stands wherever the visitor goes; one made outside is checked against the current location on each visit.

The consent cookie (`consent_preferences`) is strictly necessary storage, set without consent to remember the choice (refusals included), so it holds only what that needs: the categories, the time and configuration version of the choice, and `consentRequired`. The country, region and detection method are never stored; cookies written by earlier versions with them are rewritten without them on the next page load, keeping what is left of their lifetime; one past its lifetime, or one for another consent `version`, is deleted instead.

`manager.isConsentRequired()` tells which applies to the visitor.

## When the Lookup Fails

A failed lookup (an ad blocker on the IP API, a network error, a browser reporting UTC) is no evidence that the visitor is outside a consent jurisdiction, so by default the visitor is asked:

```typescript
createConsentPlugin({
  geoFailure: 'require-consent', // default
});
```

With `'require-consent'` a choice stored outside consent jurisdictions is asked again too when its location check fails; the answer is then stored as given in a consent jurisdiction, so the check does not repeat. `geoFailure: 'grant'` treats a failed lookup as a visitor outside consent jurisdictions and keeps such a choice.

## Detection Modes

Configure detection with the `geoDetection` option:

```typescript
createConsentPlugin({
  geoDetection: 'auto', // Recommended
});
```

| Mode | Description |
|------|-------------|
| `'auto'` | Try all methods in order (recommended) |
| `'cloudflare'` | Only use Cloudflare headers |
| `'worker'` | Only use the Worker endpoint at `geoUrl` |
| `'api'` | Only use IP API |
| `'always'` | Ask every visitor (always show banner) |
| `'never'` | Ask no visitor (never show banner) |

## Detection Chain

In `'auto'` mode, detection methods are tried in order; the first that names the visitor's country answers. When all of them fail, `geoFailure` decides.

### 1. Cloudflare Headers (Fastest)

The library makes a `HEAD` request to the current page and reads `CF-IPCountry` from the response. Cloudflare adds that header to the request it sends to your origin, so a Worker or a response header Transform Rule has to copy it onto the response.

**Setup with a Worker:**

```typescript
export default {
  async fetch(request) {
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('CF-IPCountry', request.cf?.country ?? '');
    newResponse.headers.set('X-Is-EU-Country', request.cf?.isEUCountry === '1' ? 'true' : 'false');
    return newResponse;
  }
}
```

Cloudflare's `XX` (location unknown) and `T1` (Tor) count as no country, here and from the Worker endpoint. `X-Is-EU-Country` is optional. Cloudflare's EU flag covers EU members only, so without a country the library accepts it when it says `true` and moves on to the next method when it says `false`: the flag cannot tell a visitor in Norway or the UK from one in the US.

### 2. Worker Endpoint

With `geoUrl` set (for example `/api/geo` from [vue-privacy-worker](https://github.com/structured-world/vue-privacy-worker)), the library reads `countryCode` (and `region`) from that endpoint.

### 3. IP API

If the methods above are unavailable, the library calls ipapi.co:

```
GET https://ipapi.co/json/
```

It reads the country code; a response without one (a rate-limit error) counts as a failure.

::: warning Rate Limits
ipapi.co has rate limits on the free tier. For high-traffic sites, use Cloudflare or Worker detection.
:::

### 4. Browser Time Zone (Last Resort)

The browser's time zone maps to its country through a table generated from the IANA tz database (`zone.tab`, plus legacy names such as `Europe/Nicosia` and `GB`), covering every zone of every jurisdiction above, outermost regions included:

```typescript
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Europe/London -> GB, Atlantic/Azores -> PT, Indian/Reunion -> RE
```

Any other zone counts as outside consent jurisdictions. `UTC` and `Etc/*` carry no location (privacy-hardened browsers report UTC everywhere), and the generic `CET`, `MET`, `EET` and `WET` span several countries without naming one; all count as a failure. A traveller keeps the home time zone, so this is a heuristic.

## Custom Detector

Implement your own detection logic. Return the country code when you have it: the library decides from it against `consentJurisdictions`. Without a country, `consentRequired` is your answer to "does this visitor need to be asked"; throw when you cannot tell, and `geoFailure` applies (as it does for an answer with neither). A detector written for an earlier version that returns `isEU` instead is read the same way.

```typescript
import type { GeoDetector } from '@structured-world/vue-privacy';

const myDetector: GeoDetector = {
  async detect() {
    const response = await fetch('/api/geo');
    if (!response.ok) throw new Error('geo lookup failed');
    const data = await response.json();
    return {
      consentRequired: false, // decided from countryCode
      countryCode: data.country,
      method: 'manual' as const,
    };
  }
};

createConsentPlugin({
  geoDetector: myDetector,
});
```
