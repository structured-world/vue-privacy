---
description: Vue 3 cookie consent plugin API reference. createConsentPlugin, the useConsent composable, the ConsentBanner and ConsentPreferenceModal components, and the VitePress and Quasar integrations.
---

# Vue Plugin API Reference

## createConsentPlugin

Creates a Vue plugin for consent management.

```typescript
import { createConsentPlugin } from "@structured-world/vue-privacy/vue";

app.use(createConsentPlugin(options));
```

### Options

See [ConsentConfig](/api/types#consentconfig) for all options.

## useConsent

Composable for accessing consent state and methods.

```typescript
import { useConsent } from "@structured-world/vue-privacy/vue";

const {
  getConsent,
  isConsentRequired,
  hasConsent,
  acceptAll,
  rejectAll,
  resetConsent,
  savePreferences,
} = useConsent();
```

### Returns

Each member calls the [manager method](/api/) of the same name.

| Property | Type | Description |
| -------- | ---- | ----------- |
| `getConsent` | `() => StoredConsent \| null` | The visitor's choice, or `null` while undecided |
| `hasConsent` | `() => boolean` | Whether the visitor has chosen (a grant or a refusal) |
| `acceptAll` | `() => Promise<void>` | Accept every category |
| `rejectAll` | `() => Promise<void>` | Refuse every optional category |
| `savePreferences` | `(categories) => Promise<void>` | Save a choice; a category not given is refused |
| `resetConsent` | `() => void` | Forget the choice and show the banner again |
| `showPreferenceCenter` | `() => void` | Open the preference centre |
| `requestConsent` | `(category, { reason }?) => Promise<boolean>` | Ask again for a category a feature needs; resolves whether it is granted |
| `isConsentRequired` | `() => boolean \| null` | Whether the visitor is in a consent jurisdiction |
| `isCCPAUser` | `() => boolean` | Whether the visitor is in a CCPA-covered US state (`ccpaEnabled`) |
| `getRegion` | `() => string \| undefined` | Detected region or US state |
| `getGeoResult` | `() => GeoDetectionResult \| null` | The region lookup's result |
| `trackPageView` | `(path, title?) => void` | Track a page view (SPA navigation) |
| `trackEvent` | `(name, params?) => void` | Track a GA4 event |
| `trackPurchase`, `trackAddToCart`, `trackBeginCheckout`, `trackViewItem`, `trackViewItemList`, `trackSelectItem`, `trackAddShippingInfo`, `trackAddPaymentInfo`, `trackSignUp`, `trackLogin`, `trackGenerateLead` | | GA4 recommended events ([Ecommerce Tracking](/guide/ecommerce)) |
| `manager` | `ConsentManager` | The manager itself, e.g. for `setLocale()` and the dialog callbacks |

## ConsentPreferenceModal

The built-in preference centre. It opens through the manager (the banner's "Customize", `showPreferenceCenter()`, `requestConsent()`) and shows the categories in `usedCategories`, unticked for an undecided visitor.

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `theme` | `'auto' \| 'light' \| 'dark'` | the manager's `theme`, else `'auto'` | Colour palette |

| Event | Payload | Description |
| ----- | ------- | ----------- |
| `save` | the saved categories | Emitted after "Save preferences" |
| `close` | | Emitted on accept all, reject all, or closing without a choice |

## ConsentBanner

Vue component for the consent banner.

```vue
<ConsentBanner
  position="bottom"
  :config="{ title: 'Custom' }"
  @accept="onAccept"
  @reject="onReject"
  @customize="onCustomize"
/>
```

### Props

| Prop       | Type                            | Default    | Description            |
| ---------- | ------------------------------- | ---------- | ---------------------- |
| `position` | `'bottom' \| 'top' \| 'center'` | `'bottom'` | Banner position        |
| `config`   | `Partial<BannerConfig>`         | `{}`       | Override banner config |
| `theme`    | `'auto' \| 'light' \| 'dark'`   | the manager's `theme`, else `'auto'` | Colour palette |

### Events

| Event       | Description                        |
| ----------- | ---------------------------------- |
| `accept`    | Emitted when user accepts all      |
| `reject`    | Emitted when user rejects          |
| `customize` | Emitted when user clicks customize |

### Slots

The component uses Teleport to render at body level. No slots available.

## VitePress

### enhanceWithConsent

Enhance a VitePress theme with consent.

```typescript
import { enhanceWithConsent } from "@structured-world/vue-privacy/vitepress";

export default enhanceWithConsent(DefaultTheme, options);
```

## Quasar

### consentBoot

Create a Quasar boot function.

```typescript
import { consentBoot } from "@structured-world/vue-privacy/quasar";

export default boot(consentBoot(options));
```
