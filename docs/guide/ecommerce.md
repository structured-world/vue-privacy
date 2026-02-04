# Ecommerce Tracking

Complete guide to setting up GA4 ecommerce tracking with vue-privacy.

## Overview

vue-privacy provides typed helpers for common GA4 ecommerce events. Events automatically respect user consent — nothing is sent if analytics consent is denied.

**Supported events:** `view_item`, `view_item_list`, `select_item`, `add_to_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`.

**References:**
- [GA4 Recommended Events](https://developers.google.com/analytics/devguides/collection/ga4/reference/events)
- [GA4 Ecommerce Guide](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce)

## Quick Start

### 1. Install & Configure

```typescript
import { createConsentManager } from '@structured-world/vue-privacy';

const manager = createConsentManager({
  gaId: 'G-XXXXXXXXXX',
  euDetection: 'auto',
});

await manager.init();
```

### 2. Track Events

```typescript
// View product
manager.trackViewItem({
  currency: 'USD',
  value: 29.99,
  items: [{
    item_id: 'SKU_123',
    item_name: 'Awesome T-Shirt',
    price: 29.99,
    quantity: 1,
  }]
});

// Add to cart
manager.trackAddToCart({
  currency: 'USD',
  value: 29.99,
  items: [{ item_id: 'SKU_123', item_name: 'Awesome T-Shirt', price: 29.99, quantity: 1 }]
});

// Begin checkout
manager.trackBeginCheckout({
  currency: 'USD',
  value: 29.99,
  coupon: 'SUMMER10',
  items: [{ item_id: 'SKU_123', item_name: 'Awesome T-Shirt', price: 29.99, quantity: 1 }]
});

// Complete purchase
manager.trackPurchase({
  transaction_id: 'ORDER_12345',
  currency: 'USD',
  value: 35.98,
  shipping: 5.99,
  tax: 0,
  items: [{ item_id: 'SKU_123', item_name: 'Awesome T-Shirt', price: 29.99, quantity: 1 }]
});
```

## Available Methods

### Ecommerce Events

| Method | GA4 Event | Use Case |
|--------|-----------|----------|
| `trackViewItem(params)` | `view_item` | Product detail page |
| `trackViewItemList(params)` | `view_item_list` | Category/search results page |
| `trackSelectItem(params)` | `select_item` | Click on product in list |
| `trackAddToCart(params)` | `add_to_cart` | Add item to cart |
| `trackBeginCheckout(params)` | `begin_checkout` | Start checkout |
| `trackAddShippingInfo(params)` | `add_shipping_info` | Enter shipping details |
| `trackAddPaymentInfo(params)` | `add_payment_info` | Enter payment details |
| `trackPurchase(params)` | `purchase` | Complete order |

### Lead & Registration Events

| Method | GA4 Event | Use Case |
|--------|-----------|----------|
| `trackSignUp(method?)` | `sign_up` | User registration |
| `trackLogin(method?)` | `login` | User login |
| `trackGenerateLead(params?)` | `generate_lead` | Contact form, newsletter |

### Generic Event

```typescript
// For any GA4 event not covered by helpers
manager.trackEvent('share', {
  method: 'twitter',
  content_type: 'product',
  item_id: 'SKU_123',
});
```

## Event Parameters

### GA4Item (Product)

Simplified view of common fields. See [API Types](/api/types#ga4item) for full interface.

```typescript
interface GA4Item {
  item_id?: string;     // Required if item_name not provided
  item_name?: string;   // Required if item_id not provided
  price?: number;       // Unit price
  quantity?: number;    // Quantity (default: 1)
  item_brand?: string;
  item_category?: string;
  item_category2?: string;  // Up to 5 category levels
  item_variant?: string;    // Size, color, etc.
  coupon?: string;
  discount?: number;
  index?: number;           // Position in list
  item_list_id?: string;
  item_list_name?: string;
  affiliation?: string;     // Affiliate/partner name
  location_id?: string;     // Google Business location ID
}
```

### GA4EcommerceParams

```typescript
interface GA4EcommerceParams {
  currency: string;  // Required: ISO 4217 (e.g., 'USD', 'EUR')
  value: number;     // Required: Total value
  items: GA4Item[];  // Required: Array of products
  coupon?: string;   // Coupon code
}
```

### GA4PurchaseParams

```typescript
interface GA4PurchaseParams extends GA4EcommerceParams {
  transaction_id: string;  // Required: Unique order ID
  shipping?: number;       // Shipping cost
  tax?: number;            // Tax amount
  customer_type?: 'new' | 'returning';
}
```

## Full Ecommerce Funnel

### 1. Product List Page

```typescript
// When user views a category or search results
manager.trackViewItemList({
  currency: 'USD',
  item_list_id: 'category_shirts',
  item_list_name: 'T-Shirts',
  items: products.map((p, index) => ({
    item_id: p.sku,
    item_name: p.name,
    price: p.price,
    index,
    item_category: 'Apparel',
    item_category2: 'T-Shirts',
  }))
});
```

### 2. Product Click

```typescript
// When user clicks a product in the list
manager.trackSelectItem({
  currency: 'USD',
  item_list_id: 'category_shirts',
  item_list_name: 'T-Shirts',
  items: [{
    item_id: product.sku,
    item_name: product.name,
    price: product.price,
    index: productIndex,
  }]
});
```

### 3. Product Detail Page

```typescript
manager.trackViewItem({
  currency: 'USD',
  value: product.price,
  items: [{
    item_id: product.sku,
    item_name: product.name,
    price: product.price,
    item_brand: product.brand,
    item_category: product.category,
    item_variant: selectedVariant,
  }]
});
```

### 4. Add to Cart

```typescript
manager.trackAddToCart({
  currency: 'USD',
  value: product.price * quantity,
  items: [{
    item_id: product.sku,
    item_name: product.name,
    price: product.price,
    quantity,
  }]
});
```

### 5. View Cart

```typescript
manager.trackEvent('view_cart', {
  currency: 'USD',
  value: cart.total,
  items: cart.items.map(item => ({
    item_id: item.sku,
    item_name: item.name,
    price: item.price,
    quantity: item.quantity,
  }))
});
```

### 6. Begin Checkout

```typescript
manager.trackBeginCheckout({
  currency: 'USD',
  value: cart.total,
  coupon: cart.couponCode,
  items: cart.items.map(item => ({
    item_id: item.sku,
    item_name: item.name,
    price: item.price,
    quantity: item.quantity,
  }))
});
```

### 7. Add Shipping Info

```typescript
manager.trackAddShippingInfo({
  currency: 'USD',
  value: cart.total,
  shipping_tier: shippingMethod, // 'Ground', 'Express', etc.
  items: cart.items.map(item => ({
    item_id: item.sku,
    item_name: item.name,
    price: item.price,
    quantity: item.quantity,
  }))
});
```

### 8. Add Payment Info

```typescript
manager.trackAddPaymentInfo({
  currency: 'USD',
  value: cart.total,
  payment_type: paymentMethod, // 'Credit Card', 'PayPal', etc.
  items: cart.items.map(item => ({
    item_id: item.sku,
    item_name: item.name,
    price: item.price,
    quantity: item.quantity,
  }))
});
```

### 9. Purchase Complete

```typescript
manager.trackPurchase({
  transaction_id: order.id,
  currency: 'USD',
  value: order.total,
  shipping: order.shippingCost,
  tax: order.tax,
  coupon: order.couponCode,
  customer_type: user.isFirstPurchase ? 'new' : 'returning',
  items: order.items.map(item => ({
    item_id: item.sku,
    item_name: item.name,
    price: item.price,
    quantity: item.quantity,
    item_brand: item.brand,
    item_category: item.category,
  }))
});
```

## Vue Router Integration

### Static Events (Route Meta)

For pages where visiting the page = conversion:

```typescript
// router/index.ts
const routes = [
  {
    path: '/signup/complete',
    component: SignupComplete,
    meta: {
      ga4Title: 'Registration Complete',
      ga4Event: { name: 'sign_up', params: { method: 'email' } }
    }
  },
  {
    path: '/contact/thank-you',
    component: ThankYou,
    meta: {
      ga4Event: { name: 'generate_lead' }
    }
  }
]
```

### Dynamic Events (Programmatic)

For events with runtime data (order totals, transaction IDs):

```vue
<script setup lang="ts">
import { useConsent } from '@structured-world/vue-privacy/vue';
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';

const { trackPurchase } = useConsent();
const route = useRoute();

onMounted(async () => {
  // Fetch order from API
  const order = await fetchOrder(route.params.orderId);

  // Track with actual data
  trackPurchase({
    transaction_id: order.id,
    currency: order.currency,
    value: order.total,
    shipping: order.shipping,
    tax: order.tax,
    items: order.items.map(item => ({
      item_id: item.sku,
      item_name: item.name,
      price: item.price,
      quantity: item.quantity,
    }))
  });
});
</script>
```

## Setting Up Conversions in GA4

After sending events, mark them as conversions:

1. Go to **GA4 Admin** → **Events**
2. Find your event (appears after first trigger)
3. Toggle **"Mark as conversion"**

### Recommended Conversions

| Event | When to Use |
|-------|-------------|
| `purchase` | Completed order (most important) |
| `sign_up` | New user registration |
| `generate_lead` | Contact/quote form submission |
| `begin_checkout` | Started checkout (micro-conversion) |
| `add_to_cart` | Added item to cart (engagement signal) |

## Consent & Ecommerce

Events automatically respect user consent:

| Consent State | Behavior |
|--------------|----------|
| `analytics: true` | All GA4 events sent normally |
| `analytics: false` | No events sent (GDPR compliant) |
| `marketing: true` | Enables Google Ads conversion tracking |

If a user rejects analytics consent, no ecommerce events are tracked. This is intentional and GDPR-compliant.

## Debugging

### GA4 DebugView

1. Install [GA Debugger Chrome extension](https://chrome.google.com/webstore/detail/ga-debugger)
2. Enable it on your site
3. Go to GA4 → Admin → DebugView
4. Trigger events on your site
5. See real-time event stream with parameters

### Console Logging

```typescript
const manager = createConsentManager({
  gaId: 'G-XXX',
  onConsentChange: (consent) => {
    console.log('[vue-privacy] Consent:', consent);
  }
});

// After init, check if events are being sent
manager.trackEvent('test_event', { test: true });
```

### Browser DevTools

Open Network tab, filter by `collect?`, and see GA4 requests. Each request shows event name and parameters.

## Common Mistakes

### Don't hardcode transaction_id

```typescript
// ❌ BAD - same ID for every order
trackPurchase({ transaction_id: '12345', ... });

// ✅ GOOD - unique ID per order
trackPurchase({ transaction_id: order.id, ... });
```

### Don't forget currency

```typescript
// ❌ BAD - value without currency is meaningless
trackPurchase({ value: 99.99, ... });

// ✅ GOOD - always include currency
trackPurchase({ currency: 'USD', value: 99.99, ... });
```

### Don't track duplicate purchases

```typescript
// ✅ Prevent duplicate tracking
const trackedOrders = new Set<string>();

function trackOrderOnce(order: Order) {
  if (trackedOrders.has(order.id)) return;
  trackedOrders.add(order.id);

  manager.trackPurchase({
    transaction_id: order.id,
    // ...
  });
}
```

### Don't send item_id without item_name

```typescript
// ✅ GOOD - has item_id (item_name optional)
items: [{ item_id: 'SKU_123', price: 29.99 }]

// ✅ GOOD - has item_name (item_id optional)
items: [{ item_name: 'T-Shirt', price: 29.99 }]

// ✅ BEST - both provided for better reporting
items: [{ item_id: 'SKU_123', item_name: 'T-Shirt', price: 29.99 }]

// ❌ BAD - neither item_id nor item_name
items: [{ price: 29.99 }]
```

## CDN/UMD Usage

For non-Vue sites:

```html
<script src="https://unpkg.com/@structured-world/vue-privacy"></script>
<script>
const manager = VuePrivacy.createConsentManager({
  gaId: 'G-XXXXXXXXXX',
});

manager.init().then(() => {
  // Track purchase
  manager.trackPurchase({
    transaction_id: '12345',
    currency: 'USD',
    value: 99.99,
    items: [{ item_id: 'PROD_1', item_name: 'Widget', price: 99.99, quantity: 1 }]
  });
});
</script>
```

## TypeScript Support

All methods are fully typed. Import types for custom implementations:

```typescript
import type {
  GA4Item,
  GA4EcommerceParams,
  GA4PurchaseParams,
  GA4GenerateLeadParams,
  GA4RouteMeta,
} from '@structured-world/vue-privacy';
```
