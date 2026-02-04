# Quasar Integration

## Boot File (Recommended)

Create a boot file for consent:

```typescript
// src/boot/consent.ts
import { boot } from 'quasar/wrappers';
import { consentBoot } from '@structured-world/vue-privacy/quasar';

export default boot(consentBoot({
  gaId: 'G-XXXXXXXXXX',
  euDetection: 'auto',
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

const { hasConsent, resetConsent } = useConsent();
</script>

<template>
  <q-btn
    v-if="hasConsent"
    label="Cookie Settings"
    @click="resetConsent"
  />
</template>
```

## Quasar Dialog Integration

Show preferences in a Quasar dialog:

```vue
<script setup>
import { useQuasar } from 'quasar';
import { useConsent } from '@structured-world/vue-privacy/quasar';
import PreferencesDialog from './PreferencesDialog.vue';

const $q = useQuasar();
const { resetConsent } = useConsent();

function showPreferences() {
  resetConsent(); // Clear stored consent
  $q.dialog({
    component: PreferencesDialog,
  });
}
</script>
```

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
