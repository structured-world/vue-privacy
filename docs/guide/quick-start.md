# Quick Start

## Vue 3

### 1. Install the Plugin

```typescript
// main.ts
import { createApp } from 'vue';
import { createConsentPlugin } from '@structured-world/consent/vue';
import App from './App.vue';

const app = createApp(App);

app.use(createConsentPlugin({
  gaId: 'G-XXXXXXXXXX', // Your GA4 measurement ID
  euDetection: 'auto',
}));

app.mount('#app');
```

### 2. Add the Banner

```vue
<!-- App.vue -->
<script setup>
import { ConsentBanner } from '@structured-world/consent/vue';
</script>

<template>
  <div id="app">
    <!-- Your app content -->
    <ConsentBanner position="bottom" />
  </div>
</template>
```

That's it! The banner will automatically show for EU users who haven't given consent.

## VitePress

```typescript
// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import { enhanceWithConsent } from '@structured-world/consent/vitepress';

export default enhanceWithConsent(DefaultTheme, {
  gaId: 'G-XXXXXXXXXX',
});
```

## Quasar

```typescript
// src/boot/consent.ts
import { boot } from 'quasar/wrappers';
import { consentBoot } from '@structured-world/consent/quasar';

export default boot(consentBoot({
  gaId: 'G-XXXXXXXXXX',
}));
```

Don't forget to add the boot file to `quasar.config.js`:

```javascript
boot: ['consent'],
```

## Framework-Agnostic

```typescript
import { createConsentManager } from '@structured-world/consent';

const manager = createConsentManager({
  gaId: 'G-XXXXXXXXXX',
  euDetection: 'auto',
});

// Initialize (shows banner for EU users)
await manager.init();

// Programmatic consent
await manager.acceptAll();
await manager.rejectAll();
```

## What Happens

1. **EU Detection** - The library checks if the user is in the EU
2. **Consent Defaults** - Google Consent Mode is initialized with `denied` defaults
3. **Banner Display** - If no consent stored, banner shows for EU users
4. **User Choice** - User accepts/rejects, consent stored in cookie
5. **Google Update** - Consent Mode signals updated to `granted`/`denied`

Non-EU users automatically get consent granted without seeing the banner.
