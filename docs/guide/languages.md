---
description: Cookie consent banner in 31 languages for Vue 3, Nuxt, VitePress and Quasar. Every official EU language plus Norwegian, Icelandic, Japanese, Korean, Russian, Ukrainian and Chinese, chosen from the browser's languages, with a language switcher API.
---

# Languages

The consent banner and the preference centre speak the visitor's language: 31 locales are built in, and the first of the visitor's preferred browser languages that the site offers is chosen automatically.

## Built-in Locales

| Code | Language | Code | Language | Code | Language |
|------|----------|------|----------|------|----------|
| `bg` | Bulgarian | `hr` | Croatian | `nl` | Dutch |
| `cs` | Czech | `hu` | Hungarian | `pl` | Polish |
| `da` | Danish | `is` | Icelandic | `pt` | Portuguese |
| `de` | German | `it` | Italian | `ro` | Romanian |
| `el` | Greek | `ja` | Japanese | `ru` | Russian |
| `en` | English | `ko` | Korean | `sk` | Slovak |
| `es` | Spanish | `lt` | Lithuanian | `sl` | Slovenian |
| `et` | Estonian | `lv` | Latvian | `sv` | Swedish |
| `fi` | Finnish | `mt` | Maltese | `uk` | Ukrainian |
| `fr` | French | `nb` | Norwegian (Bokmål) | `zh` | Chinese |
| `ga` | Irish | | | | |

They cover every official language of the EU, the EEA's Norwegian and Icelandic, and Japanese, Korean, Russian, Ukrainian and Chinese. The "Do Not Sell My Personal Information" text for [CCPA](/guide/consent-jurisdictions) stays English in every locale, as the phrase the law uses.

## How the Language Is Chosen

1. `locale`, when the site sets it, is shown as given.
2. Otherwise the browser's preferred languages (`navigator.languages`, most preferred first) are read in order, and the first one with an offered locale wins. A regional tag resolves to its language (`ro-MD` to `ro`, `sv-FI` to `sv`), and Norwegian `no` and Nynorsk `nn` read Bokmål (`nb`).
3. A visitor who reads none of the offered languages gets `fallbackLocale`: English by default when it is offered, else the first of `locales`.

## Offering Only Your Site's Languages

A site in Romanian, English and Hungarian should not greet a German reader in German. List the locales it offers, and the one shown to everyone else:

```typescript
createConsentPlugin({
  locales: ['ro', 'en', 'hu'], // detection picks only among these
  fallbackLocale: 'ro', // default: 'en' when offered, else the first of locales
});
```

To show one language to everyone:

```typescript
createConsentPlugin({
  locale: 'de',
});
```

## Switching Language at Runtime

When the visitor changes language on your site, pass the new language to the manager. The banner and the preference centre (Vue and vanilla) re-render in it, within `locales`:

```typescript
consentManager.setLocale('ro-MD'); // returns 'ro', the locale now shown
consentManager.getLocale(); // 'ro'
```

A custom dialog follows the switch with `onLocaleChange()`, which returns a function that stops it (see [Your Own Text](#your-own-text) for an example).

The site keeps the visitor's language choice itself (its route or its own setting) and passes it again on the next page load, as `locale` or through `setLocale()`. The manager stores no language of its own, so it never disagrees with the page.

## Your Own Text

Text you set in `banner` or `preferenceCenter` replaces the built-in translation in every language; the rest stays translated. A site shown in one language sets it in that language:

```typescript
createConsentPlugin({
  locale: 'ro',
  banner: { title: 'Cookie-uri pe acest site' },
});
```

A custom banner or dialog renders the text itself: `getTranslations(locale)` gives a built-in locale, and `mergeTranslations()` changes part of it, for every language the visitor switches to:

```typescript
import { mergeTranslations } from '@structured-world/vue-privacy';

function render(locale) {
  const t = mergeTranslations(locale, { banner: { title: 'Cookies' } });
  titleElement.textContent = t.banner.title; // and the rest of t.banner, t.preferenceCenter
}

render(consentManager.getLocale());
consentManager.onLocaleChange(render);
```

The reason a feature gives with [`requestConsent()`](/guide/preference-center#asking-again-when-a-feature-needs-a-category) is your own text too, in the visitor's language.
