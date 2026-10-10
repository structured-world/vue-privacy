---
description: Add GDPR-compliant Google Analytics to Quasar Framework. Boot file setup, ConsentBanner component, useConsent composable, and Dialog integration.
---

# Quasar Framework Integration

## Boot File (Recommended)

Create a boot file for consent:

```typescript
// src/boot/consent.ts
import { boot } from 'quasar/wrappers';
import { consentBoot } from '@structured-world/vue-privacy/quasar';

export default boot(consentBoot({
  gaId: 'G-XXXXXXXXXX',
  geoDetection: 'auto',
}));
```

Register in `quasar.config.js`:

```javascript
module.exports = configure(function (/* ctx */) {
  return {
    boot: ['consent'],
    // ...
  };
});
```

### With Router Middleware

Add hooks for tracking customization:

```typescript
// src/boot/consent.ts
import { boot } from 'quasar/wrappers';
import { consentBoot } from '@structured-world/vue-privacy/quasar';

export default boot(consentBoot({
  gaId: 'G-XXXXXXXXXX',
  routerMiddleware: {
    beforeTrack: (to) => {
      // Skip admin routes
      if (to.path.startsWith('/admin')) return false;
    },
    afterTrack: (to, eventName) => {
      console.log('Tracked:', to.path, eventName);
    }
  }
}));
```

#### Skip Initial Page View

To skip the initial page load tracking:

```typescript
routerMiddleware: {
  beforeTrack: (to, from) => {
    // Initial navigation: to === from
    if (to === from) return false;
    return true;
  }
}
```

## Using the Banner

Add the banner to your main layout:

```vue
<!-- src/layouts/MainLayout.vue -->
<script setup>
import { ConsentBanner } from '@structured-world/vue-privacy/quasar';
</script>

<template>
  <q-layout>
    <q-page-container>
      <router-view />
    </q-page-container>
    <ConsentBanner position="bottom" />
  </q-layout>
</template>
```

## Plugin Alternative

If you prefer not to use a boot file:

```typescript
// src/main.ts
import { createConsentPlugin } from '@structured-world/vue-privacy/quasar';

app.use(createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
}));
```

## Composable

Use the composable in any component:

```vue
<script setup>
import { useConsent } from '@structured-world/vue-privacy/quasar';

const { showPreferenceCenter } = useConsent();
</script>

<template>
  <!-- Always offered: the visitor can change or withdraw a choice at any time -->
  <q-btn label="Cookie Settings" @click="showPreferenceCenter" />
</template>
```

The composable's methods read the manager's state when called; they are not Vue refs, so a template condition on `hasConsent()` does not update when the visitor chooses. Keep such state in a ref updated from `manager.onConsentChange()` if you need it.

## Quasar Dialog Integration

Your own Quasar dialog can be the preference centre: register it with the manager, and every way of opening the preference centre (the banner's "Customize", `showPreferenceCenter()`, [`requestConsent()`](/guide/preference-center#asking-again-when-a-feature-needs-a-category)) shows it.

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useQuasar } from 'quasar';
import { useConsent } from '@structured-world/vue-privacy/quasar';
import PreferencesDialog from './PreferencesDialog.vue';

const $q = useQuasar();
const { manager } = useConsent();
// What the dialog is asked for; a request joining the open dialog updates it
const request = ref(null);
let dialog = null;

onMounted(() => {
  manager.onShowPreferenceCenter(() => {
    request.value = manager.getConsentRequest();
    dialog ??= $q
      .dialog({ component: PreferencesDialog, componentProps: { request } })
      // Closed without a choice: the manager answers pending requests from the stored choice
      .onDismiss(() => {
        dialog = null;
        manager.hidePreferenceCenter();
      });
  });
  manager.onHidePreferenceCenter(() => {
    dialog?.hide();
    dialog = null;
  });
});

// The component that owns the dialog goes away: so does the registration
onUnmounted(() => {
  manager.onShowPreferenceCenter(null);
  manager.onHidePreferenceCenter(null);
});
</script>
```

`PreferencesDialog` receives the ref itself as its `request` prop and shows `request.value` (its `categories` and `reasons`), so a request that joins while it is open shows up at once. It loads its toggles from `getConsent()` once, when it is created, and offers every category the site uses, so a requested one can be granted. It saves with `savePreferences()`, `acceptAll()` or `rejectAll()`; each closes the dialog through the manager.

## Event Tracking

Track custom events, conversions, and ecommerce:

```vue
<script setup>
import { useConsent } from '@structured-world/vue-privacy/quasar';

const {
  trackEvent,
  trackPurchase,
  trackAddToCart,
  trackSignUp,
} = useConsent();

// Add to cart
function onAddToCart(product) {
  trackAddToCart({
    currency: 'USD',
    value: product.price,
    items: [{ item_id: product.sku, item_name: product.name, price: product.price }]
  });
}

// Purchase complete
function onCheckoutSuccess(order) {
  trackPurchase({
    transaction_id: order.id,
    currency: 'USD',
    value: order.total,
    shipping: order.shipping,
    items: order.items.map(i => ({
      item_id: i.sku,
      item_name: i.name,
      price: i.price,
      quantity: i.qty,
    }))
  });
}
</script>
```

See [Ecommerce Tracking](/guide/ecommerce) for the full guide.

## Route Meta Events

Define `ga4Event` in route meta to fire events automatically:

```typescript
// src/router/routes.ts
const routes = [
  {
    path: '/checkout/success',
    component: () => import('pages/CheckoutSuccess.vue'),
    meta: {
      ga4Title: 'Order Complete',
      ga4Event: { name: 'purchase_page_view' }
    }
  },
  {
    path: '/signup/complete',
    component: () => import('pages/SignupComplete.vue'),
    meta: {
      ga4Event: { name: 'sign_up', params: { method: 'email' } }
    }
  }
]
```

Events fire automatically when the user navigates to these routes.
