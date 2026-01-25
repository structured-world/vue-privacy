# Introduction

**@structured-world/vue-privacy** is a privacy-first consent and analytics library with full Google Consent Mode v2 support for Vue 3, Nuxt 3, VitePress, and Quasar applications.

## Why This Library?

Since March 2024, Google requires **Consent Mode v2** for all websites using Google Analytics or Google Ads in the EU. This library makes it easy to:

- Show a consent banner only to EU users
- Properly configure Google Consent Mode v2 signals
- Integrate with Vue 3 ecosystem frameworks

## Key Features

### Google Consent Mode v2

Full support for all four consent signals:

- `analytics_storage` - Controls Google Analytics cookies
- `ad_storage` - Controls advertising cookies
- `ad_user_data` - Controls sending user data to Google for ads
- `ad_personalization` - Controls personalized advertising

### EU Detection

Multiple detection methods with automatic fallback:

1. **Cloudflare Headers** - Fastest, requires Cloudflare setup
2. **IP API** - Fallback using ipapi.co
3. **Timezone Heuristics** - Last resort based on browser timezone

### Framework Agnostic Core

The core library works without any framework. Vue 3 integration provides:

- Vue plugin with dependency injection
- `useConsent()` composable
- `<ConsentBanner>` component

## Quick Example

```typescript
import { createApp } from 'vue';
import { createConsentPlugin, ConsentBanner } from '@structured-world/vue-privacy/vue';

const app = createApp(App);

app.use(createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  euDetection: 'auto',
}));

app.mount('#app');
```

```vue
<template>
  <ConsentBanner position="bottom" />
</template>
```

## Next Steps

- [Installation](/guide/installation) - Install the package
- [Quick Start](/guide/quick-start) - Get up and running
- [Vue Integration](/guide/vue) - Detailed Vue 3 guide
