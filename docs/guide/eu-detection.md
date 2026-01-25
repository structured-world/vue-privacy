# EU Detection

## Detection Modes

Configure EU detection with the `euDetection` option:

```typescript
createConsentPlugin({
  euDetection: 'auto', // Recommended
});
```

| Mode | Description |
|------|-------------|
| `'auto'` | Try all methods in order (recommended) |
| `'cloudflare'` | Only use Cloudflare headers |
| `'api'` | Only use IP API |
| `'always'` | Treat all users as EU (always show banner) |
| `'never'` | Treat all users as non-EU (never show banner) |

## Detection Chain

In `'auto'` mode, detection methods are tried in order:

### 1. Cloudflare Headers (Fastest)

Checks for `X-Is-EU-Country` header set by Cloudflare.

**Setup with Transform Rules:**

1. Go to Cloudflare Dashboard
2. Select your domain
3. Rules > Transform Rules > Modify Request Header
4. Add rule:
   - Header name: `X-Is-EU-Country`
   - Value: Dynamic expression `ip.geoip.is_in_european_union`

**Setup with Worker:**

```typescript
export default {
  async fetch(request) {
    const isEU = request.cf?.isEUCountry === true;
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Is-EU-Country', isEU ? 'true' : 'false');
    return newResponse;
  }
}
```

### 2. IP API (Fallback)

If Cloudflare header is not available, the library calls ipapi.co:

```
GET https://ipapi.co/json/
```

Returns country code and EU membership status.

::: warning Rate Limits
ipapi.co has rate limits on the free tier. For high-traffic sites, use Cloudflare detection.
:::

### 3. Timezone Heuristics (Last Resort)

If API call fails, the library checks the browser timezone:

```typescript
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Maps timezone to likely EU country
```

This is not 100% accurate but provides a reasonable fallback.

## Custom Detector

Implement your own detection logic:

```typescript
import type { GeoDetector } from '@structured-world/vue-privacy';

const myDetector: GeoDetector = {
  async detect() {
    const response = await fetch('/api/geo');
    const data = await response.json();
    return {
      isEU: data.is_eu,
      countryCode: data.country,
      method: 'custom' as const,
    };
  }
};

createConsentPlugin({
  geoDetector: myDetector,
});
```

## EU Countries

The following countries are considered EU for consent purposes:

Austria, Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Poland, Portugal, Romania, Slovakia, Slovenia, Spain, Sweden.

Plus EEA countries: Iceland, Liechtenstein, Norway.
