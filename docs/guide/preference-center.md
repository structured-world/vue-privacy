---
description: Build a cookie preference center for granular consent control. Let users choose analytics, marketing, and functional cookie categories.
---

# Cookie Preference Center

The preference center is a modal dialog that lets users choose which cookie categories to allow. It opens when the user clicks "Customize" on the consent banner.

## Basic Usage

### Vue 3

Add `ConsentPreferenceModal` to your app alongside the banner:

```vue
<template>
  <ConsentBanner />
  <ConsentPreferenceModal />
</template>
```

Both components are registered globally by `createConsentPlugin`.

### VitePress

If using `enhanceWithConsent`, add the modal to your layout:

```typescript
import { h } from 'vue';
import DefaultTheme from 'vitepress/theme';
import { enhanceWithConsent, ConsentBanner } from '@structured-world/vue-privacy/vitepress';
import { ConsentPreferenceModal } from '@structured-world/vue-privacy/vue';

const consentTheme = enhanceWithConsent(DefaultTheme, {
  gaId: 'G-XXXXXXXXXX',
});

export default {
  ...consentTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => [h(ConsentBanner), h(ConsentPreferenceModal)],
    });
  },
};
```

## Categories

The modal displays four cookie categories:

| Category | Default | User can toggle |
|----------|---------|-----------------|
| **Necessary** | Always on | No (disabled) |
| **Analytics** | Off | Yes |
| **Marketing** | Off | Yes |
| **Functional** | Off | Yes |

Every optional category starts unticked for a visitor who has not chosen: a pre-ticked box is not valid consent (CJEU, Planet49, C-673/17). Each category shows a name and description, translated to the user's locale.

### Only the categories your site uses

A site that runs analytics only should not offer a "Marketing" toggle that controls nothing. List the optional categories the site uses:

```typescript
createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  usedCategories: ['analytics'],
});
```

The preference centre then shows "Necessary" and "Analytics" only. Every other category is always refused: "Accept all", saved preferences, the grant implied outside consent jurisdictions and a consent stored earlier never turn it on, so its Google signals (`ad_storage`, `ad_user_data`, `ad_personalization` for marketing) stay `denied`. Turning analytics off later is then a full refusal: it is stored like any other choice, replaces the earlier grant and clears `consent_uid`.

The footer offers "Reject all" beside "Accept all", styled the same: refusing every optional category takes one click, as accepting does. "Save preferences" stores the toggles as set.

## Opening Programmatically

Use the `useConsent` composable:

```vue
<script setup>
import { useConsent } from '@structured-world/vue-privacy/vue';

const { showPreferenceCenter } = useConsent();
</script>

<template>
  <button @click="showPreferenceCenter">Cookie Settings</button>
</template>
```

Or via the core API:

```typescript
const manager = createConsentManager({ gaId: 'G-XXX' });
await manager.init();
manager.showPreferenceCenter();
```

## Asking Again When a Feature Needs a Category

A refusal is stored for the consent cookie's lifetime, so the banner does not ask on every page. A feature that cannot work without a refused category asks again at the moment it is needed, and says why, with `requestConsent(category, { reason })`:

```vue
<script setup>
import { useConsent } from '@structured-world/vue-privacy/vue';

const { requestConsent } = useConsent();

async function signIn() {
  const allowed = await requestConsent('functional', {
    reason: 'Sign-in needs functional cookies to keep you logged in.',
  });
  if (!allowed) return; // the visitor kept the refusal: stay signed out
  // ...sign in
}
</script>
```

- A category already in effect (granted by the visitor, or outside consent jurisdictions) answers `true` at once and shows nothing.
- Otherwise the preference centre opens with the reason above the categories and the requested category highlighted, never pre-ticked. The promise answers whether the category is granted after the visitor's choice, which is stored like any other; closing the dialog answers `false` and keeps the stored refusal.
- A call while the preference centre is open joins it instead of opening a second one; every caller gets its own answer.
- The reason is your own text, in the visitor's language; the library translates its buttons only.
- A category outside `usedCategories` is refused by every choice, so the call rejects.
- A call made before `init()` settled the consent waits for it: a stored grant counts only once the roaming check has confirmed it. The preference centre then waits for its component, as the banner does, if none is mounted yet; a dialog removed while open (unmounted, destroyed) answers its callers from the choice in effect, and after `destroy()` the call answers `false`.

Without Vue, the same method is on the manager: `await manager.requestConsent('functional', { reason })`. A custom preference centre reads what is asked with `manager.getConsentRequest()` when it is shown, and closes through `manager.hidePreferenceCenter()` so the pending callers get their answer.

## Customizing Text

Override preference center text via config:

```typescript
createConsentPlugin({
  preferenceCenter: {
    title: 'Cookie Preferences',
    description: 'Choose which cookies you want to allow.',
    savePreferences: 'Save My Choices',
    acceptAll: 'Accept Everything',
    rejectAll: 'Refuse Everything',
    categories: {
      analytics: {
        name: 'Performance Cookies',
        description: 'Help us understand how visitors use our site.',
      },
      marketing: {
        name: 'Advertising Cookies',
        description: 'Used to show relevant ads.',
      },
    },
  },
});
```

Text not explicitly overridden falls back to the built-in i18n translations for the active locale.

## Accessibility

The preference center includes:

- `role="dialog"` and `aria-modal="true"`
- `aria-labelledby` pointing to the modal title
- `aria-label` on all toggle checkboxes
- Focus trap (Tab cycles within the modal)
- Focus moves to the modal container on open
- Escape key closes the modal

## Callbacks

```typescript
createConsentPlugin({
  onPreferenceCenterShow: () => console.log('Preference center opened'),
  onPreferenceCenterHide: () => console.log('Preference center closed'),
});
```

## Styling

The modal uses CSS-in-JS (auto-injected, SSR-safe). It supports:

- Dark mode via `prefers-color-scheme`, or a palette pinned with `theme` (see [Customization](/guide/customization#dark-mode))
- Mobile-responsive layout (full-width on small screens)
- CSS custom properties for theming (same as banner)
