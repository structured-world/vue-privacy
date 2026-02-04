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

## Event Tracking

Track conversions and ecommerce events:

```html
<script src="https://unpkg.com/@structured-world/vue-privacy"></script>
<script>
var manager = VuePrivacy.createConsentManager({
  gaId: 'G-XXXXXXXXXX',
});

manager.init().then(function() {
  // Track sign up
  manager.trackSignUp('email');

  // Track lead generation
  manager.trackGenerateLead({ value: 100, currency: 'USD' });

  // Track purchase
  manager.trackPurchase({
    transaction_id: 'ORDER_123',
    currency: 'USD',
    value: 99.99,
    shipping: 5.99,
    items: [
      { item_id: 'SKU_1', item_name: 'Widget', price: 99.99, quantity: 1 }
    ]
  });

  // Track add to cart
  manager.trackAddToCart({
    currency: 'USD',
    value: 29.99,
    items: [
      { item_id: 'SKU_2', item_name: 'Gadget', price: 29.99, quantity: 1 }
    ]
  });

  // Generic event
  manager.trackEvent('share', { method: 'twitter' });
});
</script>
```

### Low-level Functions

For direct gtag access:

```html
<script>
// Direct trackEvent (bypasses consent check)
VuePrivacy.trackEvent('custom_event', { param: 'value' });

// Direct trackPageView
VuePrivacy.trackPageView('/custom/path', 'Custom Title');
</script>
```

## SPA Page Tracking (Manual)

For single-page apps without Vue Router:

```html
<script>
var manager = VuePrivacy.createConsentManager({
  gaId: 'G-XXXXXXXXXX',
  sendPageView: false,  // Disable auto page_view
});

manager.init().then(function() {
  // Track initial page
  manager.trackPageView(window.location.pathname);
});

// On navigation (e.g., with vanilla router)
function onNavigate(path, title) {
  manager.trackPageView(path, title);
}
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
| `trackEvent(name, params?)` | Track a custom event |
| `getStoredConsent(config?)` | Read consent from cookie |
| `storeConsent(consent, config?)` | Write consent to cookie |
| `clearConsent(config?)` | Remove consent cookie |

### ConsentManager Methods

| Method | Description |
|--------|-------------|
| `trackEvent(name, params?)` | Track custom GA4 event |
| `trackPurchase(params)` | Track purchase event |
| `trackAddToCart(params)` | Track add to cart event |
| `trackBeginCheckout(params)` | Track checkout start |
| `trackViewItem(params)` | Track product view |
| `trackSignUp(method?)` | Track registration |
| `trackLogin(method?)` | Track login |
| `trackGenerateLead(params?)` | Track lead generation |

See [Ecommerce Tracking](/guide/ecommerce) for full parameter documentation.

## Bundle Size

| Format | Size | Gzipped |
|--------|------|---------|
| IIFE (CDN) | ~31 kB | ~11 kB |
| UMD (require) | ~31 kB | ~11 kB |
| ES module | ~47 kB | ~13 kB |
