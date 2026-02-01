# CDN / Script Tag

Use Vue Privacy without a build system — directly from a CDN via `<script>` tag.

The UMD/IIFE build includes the core consent manager, storage utilities, Google Analytics integration, and geo-detection. Vue components are **not** included — this build is framework-agnostic.

## Installation

::: code-group

```html [unpkg]
<script src="https://unpkg.com/@structured-world/vue-privacy"></script>
```

```html [jsdelivr]
<script src="https://cdn.jsdelivr.net/npm/@structured-world/vue-privacy"></script>
```

```html [Pinned version]
<script src="https://unpkg.com/@structured-world/vue-privacy@1.3.0"></script>
```

:::

## Usage

All exports are available under the global `VuePrivacy` namespace:

```html
<div id="consent-banner" style="display:none; position:fixed; bottom:0; left:0; right:0; padding:16px; background:#fff; box-shadow:0 -2px 8px rgba(0,0,0,0.1); z-index:9999;">
  <p>We use cookies to improve your experience.</p>
  <button onclick="acceptAll()">Accept All</button>
  <button onclick="rejectAll()">Reject All</button>
</div>

<script src="https://unpkg.com/@structured-world/vue-privacy"></script>
<script>
  var manager = VuePrivacy.createConsentManager({
    gaId: 'G-XXXXXXXXXX',
    euDetection: 'auto',
  });

  manager.onShowBanner(function () {
    document.getElementById('consent-banner').style.display = 'block';
  });

  manager.onHideBanner(function () {
    document.getElementById('consent-banner').style.display = 'none';
  });

  function acceptAll() {
    manager.acceptAll();
  }

  function rejectAll() {
    manager.rejectAll();
  }

  manager.init();
</script>
```

## With Remote Storage

```html
<script src="https://unpkg.com/@structured-world/vue-privacy"></script>
<script>
  var manager = VuePrivacy.createConsentManager({
    gaId: 'G-XXXXXXXXXX',
    storage: VuePrivacy.createKVStorage('/api/consent'),
  });

  manager.init();
</script>
```

## Available Exports

The UMD build exposes these under `VuePrivacy`:

| Export | Description |
|--------|-------------|
| `createConsentManager(options)` | Create a consent manager instance |
| `createKVStorage(url)` | Create Cloudflare KV storage adapter |
| `createGeoDetector(mode, geoUrl?)` | Create geo-detection provider |
| `ConsentManager` | Consent manager class |
| `DEFAULT_CONFIG` | Default configuration values |
| `initGoogleAnalytics(gaId)` | Initialize GA4 manually |
| `trackPageView(path, title?)` | Track a page view |
| `getStoredConsent(config?)` | Read consent from cookie |
| `storeConsent(consent, config?)` | Write consent to cookie |
| `clearConsent(config?)` | Remove consent cookie |

## Bundle Size

| Format | Size | Gzipped |
|--------|------|---------|
| IIFE (CDN) | ~10 kB | ~3.5 kB |
| UMD (require) | ~10 kB | ~3.6 kB |
| ES module | ~18 kB | ~4.8 kB |
