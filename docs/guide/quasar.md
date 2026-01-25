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
