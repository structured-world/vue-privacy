# Vue 3 Integration

## Plugin Setup

```typescript
import { createApp } from 'vue';
import { createConsentPlugin } from '@structured-world/consent/vue';

const app = createApp(App);

app.use(createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  euDetection: 'auto',
  banner: {
    title: 'Cookie Settings',
    message: 'We use cookies to improve your experience.',
  },
  onConsentChange: (consent) => {
    console.log('Consent updated:', consent);
  },
}));
```

## ConsentBanner Component

```vue
<script setup>
import { ConsentBanner } from '@structured-world/consent/vue';
</script>

<template>
  <ConsentBanner
    position="bottom"
    :config="{ title: 'Custom Title' }"
    @accept="onAccept"
    @reject="onReject"
    @customize="onCustomize"
  />
</template>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `'bottom' \| 'top' \| 'center'` | `'bottom'` | Banner position |
| `config` | `Partial<BannerConfig>` | `{}` | Override banner text |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `accept` | - | User clicked Accept All |
| `reject` | - | User clicked Reject All |
| `customize` | - | User clicked Customize |

## useConsent Composable

```vue
<script setup>
import { useConsent } from '@structured-world/consent/vue';

const {
  consent,        // Ref<StoredConsent | null>
  isEU,           // Ref<boolean>
  hasConsent,     // Ref<boolean>
  acceptAll,      // () => Promise<void>
  rejectAll,      // () => Promise<void>
  resetConsent,   // () => void
  savePreferences // (categories) => Promise<void>
} = useConsent();
</script>

<template>
  <div v-if="hasConsent">
    <p>Analytics: {{ consent?.categories.analytics ? 'Yes' : 'No' }}</p>
    <button @click="resetConsent">Manage Cookies</button>
  </div>
</template>
```

## Custom Preferences UI

Build your own preferences modal:

```vue
<script setup>
import { ref } from 'vue';
import { useConsent } from '@structured-world/consent/vue';

const { savePreferences, consent } = useConsent();

const analytics = ref(consent.value?.categories.analytics ?? false);
const marketing = ref(consent.value?.categories.marketing ?? false);

async function save() {
  await savePreferences({
    analytics: analytics.value,
    marketing: marketing.value,
    functional: true,
  });
}
</script>

<template>
  <div class="preferences-modal">
    <label>
      <input type="checkbox" v-model="analytics" />
      Analytics Cookies
    </label>
    <label>
      <input type="checkbox" v-model="marketing" />
      Marketing Cookies
    </label>
    <button @click="save">Save Preferences</button>
  </div>
</template>
```
