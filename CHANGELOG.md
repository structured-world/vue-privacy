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
