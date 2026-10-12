---
description: What Vue Privacy does not do. Script blocking covers marked scripts only, withdrawal cannot recall data already sent, region detection is an estimate, CCPA support is a building block, and compliance stays the site's responsibility.
---

# Limits

Vue Privacy controls what it manages: the Google tag it loads, the scripts you mark for it, and the consent record. This page lists what lies outside that, so the promises elsewhere in these docs are read for what they are.

## Compliance Is the Site's

The library gives you the mechanics: a banner where refusing is as easy as accepting, nothing pre-ticked, signals for Google Consent Mode v2, a stored record of the choice. Whether a site complies with the GDPR, the ePrivacy rules or a US state law also depends on what else the site loads, what its privacy notice says and how it uses the data. No library makes a site compliant by being installed.

## Only Marked Scripts Are Blocked

[Script blocking](/guide/script-blocking) holds back `<script type="text/plain" data-consent-category="…">` elements and nothing else. Scripts loaded without the marking, tracking pixels, iframes (embedded videos, maps) and requests your own code sends run as before: gate them yourself, with [`getConsent()`](/api/#getconsent-storedconsent-null) and `onConsentChange()`, or [`requestConsent()`](/guide/preference-center#asking-again-when-a-feature-needs-a-category) at the moment a feature needs a category.

## "Nothing Before Consent" Means Basic Mode

The default `consentMode: 'advanced'` loads the Google tag before the choice. Where consent is required (or the region lookup fails) every signal starts denied and the tag sends cookieless pings, as Google designs Consent Mode; a visitor found outside consent jurisdictions gets every category granted without a banner, and the tag measures in full. Only `consentMode: 'basic'` keeps the Google tag off the page until the visitor allows analytics. See [Basic and Advanced Mode](/guide/consent-mode#basic-and-advanced-mode).

## Withdrawal Stops Collection, It Does Not Recall It

In basic mode, withdrawing analytics switches the managed Google tag off and deletes its cookies; in advanced mode the tag stays and keeps sending cookieless pings with the signals denied. Data already sent stays with its recipient; a deletion request goes to them. A script already running cannot be unloaded from a page: one the library unblocked, or a Google Ads product linked to the same tag, runs until the page reloads. `reloadOnWithdrawal: true` reloads only when analytics is withdrawn while the managed Google tag runs; withdrawing another category leaves its unblocked scripts running until the site reloads the page itself.

## Region Detection Is an Estimate

Cloudflare headers, an IP lookup and the browser time zone give the visitor's likely country, not proof of where they are or which law applies. A VPN or a travelling visitor changes the answer. The IP API fallback sends the visitor's address to a third party (ipapi.co) before any choice; `geoDetection: 'always'` asks every visitor and needs no lookup at all. A failed lookup asks for consent by default.

## CCPA Support Is a Building Block

With `ccpaEnabled` set, `isCCPAUser()` tells you after region detection that a visitor is in a covered US state, and the "Do Not Sell" label comes from `doNotSellText` or the locale's translation. It needs the visitor's state, which only the Worker endpoint (`geoUrl`) and the IP API supply: Cloudflare headers and the time zone give a country only, and `geoDetection: 'always'` looks nothing up, so with those `isCCPAUser()` stays `false`. The site renders the link, honours the opt-out across its systems and covers what the state laws require beyond that; the list of covered states does not track every US privacy law.

## Remote Storage Syncs What You Link

The remote record is named by the `consent_uid` cookie, which belongs to one browser. To carry a choice to another device, the site has to give both devices the same ID, for example with `setConsentUid()` and the signed-in user's account ID. A choice is written to the record the cookie names at that moment, so an ID set after a sign-in takes effect with the next choice, without a reload. Where the page cannot read the cookie (a refusal on this page cleared it, or the route is outside `cookie.path`), the next choice updates the record the page wrote to or restored last, unless another tab has decided since without leaving a `consent_uid` (that decision may follow a reset there, so the choice starts a record of its own). Call `clearConsentUid()` on sign-out: the next choice, in that tab or in another one open on the same origin, then starts a record of its own instead of updating the account's. Other tabs learn of it through `BroadcastChannel`; where the browser does not offer one (Safari before 15.4) or refuses it (an opaque-origin frame), a tab that cannot read the cookie (after a refusal there, or on a route outside `cookie.path`) keeps the account's ID until it is reloaded, and its next choice updates the account's record. Reading the remote record happens only in `init()` and only where the consent cookie is missing: a device that already holds a local choice keeps it on load, and its next choice updates the shared record. Even then a remote record is restored only outside consent jurisdictions: it does not keep where the choice was made, so a visitor in the EEA or the UK is asked again on the new device.

## One Site, One Consent

A site has one consent and one `consent_uid`, shared by every page and tab of its origin. Several apps that need consents of their own (other categories, other accounts) are not separated by `cookie.path` or `cookie.name` on one origin: the browser sends one app's cookies to the other's pages wherever their paths nest, and a page cannot tell whose cookie it reads. Run such apps as separate sites, each on its own domain or subdomain with its own installation.

## Translations

The built-in strings exist in 31 languages and every locale has every key, which a test checks. Most translations have not been reviewed by native speakers, Irish and Maltese least of all: review the language your visitors read, and override any string through the `banner` and `preferenceCenter` options.
