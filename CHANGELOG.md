## [1.11.0](https://github.com/structured-world/vue-privacy/compare/v1.10.1...v1.11.0) (2026-10-07)

### Features

* **consent:** add basic consent mode ([#221](https://github.com/structured-world/vue-privacy/issues/221)) ([1b54d22](https://github.com/structured-world/vue-privacy/commit/1b54d22e462290bcde9a791c00fa4f678e745354)), closes [#199](https://github.com/structured-world/vue-privacy/issues/199)

## [2.0.0](https://github.com/structured-world/vue-privacy/compare/v1.11.0...v2.0.0) (2026-10-10)


### ⚠ BREAKING CHANGES

* the euDetection option is renamed geoDetection, and isEUUser() is removed (use isConsentRequired()).
* **consent:** the categories option and DEFAULT_CONFIG.categories are removed; savePreferences() refuses and unblockScriptsByCategory() keeps blocked a category they are not given (both granted functional before).

### Features

* **consent:** ask again for a refused category; optional categories start unticked ([#236](https://github.com/structured-world/vue-privacy/issues/236)) ([6d8d8fe](https://github.com/structured-world/vue-privacy/commit/6d8d8fed6cf18a73415d6e39653253560abe6673)), closes [#213](https://github.com/structured-world/vue-privacy/issues/213) [#233](https://github.com/structured-world/vue-privacy/issues/233)
* **consent:** offer and grant only the categories a site uses ([#226](https://github.com/structured-world/vue-privacy/issues/226)) ([78be812](https://github.com/structured-world/vue-privacy/commit/78be81265f0dc61420a1e3586ed158f25f9b4278)), closes [#200](https://github.com/structured-world/vue-privacy/issues/200)
* **ga:** pass Google Analytics config and set fields through ([#227](https://github.com/structured-world/vue-privacy/issues/227)) ([26207b3](https://github.com/structured-world/vue-privacy/commit/26207b363ef51c0b978234907b5c3ede103a9276)), closes [#198](https://github.com/structured-world/vue-privacy/issues/198)
* **i18n:** locales for every EU and EEA language, and language switching ([#230](https://github.com/structured-world/vue-privacy/issues/230)) ([341237c](https://github.com/structured-world/vue-privacy/commit/341237c8bac3218f190ce7d3d15b396d3f8a3386)), closes [#204](https://github.com/structured-world/vue-privacy/issues/204)
* **ui:** make refusing consent as easy and visible as accepting ([#225](https://github.com/structured-world/vue-privacy/issues/225)) ([7b74c64](https://github.com/structured-world/vue-privacy/commit/7b74c64e3ded5cf29e1690b31d03502f9c5ee581)), closes [#201](https://github.com/structured-world/vue-privacy/issues/201)
* **ui:** theme option to pin the consent dialog palette ([#231](https://github.com/structured-world/vue-privacy/issues/231)) ([d68e02a](https://github.com/structured-world/vue-privacy/commit/d68e02aa4c404c585b4d66f75bec52486b24f04f)), closes [#202](https://github.com/structured-world/vue-privacy/issues/202)


### Bug Fixes

* **consent:** reload for a previous manager's tag after a restored refusal ([#223](https://github.com/structured-world/vue-privacy/issues/223)) ([dc01943](https://github.com/structured-world/vue-privacy/commit/dc0194392f4f9d844662fa8e2fcbc32acb94caed)), closes [#222](https://github.com/structured-world/vue-privacy/issues/222)
* **geo:** require consent across the EEA and the UK, and on lookup failure ([#228](https://github.com/structured-world/vue-privacy/issues/228)) ([fcfe2a5](https://github.com/structured-world/vue-privacy/commit/fcfe2a5f9e395b4cf6a6ab97c57e8c7000af102e)), closes [#203](https://github.com/structured-world/vue-privacy/issues/203) [#229](https://github.com/structured-world/vue-privacy/issues/229)


### Refactoring

* name region detection after consent jurisdictions; bring the docs up to date ([#237](https://github.com/structured-world/vue-privacy/issues/237)) ([422bf3f](https://github.com/structured-world/vue-privacy/commit/422bf3f398dcf3458a775f27ab24c911779a6c08)), closes [#234](https://github.com/structured-world/vue-privacy/issues/234) [#235](https://github.com/structured-world/vue-privacy/issues/235)

## [1.10.1](https://github.com/structured-world/vue-privacy/compare/v1.10.0...v1.10.1) (2026-10-06)

### Bug Fixes

* initialise Google Analytics once and upgrade dependencies ([#214](https://github.com/structured-world/vue-privacy/issues/214)) ([dc62b54](https://github.com/structured-world/vue-privacy/commit/dc62b54add9dc2cba6c8b33ef4a78d8acae6a1f6)), closes [#197](https://github.com/structured-world/vue-privacy/issues/197)
* **release:** pin the changelog preset to a version semantic-release renders ([#220](https://github.com/structured-world/vue-privacy/issues/220)) ([8e4fee4](https://github.com/structured-world/vue-privacy/commit/8e4fee483324a857103c4f32fee7560c401996e6)), closes [#152](https://github.com/structured-world/vue-privacy/issues/152) [#219](https://github.com/structured-world/vue-privacy/issues/219)

## [1.10.0](https://github.com/structured-world/vue-privacy/compare/v1.9.0...v1.10.0) (2026-02-05)

### Features

* **consent:** add GDPR roaming protection and VERSION export ([#86](https://github.com/structured-world/vue-privacy/issues/86)) ([074e090](https://github.com/structured-world/vue-privacy/commit/074e0903fd685031152fae221c3e061a9f729b6a)), closes [#85](https://github.com/structured-world/vue-privacy/issues/85)

## [1.9.0](https://github.com/structured-world/vue-privacy/compare/v1.8.0...v1.9.0) (2026-02-05)

### Features

* **storage:** add rate limiting support to createKVStorage ([#81](https://github.com/structured-world/vue-privacy/issues/81)) ([ea6b487](https://github.com/structured-world/vue-privacy/commit/ea6b4872c0067472fc43899db8f543ab18854e3b)), closes [#75](https://github.com/structured-world/vue-privacy/issues/75)

## [1.8.0](https://github.com/structured-world/vue-privacy/compare/v1.7.1...v1.8.0) (2026-02-05)

### Features

* CCPA compliance support (California Consumer Privacy Act) ([#84](https://github.com/structured-world/vue-privacy/issues/84)) ([d152de4](https://github.com/structured-world/vue-privacy/commit/d152de456d441c1a4d320880da29c6618e380199)), closes [#83](https://github.com/structured-world/vue-privacy/issues/83)

## [1.7.1](https://github.com/structured-world/vue-privacy/compare/v1.7.0...v1.7.1) (2026-02-04)

### Bug Fixes

* persist EU status in consent cookie and show in debug panel ([#80](https://github.com/structured-world/vue-privacy/issues/80)) ([f543d0a](https://github.com/structured-world/vue-privacy/commit/f543d0af51a8480de57750fd11a995917fddd9f6)), closes [structured-world/vue-privacy#76](https://github.com/structured-world/vue-privacy/issues/76)

## [1.7.0](https://github.com/structured-world/vue-privacy/compare/v1.6.2...v1.7.0) (2026-02-04)

### Features

* **vanilla:** add vanilla JS/CSS consent banner for non-Vue users ([#77](https://github.com/structured-world/vue-privacy/issues/77)) ([14719ee](https://github.com/structured-world/vue-privacy/commit/14719ee252b3e23cb5138d64957dfb34e935d55b)), closes [#72](https://github.com/structured-world/vue-privacy/issues/72) [#fff](https://github.com/structured-world/vue-privacy/issues/fff) [#1a1a1a](https://github.com/structured-world/vue-privacy/issues/1a1a1a)

## [1.6.2](https://github.com/structured-world/vue-privacy/compare/v1.6.1...v1.6.2) (2026-02-04)

### Bug Fixes

* **docs:** prevent race condition in BugReportWidget on close ([#73](https://github.com/structured-world/vue-privacy/issues/73)) ([3fe63ae](https://github.com/structured-world/vue-privacy/commit/3fe63ae1de31f5e765a5f1506ae753f19a763e0e)), closes [structured-world/vue-privacy#12](https://github.com/structured-world/vue-privacy/issues/12)

## [1.6.1](https://github.com/structured-world/vue-privacy/compare/v1.6.0...v1.6.1) (2026-02-04)

### Bug Fixes

* non-EU users get all consent granted without storing ([#71](https://github.com/structured-world/vue-privacy/issues/71)) ([ffa7e53](https://github.com/structured-world/vue-privacy/commit/ffa7e534975f5983e6b4e00f3296bb1681ab28eb)), closes [#70](https://github.com/structured-world/vue-privacy/issues/70)

## [1.6.0](https://github.com/structured-world/vue-privacy/compare/v1.5.0...v1.6.0) (2026-02-04)

### Features

* GA4 events tracking, ecommerce helpers, Vue Router integration ([#69](https://github.com/structured-world/vue-privacy/issues/69)) ([b07a440](https://github.com/structured-world/vue-privacy/commit/b07a440983eaa00b61d3422e13c7a102c33a115d)), closes [#68](https://github.com/structured-world/vue-privacy/issues/68)

## [1.5.0](https://github.com/structured-world/vue-privacy/compare/v1.4.0...v1.5.0) (2026-02-02)

### Features

* preference center modal, script blocking, i18n (Phase 2) ([#65](https://github.com/structured-world/vue-privacy/issues/65)) ([89b3fbe](https://github.com/structured-world/vue-privacy/commit/89b3fbe43955e055e9a8265c1c064a055deb2cc9)), closes [#64](https://github.com/structured-world/vue-privacy/issues/64)

## [1.4.0](https://github.com/structured-world/vue-privacy/compare/v1.3.0...v1.4.0) (2026-02-02)

### Features

* UMD/IIFE build for CDN usage + createKVStorage tests ([#63](https://github.com/structured-world/vue-privacy/issues/63)) ([59aa0a4](https://github.com/structured-world/vue-privacy/commit/59aa0a4b59118a514b4430223928d5255725d164)), closes [#62](https://github.com/structured-world/vue-privacy/issues/62)

## [1.3.0](https://github.com/structured-world/vue-privacy/compare/v1.2.3...v1.3.0) (2026-02-01)

### Features

* **geo:** add WorkerGeoDetector for Cloudflare Worker-based EU detection ([#42](https://github.com/structured-world/vue-privacy/issues/42)) ([09dddb3](https://github.com/structured-world/vue-privacy/commit/09dddb30284b3e9fffc46774eddbe2a248f1a2ba)), closes [#41](https://github.com/structured-world/vue-privacy/issues/41)

## [1.2.3](https://github.com/structured-world/vue-privacy/compare/v1.2.2...v1.2.3) (2026-01-31)

### Bug Fixes

* **vue:** embed banner CSS in JS bundle ([#40](https://github.com/structured-world/vue-privacy/issues/40)) ([2514454](https://github.com/structured-world/vue-privacy/commit/251445424e10e98e658099b59d5428f25e732dd7)), closes [#39](https://github.com/structured-world/vue-privacy/issues/39)

## [1.2.2](https://github.com/structured-world/vue-privacy/compare/v1.2.1...v1.2.2) (2026-01-31)

### Bug Fixes

* **gtag:** use Arguments object instead of Array in dataLayer.push ([#36](https://github.com/structured-world/vue-privacy/issues/36)) ([4247b18](https://github.com/structured-world/vue-privacy/commit/4247b188e573839185b6037a98959468b743b938))

## [1.2.1](https://github.com/structured-world/vue-privacy/compare/v1.2.0...v1.2.1) (2026-01-31)

### Bug Fixes

* **core:** resolve consent banner race condition ([#34](https://github.com/structured-world/vue-privacy/issues/34)) ([055c560](https://github.com/structured-world/vue-privacy/commit/055c5600f1a2e96e7e6a1e337c184a6237fb03b5)), closes [#33](https://github.com/structured-world/vue-privacy/issues/33)

## [1.2.0](https://github.com/structured-world/vue-privacy/compare/v1.1.2...v1.2.0) (2026-01-31)

### Features

* add ConsentStorage interface and Quasar SPA tracking ([#32](https://github.com/structured-world/vue-privacy/issues/32)) ([4ed7cc8](https://github.com/structured-world/vue-privacy/commit/4ed7cc8da3461d9b150a5435c5740a1804f2827f)), closes [#31](https://github.com/structured-world/vue-privacy/issues/31) [#31](https://github.com/structured-world/vue-privacy/issues/31)

## [1.1.2](https://github.com/structured-world/vue-privacy/compare/v1.1.1...v1.1.2) (2026-01-31)

### Bug Fixes

* add VitePress SEO configuration and static assets ([#26](https://github.com/structured-world/vue-privacy/issues/26)) ([5e97afb](https://github.com/structured-world/vue-privacy/commit/5e97afba557731ff8659da0aec3ffd2b36276b4c)), closes [#25](https://github.com/structured-world/vue-privacy/issues/25)

## [1.1.1](https://github.com/structured-world/vue-privacy/compare/v1.1.0...v1.1.1) (2026-01-31)

### Bug Fixes

* replace vitepress inBrowser import with SSR-safe window check ([#28](https://github.com/structured-world/vue-privacy/issues/28)) ([5c863d7](https://github.com/structured-world/vue-privacy/commit/5c863d731c4be9822d5dc0f7df5acada9162cb30)), closes [#27](https://github.com/structured-world/vue-privacy/issues/27)

## [1.1.0](https://github.com/structured-world/vue-privacy/compare/v1.0.0...v1.1.0) (2026-01-31)

### Features

* SPA page tracking for VitePress and Vue Router ([#22](https://github.com/structured-world/vue-privacy/issues/22)) ([5ca7805](https://github.com/structured-world/vue-privacy/commit/5ca780573c3107b25b13733dbe1fe8df200fdadf)), closes [#21](https://github.com/structured-world/vue-privacy/issues/21)

## 1.0.0 (2026-01-25)

### Features

* initial release of @structured-world/consent ([add4448](https://github.com/structured-world/vue-privacy/commit/add44487c8279b34679d9431820397ef3f544497)), closes [#1](https://github.com/structured-world/vue-privacy/issues/1)
