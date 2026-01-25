# Vue Plugin API

## createConsentPlugin

Creates a Vue plugin for consent management.

```typescript
import { createConsentPlugin } from '@structured-world/consent/vue';

app.use(createConsentPlugin(options));
```

### Options

See [ConsentConfig](/api/types#consentconfig) for all options.

## useConsent

Composable for accessing consent state and methods.

```typescript
import { useConsent } from '@structured-world/consent/vue';

const {
  consent,
  isEU,
  hasConsent,
  acceptAll,
  rejectAll,
  resetConsent,
  savePreferences,
} = useConsent();
```

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `consent` | `Ref<StoredConsent \| null>` | Current consent state |
| `isEU` | `Ref<boolean>` | Whether user is in EU |
| `hasConsent` | `Ref<boolean>` | Whether user has given consent |
| `acceptAll` | `() => Promise<void>` | Accept all categories |
| `rejectAll` | `() => Promise<void>` | Reject non-essential |
| `resetConsent` | `() => void` | Clear consent and show banner |
| `savePreferences` | `(categories) => Promise<void>` | Save specific preferences |

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

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `'bottom' \| 'top' \| 'center'` | `'bottom'` | Banner position |
| `config` | `Partial<BannerConfig>` | `{}` | Override banner config |

### Events

| Event | Description |
|-------|-------------|
| `accept` | Emitted when user accepts all |
| `reject` | Emitted when user rejects |
| `customize` | Emitted when user clicks customize |

### Slots

The component uses Teleport to render at body level. No slots available.

## VitePress

### enhanceWithConsent

Enhance a VitePress theme with consent.

```typescript
import { enhanceWithConsent } from '@structured-world/consent/vitepress';

export default enhanceWithConsent(DefaultTheme, options);
```

## Quasar

### consentBoot

Create a Quasar boot function.

```typescript
import { consentBoot } from '@structured-world/consent/quasar';

export default boot(consentBoot(options));
```
