import type {
  ConsentConfig,
  StoredConsent,
  ConsentCategories,
  ConsentStorage,
  GeoDetectionResult,
  GeoDetectionLogEntry,
  GA4EcommerceParams,
  GA4PurchaseParams,
  GA4GenerateLeadParams,
  GoogleConsentSignals,
} from "./types";
import { DEFAULT_CONFIG } from "./types";
import { detectLocale, getTranslations } from "../i18n/index";
import type { SupportedLocale } from "../i18n/types";
import { initScriptBlocker, unblockScriptsByCategory } from "./script-blocker";
import {
  getStoredConsent,
  storeConsent,
  clearConsent,
  getConsentUid,
  setConsentUid,
  clearConsentUid,
} from "./storage";
import {
  sendInitialConsent,
  hasConsentDefault,
  queueGoogleAnalyticsConfig,
  queueConsentUpdate,
  loadManagedGtagScript,
  clearAnalyticsCookies,
  setAnalyticsDisabled,
  isTagLiveFor,
  isManagedTagLiveFor,
  updateConsent as updateGoogleConsent,
  categoriesToGoogleSignals,
  trackPageView as gtagTrackPageView,
  trackEvent as gtagTrackEvent,
} from "./gtag";
import { createGeoDetector } from "../geo/index";
import { limitToUsed } from "./categories";
import { reloadPage } from "./page";

/**
 * US states with comprehensive consumer privacy laws (CCPA-like).
 * Stored in lowercase for case-insensitive matching.
 */
export const CCPA_REGIONS = new Set([
  // California - CCPA/CPRA
  "california",
  "ca",
  // Virginia - VCDPA
  "virginia",
  "va",
  // Colorado - CPA
  "colorado",
  "co",
  // Connecticut - CTDPA
  "connecticut",
  "ct",
  // Utah - UCPA
  "utah",
  "ut",
]);

/** How long tags hold their first hits for an undecided visitor's consent update. */
const DEFAULT_WAIT_FOR_UPDATE_MS = 500;

/**
 * How long a newer remote write waits for the superseded one to settle after aborting it. A
 * storage that honours the abort settles at once; one that ignores it must not hold every later
 * write for the rest of the page.
 */
const SUPERSEDED_WRITE_GRACE_MS = 10_000;

/** Settles when `write` does, or after `ms`, whichever comes first. `write` never rejects. */
function settledWithin(write: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    void write.then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

type Categories = Omit<ConsentCategories, "necessary">;

function sameCategories(a: Categories, b: Categories): boolean {
  return (
    a.analytics === b.analytics && a.marketing === b.marketing && a.functional === b.functional
  );
}

function sameSignals(a: GoogleConsentSignals, b: GoogleConsentSignals): boolean {
  return (
    a.analytics_storage === b.analytics_storage &&
    a.ad_storage === b.ad_storage &&
    a.ad_user_data === b.ad_user_data &&
    a.ad_personalization === b.ad_personalization
  );
}

/** The consent in effect, as every consumer sees it. */
interface ConsentInEffect {
  /** The visitor's own choice (stored, or made on this page), or null while undecided. */
  choice: StoredConsent | null;
  /** What the consent callback, the listeners and the script blocker follow; null: undecided. */
  categories: Categories | null;
  /** What Google gets. */
  signals: GoogleConsentSignals;
}

/**
 * Consent Manager - orchestrates consent flow
 */
export class ConsentManager {
  private config: ConsentConfig;
  /** Basic Consent Mode: Google gets nothing until the visitor explicitly allows analytics. */
  private readonly basicMode: boolean;
  private locale: SupportedLocale;
  private initialized = false;
  private isEU: boolean | null = null;
  private geoResult: GeoDetectionResult | null = null;
  private geoDetectionLog: GeoDetectionLogEntry[] = [];
  private userId: string | null = null;
  private remoteStorage: ConsentStorage | null = null;
  private showBannerCallback: (() => void) | null = null;
  private hideBannerCallback: (() => void) | null = null;
  private showPreferenceCenterCallback: (() => void) | null = null;
  private hidePreferenceCenterCallback: (() => void) | null = null;
  private scriptBlockerCleanup: (() => void) | null = null;
  /** Removes the basic-mode listeners that follow choices made in other tabs. */
  private tabWatchCleanup: (() => void) | null = null;
  private routerCleanup: (() => void) | null = null;
  /** This manager made its first consent push; every later push is an update. */
  private gaDefaultsSent = false;
  /** The signals reconcile() last sent to Google (null: none yet). */
  private sentSignals: GoogleConsentSignals | null = null;
  /** The categories the callback and listeners last received (null: none, or reset since). */
  private notifiedCategories: Categories | null = null;
  /** The timestamp of the choice reconcile() last acted on; a newer record is a new decision. */
  private actedOnRecord: number | null = null;
  /** The token of the pending reload for a withdrawal (reloadOnWithdrawal), if one is scheduled. */
  private pendingReload: object | null = null;
  /**
   * init() decided the consent state, or the visitor chose or reset: until then a stored grant
   * may still fail the roaming check, so basic mode does not act on the cookie by itself.
   */
  private consentSettled = false;
  /** This page's choice reached the consent cookie, so a missing cookie means another tab reset. */
  private cookieConfirmed = false;
  /**
   * The jurisdiction's grant (CCPA, outside consent jurisdictions) while the visitor has not
   * chosen; not a choice. Basic mode keeps analytics off in it and gives Google nothing on it.
   */
  private impliedChoice: StoredConsent | null = null;
  /** Basic mode: the page view tracked while analytics was off, measured once it is allowed. */
  private pendingPageView: { path: string; title?: string } | null = null;
  /** A gtag.js load attempt is in flight. */
  private gaLoading = false;
  /** gtag.js loaded; no further attempt is needed. */
  private gaLoaded = false;
  /** A consent push found the load in flight; a failure of that attempt retries at once. */
  private gaRetryOnFailure = false;
  /** destroy() ran: a load still in flight settles without reporting or retrying. */
  private destroyed = false;
  /** Tail of the remote consent writes, which run one after another. */
  private remoteWrite: Promise<void> = Promise.resolve();
  /** Settles when the latest remote write gets its turn (the one before it settled or timed out). */
  private remoteWriteTurn: Promise<void> = Promise.resolve();
  /** Aborts the latest remote write once a newer decision supersedes it. */
  private remoteWriteAbort: AbortController | null = null;
  /** Remote writes started so far; tells a write whether a newer one began while it ran. */
  private remoteWritesStarted = 0;
  /** Advanced by resetConsent(): a remote id returned for an earlier identity is not kept. */
  private identityGeneration = 0;
  /**
   * The choice made on this page. It stands in for the cookie, which may be blocked or fail to
   * write, so tracking and the script blocker follow the visitor's latest decision; a cookie
   * written since (another tab) supersedes it.
   */
  private pageChoice: StoredConsent | null = null;
  /**
   * Advanced by every choice and every reset. `init()` remembers it when it starts and stops at
   * its next step if it moved: what it read before then (a stored grant, an undecided visitor)
   * no longer describes the visitor.
   */
  private consentEpoch = 0;
  private bannerPending = false;
  private preferenceCenterPending = false;
  private consentChangeListeners: Array<
    (categories: Omit<ConsentCategories, "necessary">) => void
  > = [];

  constructor(config: ConsentConfig = {}) {
    // Basic mode's promise (nothing reaches Google before consent or after a refusal) holds only
    // for a tag this manager loads and can switch off; a tag the site loads itself is beyond it.
    if (config.consentMode === "basic" && !config.gaId) {
      throw new Error("consentMode 'basic' requires gaId: the manager must load the Google tag");
    }
    this.locale = config.locale ?? detectLocale();
    this.config = {
      ...config,
      locale: this.locale,
      categories: { ...DEFAULT_CONFIG.categories, ...config.categories },
      // Defaults in the visitor's locale, not DEFAULT_CONFIG's English: the components and any
      // custom UI read getConfig().banner before the translations.
      banner: {
        ...getTranslations(this.locale).banner,
        privacyLink: DEFAULT_CONFIG.banner.privacyLink,
        ...config.banner,
      },
      cookie: { ...DEFAULT_CONFIG.cookie, ...config.cookie },
    };
    this.basicMode = config.consentMode === "basic";

    if (config.storage) {
      this.remoteStorage = config.storage;
    }
  }

  /**
   * Register callback to show banner.
   * If init() already requested the banner before this callback was registered,
   * fires immediately (handles race condition with component mount timing).
   */
  onShowBanner(callback: () => void): void {
    this.showBannerCallback = callback;
    if (this.bannerPending) {
      this.bannerPending = false;
      callback();
    }
  }

  /**
   * Register callback to hide banner
   */
  onHideBanner(callback: () => void): void {
    this.hideBannerCallback = callback;
  }

  /**
   * Register (or clear) callback to show preference center.
   * Pass null to unregister.
   * If showPreferenceCenter() was called before this callback was registered,
   * fires immediately (same race-condition handling as banner).
   */
  onShowPreferenceCenter(callback: (() => void) | null): void {
    this.showPreferenceCenterCallback = callback;
    if (callback && this.preferenceCenterPending) {
      this.preferenceCenterPending = false;
      callback();
    }
  }

  /**
   * Register (or clear) callback to hide preference center.
   * Pass null to unregister.
   */
  onHidePreferenceCenter(callback: (() => void) | null): void {
    this.hidePreferenceCenterCallback = callback;
  }

  /**
   * Register a listener that fires whenever consent categories change, also for a choice made in
   * another tab. Used internally by the script blocker; also available for external consumers.
   * Each listener receives its own copy; one that throws is logged and does not stop the others.
   */
  onConsentChange(listener: (categories: Omit<ConsentCategories, "necessary">) => void): void {
    this.consentChangeListeners.push(listener);
  }

  /**
   * Programmatically show the preference center modal
   */
  showPreferenceCenter(): void {
    if (this.showPreferenceCenterCallback) {
      this.showPreferenceCenterCallback();
    } else {
      this.preferenceCenterPending = true;
    }
    this.config.onPreferenceCenterShow?.();
  }

  /**
   * Get the resolved locale
   */
  getLocale(): SupportedLocale {
    return this.locale;
  }

  /**
   * Initialize consent manager: restore or decide the visitor's consent state, or show the
   * banner. Every `await` here may let the visitor choose or reset first; that then stands,
   * and the rest of this flow only finishes detecting the jurisdiction.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      await this.decideInitialConsent();
    } finally {
      this.consentSettled = true;
      // The script blocker ignored scripts added before this point (an allowed script may add
      // more while init() finishes); with the consent settled they are scanned once more.
      const settled = this.scriptBlockerCleanup ? this.getConsent() : null;
      if (settled && !this.destroyed) unblockScriptsByCategory(settled.categories);
    }
  }

  private async decideInitialConsent(): Promise<void> {
    const epoch = this.consentEpoch;

    // Initialize script blocker (auto-unblocks on consent change)
    if (typeof document !== "undefined") {
      this.scriptBlockerCleanup = initScriptBlocker(this);
      if (this.basicMode && this.config.gaId) this.watchOtherTabs();
    }

    if (this.pageChoice !== null) {
      // A choice made on this page before init() stands, like one made while it runs: it was
      // stored before the location was known, which the roaming check must not take for consent
      // given outside the EU. init() only detects the jurisdiction and stores it with the choice.
      await this.detectJurisdiction();
      this.storeLocationWithChoice();
      this.restore();
      return;
    }

    // Fast-path: check consent_preferences cookie
    const stored = getStoredConsent(this.config);
    if (stored && (await this.restoreStoredConsent(stored, epoch))) return;
    // Remote fallback: restore the record stored for this visitor's ID. Without one, geo
    // detection below starts at once, with no extra tick.
    const storage = this.remoteStorage;
    const uid = storage ? getConsentUid() : null;
    if (storage && uid && (await this.restoreRemoteConsent(storage, uid, epoch))) return;

    await this.detectJurisdiction();
    // Every await is behind us: a choice or reset made meanwhile stands over what this flow read.
    if (this.supersededSince(epoch)) return;
    // So does a choice another tab saved meanwhile (the cookie is shared); a jurisdiction's
    // grant or the banner must not take its place.
    const latest = getStoredConsent(this.config);
    if (
      latest !== null &&
      latest.timestamp !== stored?.timestamp &&
      (!this.isEU || latest.isEU === true)
    ) {
      this.restore();
      return;
    }
    this.decideByJurisdiction();
  }

  /** Whether the visitor chose or reset since `epoch`; that decision stands over init()'s reads. */
  private supersededSince(epoch: number): boolean {
    if (this.consentEpoch === epoch) return false;
    // A choice made meanwhile was stored before its location was known; without it, the
    // next page load would take an EU visitor's choice for non-EU consent and ask again.
    this.storeLocationWithChoice();
    return true;
  }

  /**
   * Restore the consent cookie, checking a choice made outside the EU against the current
   * location. Returns whether the consent is decided; false leaves the visitor undecided.
   */
  private async restoreStoredConsent(stored: StoredConsent, epoch: number): Promise<boolean> {
    // GDPR roaming protection: consent given in EU context is valid everywhere,
    // but consent given outside EU may not be valid if user is now in EU.
    // GDPR protects everyone IN the EU, not just EU citizens.
    if (stored.isEU === true) {
      // Consent was given in EU context with full GDPR disclosure — valid everywhere.
      this.adoptStoredLocation(stored);
      this.restore();
      return true;
    }

    // Non-EU consent (isEU=false or undefined): must verify current location.
    // GDPR protects everyone IN the EU, so if user has roamed to EU, need re-consent.
    // NOTE: This runs geo detection on every page load for non-EU users — intentional
    // for GDPR roaming protection. EU users (isEU=true) skip this via fast-path above.
    const needsReconsent = await this.checkRoamingToEU(stored);
    if (this.supersededSince(epoch)) return true;
    // Another tab may have saved a choice, or reset, while the location was checked. That is
    // the visitor's latest decision: the consent read above must not be written back over it.
    const current = getStoredConsent(this.config);
    const changed = current?.timestamp !== stored.timestamp;
    if (changed && current !== null && (!needsReconsent || current.isEU === true)) {
      this.restore();
      return true;
    }
    if (!changed && !needsReconsent) {
      // User is not in EU now — non-EU consent remains valid.
      this.storeDetectedLocation(stored);
      this.restore();
      return true;
    }
    // Now in the EU with consent given outside it (cleared here), or reset in another tab:
    // undecided, and decided later like a first visit.
    if (needsReconsent) clearConsent(this.config);
    return false;
  }

  /** The location a choice made in the EU carries, as this page's detection result. */
  private adoptStoredLocation(stored: StoredConsent): void {
    this.isEU = true;
    this.geoResult = {
      isEU: true,
      method: stored.geoMethod ?? "manual",
      countryCode: stored.countryCode,
      region: stored.region,
    };
    this.geoDetectionLog = [
      {
        method: stored.geoMethod ?? "manual",
        status: "success",
        result: { isEU: true, countryCode: stored.countryCode, region: stored.region },
        duration: 0,
      },
    ];
  }

  /**
   * Update the cookie with fresh geo data from the roaming check (for debugging/analytics).
   * This doesn't skip future roaming checks — only the isEU=true fast-path does that.
   */
  private storeDetectedLocation(stored: StoredConsent): void {
    if (!this.geoResult) return;
    storeConsent(
      {
        categories: stored.categories,
        // The same moment: refreshing the location does not make the choice a newer one, which
        // the other open tabs would take for a new decision.
        timestamp: stored.timestamp,
        isEU: this.geoResult.isEU,
        geoMethod: this.geoResult.method,
        countryCode: this.geoResult.countryCode,
        region: this.geoResult.region,
      },
      this.config
    );
  }

  /** Restore the remote record stored for `uid`. Returns whether the consent is decided. */
  private async restoreRemoteConsent(
    storage: ConsentStorage,
    uid: string,
    epoch: number
  ): Promise<boolean> {
    this.userId = uid;
    const version = this.config.version ?? DEFAULT_CONFIG.version;
    try {
      const remote = await storage.get(uid, version);
      if (remote) return await this.adoptRemoteConsent(remote, uid, epoch);
    } catch {
      // Remote storage failed — fall through to geo detection
    }
    // A choice or reset made while remote.get() was pending is caught after geo detection,
    // which still runs: isEUUser() and isCCPAUser() must hold for this page.
    return false;
  }

  /** Adopt a remote record outside the EU. Returns whether the consent is decided. */
  private async adoptRemoteConsent(
    remote: StoredConsent,
    uid: string,
    epoch: number
  ): Promise<boolean> {
    // GDPR roaming protection: remote storage doesn't include geo data,
    // so we must check current location before restoring.
    // If user is now in EU, they need fresh GDPR-compliant consent.
    const geoResult = await this.performGeoDetection();
    if (this.supersededSince(epoch)) return true;

    // Another tab may have saved a choice, or reset, while the record was fetched: that
    // is newer than the record, which must not be written over it.
    const current = getStoredConsent(this.config);
    if (current && (!geoResult.isEU || current.isEU === true)) {
      this.restore();
      return true;
    }
    // Reset in another tab meanwhile: undecided again, decided like a first visit.
    if (getConsentUid() !== uid) return false;
    if (geoResult.isEU) {
      // User is in EU — cannot use remote consent without GDPR disclosure.
      // Clear consent_uid and fall through to show banner.
      clearConsentUid(this.config);
      return false;
    }
    // Not in EU — safe to restore remote consent. Note: on next page load, this cookie (with
    // isEU=false) will trigger the roaming check again — only the isEU=true fast-path skips geo
    // detection. Adopted as this page's choice: it stays in effect even where the cookie cannot
    // be written (a sandboxed frame).
    this.pageChoice = this.choiceRecord(remote.categories);
    this.storeAndConfirm(this.pageChoice);
    this.restore();
    return true;
  }

  /** Detect if user is in EU (skip if already detected in roaming check or remote storage). */
  private async detectJurisdiction(): Promise<void> {
    if (this.isEU !== null) return;
    try {
      await this.performGeoDetection();
    } catch {
      // Geo detection failed: assume non-EU to avoid blocking site usage.
      // This is a fail-open strategy - if we can't determine location, we grant
      // consent by default (same behavior as non-EU, non-CCPA users).
      // This prioritizes user experience over strict compliance in edge cases.
      this.isEU = false;
      this.geoDetectionLog = [
        {
          method: "fallback",
          status: "failed",
          result: { isEU: false },
          duration: 0,
          error: "Geo detection failed; defaulting to non-EU",
        },
      ];
    }
  }

  /** An undecided visitor: ask in the EU, apply the jurisdiction's grant elsewhere. */
  private decideByJurisdiction(): void {
    if (this.isEU) {
      // EU user: denied defaults that wait for the banner's answer, then show the banner
      this.restore(false);
      this.requestBanner();
      return;
    }
    const grantedCategories = {
      analytics: true,
      marketing: true,
      functional: true,
    };
    if (this.isCCPAUser()) {
      // CCPA user (US state with privacy law): grant all consent silently.
      // No banner required — CCPA uses opt-out model (via "Do Not Sell" link).
      // User can opt-out later via showPreferenceCenter() triggered by "Do Not Sell" link.
      // Persisted before it is applied, so geo-detection is not repeated on the next visit and
      // an opt-out a consent callback makes in response is the last choice written. Basic mode
      // keeps it unstored: a stored grant is the visitor's consent there, and this one is not.
      if (!this.basicMode) this.saveConsentWithRemote(this.choiceRecord(grantedCategories));
      this.impliedChoice = this.impliedRecord(grantedCategories);
      this.restore();
      this.config.onCCPAUser?.();
      return;
    }
    // Non-EU, non-CCPA user: grant all consent silently (same as "Accept All").
    // Don't store — this is the default state for unrestricted jurisdictions.
    // Consent will only be stored if user explicitly changes preferences.
    this.impliedChoice = this.impliedRecord(grantedCategories);
    this.restore();
  }

  /**
   * The jurisdiction's grant as a record. Basic mode allows analytics only on the visitor's own
   * choice, so it is off there for the consent callbacks and the script blocker alike.
   */
  private impliedRecord(granted: Categories): StoredConsent {
    return this.choiceRecord(this.basicMode ? { ...granted, analytics: false } : granted);
  }

  /**
   * Basic mode: the consent cookie is the one source of truth shared by the tabs, and a choice
   * made in another tab changes it without firing anything here. This tab reads it again when
   * it is shown or regains focus, and on every tracking call (analyticsSuppressed()); a tab that
   * stays visible without either keeps its state until then.
   */
  private watchOtherTabs(): void {
    const sync = (): void => {
      if (document.visibilityState !== "hidden") this.syncFromOutside();
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    this.tabWatchCleanup = () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }

  /** Rewrite the visitor's choice, if any, with the location detected since it was made. */
  private storeLocationWithChoice(): void {
    const current = this.choiceInEffect();
    if (!current || this.isEU === null) return;
    // The same moment as before: adding the location does not make the choice a newer one.
    const record = { ...this.choiceRecord(current.categories), timestamp: current.timestamp };
    storeConsent(record, this.config);
    if (this.pageChoice) this.pageChoice = record;
  }

  /**
   * A choice with the location it was made in, so EU/CCPA status can be restored on reload.
   * Every record the manager acts on is built here, so a category the site does not use
   * (usedCategories) is refused in all of them. `?? undefined` omits a location that was not
   * detected rather than storing null.
   */
  private choiceRecord(categories: Omit<ConsentCategories, "necessary">): StoredConsent {
    return {
      // Its own copy: the object passed in also goes to the consent callbacks, and an edit they
      // make to it must not change the choice kept for this page.
      categories: limitToUsed(categories, this.config),
      timestamp: Date.now(),
      version: this.config.version ?? DEFAULT_CONFIG.version,
      isEU: this.isEU ?? undefined,
      geoMethod: this.geoResult?.method,
      countryCode: this.geoResult?.countryCode,
      region: this.geoResult?.region,
    };
  }

  /**
   * Write the record to the consent cookie and read it back. Only the record itself counts as
   * confirmation: a stale cookie left by a failed overwrite does not. A confirmed write tells a
   * later missing cookie (another tab's reset) apart from a blocked one (sandboxed frame,
   * disabled cookies), and a later different cookie (another tab's choice) apart from that stale
   * one, also within the same millisecond.
   */
  private storeAndConfirm(record: StoredConsent): void {
    storeConsent(record, this.config);
    const read = getStoredConsent(this.config);
    this.cookieConfirmed =
      read !== null &&
      read.timestamp === record.timestamp &&
      sameCategories(read.categories, record.categories);
  }

  /**
   * Persist the visitor's choice locally and (if remote storage is configured) remotely. A
   * refusal is stored like a grant, for the cookie's lifetime (365 days by default): an opt-out
   * must stay in effect (California Civil Code 1798.135(c)(4)), and a site that needs a refused
   * category asks again in context. Fire-and-forget: the remote push does not block UI.
   */
  private saveConsentWithRemote(record: StoredConsent): void {
    // The record's categories, never the caller's: only they are limited to the used ones.
    const { categories } = record;
    // `functional` does not count: only analytics or marketing is a grant worth a remote
    // identifier.
    const hasNonNecessary = categories.analytics || categories.marketing;

    this.storeAndConfirm(record);
    if (!hasNonNecessary) {
      // Without the refusal cookie (cleared by the visitor) consent_uid would let a visit fetch
      // an earlier remote grant, should the remote write of this refusal fail.
      clearConsentUid(this.config);
    }

    if (this.remoteStorage) {
      const version = this.config.version ?? DEFAULT_CONFIG.version;
      // Its own copy: the write runs later, after the consent callbacks got `categories` and
      // could edit it.
      const consent: StoredConsent = {
        categories: { ...categories },
        timestamp: Date.now(),
        version,
      };
      const epoch = this.consentEpoch;
      const identity = this.identityGeneration;
      const storage = this.remoteStorage;

      // Writes of the one remote record run one at a time, so an older write cannot finish
      // after a newer one and overwrite it. A write still queued when a newer decision arrives
      // is dropped: that decision writes for itself; one in flight is aborted and waited for at
      // most SUPERSEDED_WRITE_GRACE_MS. Running inside the chain also turns a set() that throws
      // synchronously into a rejection instead of aborting the visitor's choice.
      this.remoteWriteAbort?.abort();
      const controller = new AbortController();
      this.remoteWriteAbort = controller;
      const turn = settledWithin(this.remoteWrite, SUPERSEDED_WRITE_GRACE_MS);
      this.remoteWriteTurn = turn;
      this.remoteWrite = turn
        .then(async () => {
          if (this.consentEpoch !== epoch) return;
          const started = ++this.remoteWritesStarted;
          const id = await storage.set(this.userId, consent, controller.signal);
          // A write that settled past the grace period is behind a newer one already running,
          // which keeps its own id; an id that arrived in time is still carried forward.
          if (!id || this.remoteWritesStarted !== started) return;
          if (this.identityGeneration !== identity) return;
          // The record this write created is the visitor's: a newer write queued behind it
          // updates the same record instead of creating a second one. A reset since then started
          // a new identity, so the id is dropped.
          this.userId = id;
          // The cookie is kept only for a grant, and only while it is still the latest decision:
          // a withdrawal made meanwhile must not get the grant's id back.
          if (hasNonNecessary && this.consentEpoch === epoch) setConsentUid(id, this.config);
        })
        .catch(() => {
          // Silent fail — remote storage is best-effort, local cookies are primary
        });
    }
  }

  /**
   * Perform geo detection and update instance state.
   * Centralizes geo detection logic to avoid duplication across init flows.
   * Sets this.isEU, this.geoResult, and this.geoDetectionLog.
   * @returns The geo detection result
   * @throws If geo detection fails (caller should handle)
   */
  private async performGeoDetection(): Promise<GeoDetectionResult> {
    const detector =
      this.config.geoDetector ??
      createGeoDetector(this.config.euDetection ?? "auto", this.config.geoUrl);

    const geoResult = await detector.detect();
    this.isEU = geoResult.isEU;
    this.geoResult = geoResult;

    // Store detection log if available (from AutoGeoDetector)
    if ("log" in geoResult && geoResult.log) {
      this.geoDetectionLog = geoResult.log;
    } else {
      // Single-method detector: create simple log entry
      this.geoDetectionLog = [
        {
          method: geoResult.method,
          status: "success",
          result: {
            isEU: geoResult.isEU,
            countryCode: geoResult.countryCode,
            region: geoResult.region,
          },
          duration: 0,
        },
      ];
    }

    return geoResult;
  }

  /**
   * Check if user has roamed to EU and needs re-consent.
   * Called when stored consent was given outside EU (isEU=false or undefined).
   * Returns true if user is now in EU and needs to re-consent.
   */
  private async checkRoamingToEU(stored: StoredConsent): Promise<boolean> {
    try {
      const geoResult = await this.performGeoDetection();

      // If user is now in EU but consent was given outside EU, need re-consent
      if (geoResult.isEU && stored.isEU !== true) {
        return true;
      }

      return false;
    } catch {
      // Geo detection failed — keep existing consent (fail-safe).
      // Design choice: preserve user experience over strict GDPR enforcement in edge cases.
      // If a user with non-EU consent roams to EU but geo detection fails (network error,
      // blocked API, etc.), we keep their existing consent rather than forcing re-consent.
      // This is acceptable because: (1) geo detection failures are rare edge cases,
      // (2) the user already made a consent choice, and (3) forcing banner on transient
      // network errors would be poor UX. On next successful page load with working geo
      // detection, the roaming check will properly trigger re-consent if needed.
      // Restore stored geo data if available
      if (stored.isEU !== undefined) {
        this.isEU = stored.isEU;
        this.geoResult = {
          isEU: stored.isEU,
          method: stored.geoMethod ?? "manual",
          countryCode: stored.countryCode,
          region: stored.region,
        };
        // Log that geo data was restored from storage due to detection failure
        this.geoDetectionLog = [
          {
            method: stored.geoMethod ?? "manual",
            status: "failed",
            result: {
              isEU: stored.isEU,
              countryCode: stored.countryCode,
              region: stored.region,
            },
            duration: 0,
            error: "Geo detection failed in roaming check; restored from stored consent",
          },
        ];
      } else {
        // Legacy consent without isEU flag: we cannot restore geo state.
        // Log that geo detection failed with unknown status. The main init flow
        // will fall through to perform geo detection again if this.isEU is null.
        this.geoDetectionLog = [
          {
            method: "fallback",
            status: "failed",
            duration: 0,
            error: "Geo detection failed in roaming check; legacy consent without isEU flag",
          },
        ];
      }
      return false;
    }
  }

  /**
   * Send consent signals to Google Consent Mode. With `gaId`, the first push is the page's
   * single `consent default`, followed at once by `js` and `config`, so every event queued
   * later follows them; every later push is a `consent update`. Without `gaId` the site loads
   * gtag itself, so every push is an update.
   *
   * In basic mode Google gets nothing until a push allows analytics, which only the visitor's
   * own choice does (consentInEffect() denies everything on a jurisdiction's grant): until then
   * pushes are dropped, and from then on they go out as in advanced mode. A push that leaves
   * analytics denied also deletes the `_ga` cookies and switches a tag already on the page off.
   * Loading the tag is reconcile()'s last step, not this one's.
   *
   * @param final - The signals are a decision (stored, granted by jurisdiction, chosen), so
   *   tags need not hold their first hits for an update
   */
  private pushGoogleConsent(
    signals: GoogleConsentSignals,
    final: boolean,
    restoring: boolean
  ): void {
    const gaId = this.config.gaId;
    const previous = this.sentSignals;
    this.sentSignals = signals;
    const firstSetup = !this.gaDefaultsSent;
    let startsMeasuring = false;
    if (gaId && this.basicMode) {
      if (signals.analytics_storage === "granted") {
        startsMeasuring = this.switchAnalyticsOn(gaId, previous);
      } else if (!this.switchAnalyticsOff(gaId, previous, restoring) && firstSetup) {
        // A refusal before anything was sent, with no tag on the page: Google gets nothing.
        return;
      }
    }
    this.sendConsentCommands(signals, final);
    if (startsMeasuring) this.sendPendingPageView(firstSetup);
  }

  /**
   * Basic mode: a push that leaves analytics denied deletes the `_ga` cookies and switches the
   * tag off. Returns whether a tag runs on the page.
   */
  private switchAnalyticsOff(
    gaId: string,
    previous: GoogleConsentSignals | null,
    restoring: boolean
  ): boolean {
    // The tag may already run on the page whatever this instance has sent (an earlier manager
    // instance loaded it before a remount), so it is told about a refusal all the same.
    // A request in flight or past its timeout may still run; one that failed cannot.
    const tagRunning = isTagLiveFor(gaId);
    // Products linked to the same Google tag (Ads, Floodlight) ignore ga-disable and keep
    // sending cookieless pings; only a reload stops a running tag. A marketing-only
    // withdrawal needs none: with analytics allowed the next page loads the same tag, and
    // the denied ad signals reach the running one as an update already. Analytics refused
    // before was already withdrawn, so a repeated refusal reloads nothing. For the state init()
    // found, only a tag a consent manager loaded (a previous one's, before a remount) counts:
    // the site's own tag comes back with every load, and a reload for it would never end.
    const withdrawn = previous?.analytics_storage !== "denied";
    const stoppable = restoring ? isManagedTagLiveFor(gaId) : tagRunning;
    if (withdrawn && stoppable && this.config.reloadOnWithdrawal) this.scheduleReload();
    clearAnalyticsCookies(gaId);
    setAnalyticsDisabled(gaId, true);
    // A refusal itself must not cause a request to Google: no retry of a failed load either.
    this.gaRetryOnFailure = false;
    return tagRunning;
  }

  /** Basic mode: lift this library's switch. Returns whether analytics starts measuring now. */
  private switchAnalyticsOn(gaId: string, previous: GoogleConsentSignals | null): boolean {
    // A newer choice allows analytics again before a pending withdrawal reload ran (a
    // consent callback answering the refusal): the tag stays, so the reload has no purpose.
    this.pendingReload = null;
    setAnalyticsDisabled(gaId, false);
    return previous?.analytics_storage !== "granted";
  }

  /** The `consent default` (with `js` and `config`) on the first push, an update otherwise. */
  private sendConsentCommands(signals: GoogleConsentSignals, final: boolean): void {
    const gaId = this.config.gaId;
    if (!gaId) {
      updateGoogleConsent(signals);
    } else if (this.gaDefaultsSent) {
      queueConsentUpdate(signals);
    } else {
      this.gaDefaultsSent = true;
      // The page's single default may already exist (another manager instance, a remount, the
      // site's own snippet); this manager's first push is then an update.
      if (hasConsentDefault()) queueConsentUpdate(signals);
      else sendInitialConsent(signals, final ? 0 : DEFAULT_WAIT_FOR_UPDATE_MS);
      queueGoogleAnalyticsConfig(gaId, this.config.sendPageView ?? true);
    }
  }

  /**
   * Basic mode: measure the page in view, tracked while analytics was off, now that it is
   * allowed. On the first setup `config` sends the page view itself unless the site tracks page
   * views manually (sendPageView: false, as the SPA integrations do).
   */
  private sendPendingPageView(firstSetup: boolean): void {
    const pending = this.pendingPageView;
    this.pendingPageView = null;
    if (!pending || (firstSetup && (this.config.sendPageView ?? true))) return;
    gtagTrackPageView(pending.path, pending.title);
  }

  /**
   * Reload once the current flow is done: the choice is already stored and the consent
   * callbacks of this decision run first, so the reloaded page starts from it. destroy() does
   * not cancel it: the tag runs page-wide, and a callback that unmounted the app leaves it
   * running all the same. A newer choice that allows analytics again does (see pushGoogleConsent).
   */
  private scheduleReload(): void {
    if (this.pendingReload !== null) return;
    // Its own token: a newer grant cancels it, and a later withdrawal schedules another, which
    // this one must not take for itself.
    const token = {};
    this.pendingReload = token;
    setTimeout(() => void this.reloadAfterWrites(token), 0);
  }

  /**
   * The unload would abort a remote write still running and leave the remote record on the
   * withdrawn grant. The reload waits for the write chain, including writes a newer decision
   * queued meanwhile: for the latest write's turn (bounded by the grace period of the write
   * before it), then for that write itself, as long again.
   */
  private async reloadAfterWrites(token: object): Promise<void> {
    const write = this.remoteWrite;
    await this.remoteWriteTurn;
    await settledWithin(write, SUPERSEDED_WRITE_GRACE_MS);
    // Cancelled by a newer grant, or replaced by a later withdrawal's own reload.
    if (this.pendingReload !== token) return;
    // A newer decision queued another write meanwhile: wait for that one too.
    if (write !== this.remoteWrite) return this.reloadAfterWrites(token);
    this.pendingReload = null;
    // The request found in flight may have failed meanwhile: nothing is left to stop then.
    const gaId = this.config.gaId;
    if (gaId && isTagLiveFor(gaId)) reloadPage();
  }

  /**
   * One attempt to load gtag.js, which then processes the queued commands. Nothing waits on
   * it: a blocked or failed load never holds up or fails the consent flow.
   */
  private loadGtag(gaId: string): void {
    this.gaLoading = true;
    this.gaRetryOnFailure = false;
    loadManagedGtagScript(gaId).then(
      () => {
        this.gaLoading = false;
        this.gaLoaded = true;
      },
      (error: unknown) => {
        this.gaLoading = false;
        // The app that owned this manager is gone; nothing may be reported or appended for it.
        if (this.destroyed) return;
        try {
          this.config.onGoogleAnalyticsError?.(error);
        } catch {
          // A throwing callback must not break the consent flow.
        }
        // A consent change during this attempt found it in flight and started nothing, and no
        // later change may come; retry for it now. Otherwise the next push retries. The error
        // callback above may have destroyed the manager, so that is checked again here.
        if (this.gaRetryOnFailure && !this.destroyed) this.loadGtag(gaId);
      }
    );
  }

  /**
   * The consent in effect, derived from the visitor's choice (this page's or the shared cookie's)
   * or, before any, the jurisdiction's grant. Every consumer follows this one derivation.
   */
  private consentInEffect(): ConsentInEffect {
    const denied = categoriesToGoogleSignals({});
    const choice = this.choiceInEffect();
    if (choice !== null) {
      return {
        choice,
        categories: choice.categories,
        signals: categoriesToGoogleSignals(choice.categories),
      };
    }
    const implied = this.impliedChoice;
    if (implied === null) return { choice: null, categories: null, signals: denied };
    return {
      choice: null,
      categories: implied.categories,
      // Basic mode gives Google no grant before an explicit choice: a tag an earlier instance
      // left on the page would resume linked Ads/Floodlight on implied ad signals. The callbacks
      // and the script blocker still follow the jurisdiction's marketing state (an opt-out model).
      signals: this.basicMode ? denied : categoriesToGoogleSignals(implied.categories),
    };
  }

  /**
   * Bring every consumer in line with consentInEffect(), in a fixed order: the Google commands
   * (a denial takes effect before anything else runs), then the consent callback and the
   * listeners, then the tag load, unless a callback made a newer decision meanwhile. Each step
   * acts only on what changed since the last call, so it is safe to call from any trigger (a
   * choice, init(), another tab, a tracking call). Returns whether analytics is allowed.
   *
   * @param final - The state is a decision, so tags need not hold their first hits for an update
   * @param restoring - The state init() found: a refusal in it reloads (reloadOnWithdrawal) only
   *   for a tag a consent manager loaded, never for the site's own (its snippet, or the public
   *   loader it calls on every start), which comes back with every load.
   */
  private reconcile(final = true, restoring = false): boolean {
    this.consentSettled = true;
    const epoch = this.consentEpoch;
    const { choice, categories, signals } = this.consentInEffect();
    if (choice !== null && choice !== this.pageChoice) {
      // A record read from the cookie (stored earlier, or by another tab) becomes this page's
      // choice, so it stays in effect on a route where a cookie limited to cookie.path is
      // hidden, instead of an older choice of this page.
      this.pageChoice = choice;
      this.cookieConfirmed = true;
    }
    // A record not acted on before: a new decision, here or in another tab, even with the same
    // categories (it retries a failed tag load and reaches the callbacks).
    const newRecord = choice !== null && choice.timestamp !== this.actedOnRecord;
    this.actedOnRecord = choice?.timestamp ?? null;
    const googleChanged = this.sentSignals === null || !sameSignals(signals, this.sentSignals);
    const decided = googleChanged || newRecord;
    if (decided) this.pushGoogleConsent(signals, final, restoring);

    if (categories === null) {
      // Undecided (a reset): the same grant made again later reaches the listeners as new.
      this.notifiedCategories = null;
    } else if (
      newRecord ||
      this.notifiedCategories === null ||
      !sameCategories(categories, this.notifiedCategories)
    ) {
      this.notifyChange(categories);
      // A callback answered with its own choice or a reset, which reconciled everything itself.
      if (this.consentEpoch !== epoch) return this.consentInEffect().categories?.analytics === true;
    }

    if (decided) this.startTagLoad(signals);
    return categories?.analytics === true;
  }

  /**
   * Basic mode: follow a change another tab made through the shared cookie. Until init() settled
   * a stored grant may still fail the roaming check, so nothing acts on the cookie's word alone.
   */
  private syncFromOutside(): boolean {
    if (!this.consentSettled) return false;
    const acted = this.actedOnRecord;
    const allowed = this.reconcile();
    if (this.actedOnRecord === acted) return allowed;
    // Another tab answered the banner this tab is showing (or holds for its component), or
    // reset the choice, which asks again here as a local reset does.
    if (this.actedOnRecord !== null) this.closeBanner();
    else this.requestBanner();
    return allowed;
  }

  /** Ask the visitor: show the banner, or hold the request for a component not mounted yet. */
  private requestBanner(): void {
    if (this.showBannerCallback) {
      this.showBannerCallback();
    } else {
      this.bannerPending = true;
    }
    this.config.onBannerShow?.();
  }

  /** The banner's question is answered: close it, or drop a request its component never got. */
  private closeBanner(): void {
    this.bannerPending = false;
    this.hideBannerCallback?.();
    this.config.onBannerHide?.();
  }

  /** Apply the consent init() found; see reconcile()'s `restoring`. */
  private restore(final = true): void {
    this.reconcile(final, true);
  }

  /** Load gtag.js for the consent just sent, unless it refuses analytics in basic mode. */
  private startTagLoad(signals: GoogleConsentSignals): void {
    const gaId = this.config.gaId;
    if (!gaId || this.destroyed) return;
    // A refusal itself must not cause a request to Google: no load now and no retry later.
    if (this.basicMode && signals.analytics_storage === "denied") return;
    if (this.gaLoading) {
      // Should the attempt in flight fail, this decision still gets its retry.
      this.gaRetryOnFailure = true;
      return;
    }
    if (!this.gaLoaded) this.loadGtag(gaId);
  }

  /**
   * Hand a change of the categories in effect to the configured callback, then to the registered
   * listeners. A callback that reset consent or made another choice replaced these categories,
   * so the listeners (the script blocker) do not act on them.
   */
  private notifyChange(categories: Omit<ConsentCategories, "necessary">): void {
    const epoch = this.consentEpoch;
    // A tracking call the callback makes runs the cross-tab sync, which must not notify the
    // listeners a second time for these same categories.
    this.notifiedCategories = { ...categories };
    try {
      this.config.onConsentChange?.({
        // Its own copy, like each listener's: an edit must not reach the listeners after it.
        categories: { ...categories },
        timestamp: Date.now(),
        version: this.config.version ?? DEFAULT_CONFIG.version,
      });
    } catch (error) {
      // The app's callback must not stop the consent from taking effect: the listeners and, for a
      // choice from another tab, the switch that stops the Google tag still follow.
      console.error("[vue-privacy] onConsentChange failed", error);
    }
    if (this.consentEpoch !== epoch) return;
    this.notifyListeners(categories);
  }

  /**
   * Hand the categories in effect to the registered listeners (the script blocker first). Each
   * gets its own copy, so an edit cannot change what the manager applies; a listener that throws
   * is reported and skipped, so the others, and the Google tag sync after them, still run.
   */
  private notifyListeners(categories: Omit<ConsentCategories, "necessary">): void {
    const epoch = this.consentEpoch;
    this.notifiedCategories = { ...categories };
    for (const listener of this.consentChangeListeners) {
      if (this.consentEpoch !== epoch) return;
      try {
        listener({ ...categories });
      } catch (error) {
        console.error("[vue-privacy] consent listener failed", error);
      }
    }
  }

  /**
   * Accept all cookies
   */
  async acceptAll(): Promise<void> {
    const categories = {
      analytics: true,
      marketing: true,
      functional: true,
    };

    this.choose(categories);
  }

  /**
   * Reject every optional category, functional included: only strictly necessary storage is
   * exempt from consent (ePrivacy Directive 2002/58/EC, Art. 5(3)).
   */
  async rejectAll(): Promise<void> {
    const categories = {
      analytics: false,
      marketing: false,
      functional: false,
    };

    this.choose(categories);
  }

  /**
   * Save custom preferences
   */
  async savePreferences(categories: Partial<Omit<ConsentCategories, "necessary">>): Promise<void> {
    const finalCategories = {
      analytics: categories.analytics ?? false,
      marketing: categories.marketing ?? false,
      functional: categories.functional ?? true,
    };

    this.choose(finalCategories);
  }

  /**
   * Apply, persist and close the dialogs for the visitor's own choice. Advances the epoch so a
   * pending `init()` does not replace it with the state it was still resolving.
   */
  private choose(categories: Omit<ConsentCategories, "necessary">): void {
    const epoch = ++this.consentEpoch;
    this.impliedChoice = null;
    this.pageChoice = this.choiceRecord(categories);
    // Stored before the callbacks run: they see this choice, and a decision they make
    // themselves (a reset, another choice) is the last one written.
    this.saveConsentWithRemote(this.pageChoice);
    this.reconcile();

    // The preference centre closes either way; it would cover a banner a callback's reset
    // just showed. The banner stays when a callback made a newer decision.
    this.hidePreferenceCenterCallback?.();
    this.config.onPreferenceCenterHide?.();
    if (this.consentEpoch !== epoch) return;
    this.closeBanner();
  }

  /**
   * Get the visitor's choice (a grant or a refusal): the stored one, or the one made on this page
   * while the cookie lacks it (blocked, or older); in basic mode, before any choice, the state
   * the jurisdiction implies (analytics off); otherwise null while the visitor is undecided
   */
  getConsent(): StoredConsent | null {
    // Basic mode keeps the jurisdiction's grant unstored, but the preference centre still has to
    // show what is in effect; advanced mode stores it (CCPA) or reports the visitor undecided.
    const consent = this.choiceInEffect() ?? (this.basicMode ? this.impliedChoice : null);
    // A copy, like the snapshot parsed from the cookie: editing the result must not change the
    // consent in effect before the visitor saves it.
    if (consent !== null && (consent === this.pageChoice || consent === this.impliedChoice)) {
      return { ...consent, categories: { ...consent.categories } };
    }
    return consent;
  }

  /**
   * The choice in effect (latestChoice(), valid for this tab's location), read without the copy
   * getConsent() hands out (internal reads only).
   */
  private choiceInEffect(): StoredConsent | null {
    const found = this.latestChoice();
    if (found === null || this.isEU !== true || found.isEU === true) return found;
    // A record another tab saved outside the EU (it had not noticed the visitor's move) is no
    // consent here once this tab knows it is in the EU, as init()'s roaming check rejects it;
    // every reader (the Google tag, the script blocker, getConsent()) gets the same answer.
    // This page's own choice carries the location it was made with and is not judged again.
    return found.timestamp === this.pageChoice?.timestamp ? found : null;
  }

  /**
   * Whether the consent cookie is visible on the current path. One limited to `cookie.path` is
   * hidden on other routes of the app, which says nothing about a reset. Path-match per RFC 6265
   * 5.1.4: the paths are equal, or the cookie path is a prefix that ends with "/" or is followed
   * by "/" in the request path.
   */
  private cookieInScope(): boolean {
    if (typeof location === "undefined") return true;
    const cookiePath = this.config.cookie?.path ?? DEFAULT_CONFIG.cookie.path;
    const path = location.pathname;
    if (path === cookiePath) return true;
    if (!path.startsWith(cookiePath)) return false;
    return cookiePath.endsWith("/") || path.charAt(cookiePath.length) === "/";
  }

  /**
   * The visitor's choice. The consent cookie is the one source of truth shared by the tabs:
   * while this page's writes reach it, what it holds now (another tab's later write included)
   * is the choice, and its absence on a route it covers is a reset. This page's last record
   * stands in only where the cookie does not work here: a cookie limited to cookie.path is
   * hidden on the current route, or writes do not take (sandboxed frame, disabled cookies), where
   * a cookie still readable counts only once it is newer (written elsewhere after this choice).
   */
  private latestChoice(): StoredConsent | null {
    const stored = getStoredConsent(this.config);
    const own = this.pageChoice;
    if (own === null) return stored;
    if (this.cookieConfirmed) return stored ?? (this.cookieInScope() ? null : own);
    return stored !== null && stored.timestamp > own.timestamp ? stored : own;
  }

  /**
   * The consent the script blocker may act on: getConsent() once init() has settled, or the
   * visitor chose or reset, and null before. A stored grant read earlier may still fail the
   * roaming check, and the scripts it would unblock could not be stopped again.
   * @internal
   */
  getSettledConsent(): StoredConsent | null {
    return this.consentSettled ? this.getConsent() : null;
  }

  /**
   * Check if the visitor has chosen (a grant or a refusal); agrees with getConsent()
   */
  hasConsent(): boolean {
    return this.choiceInEffect() !== null;
  }

  /**
   * Reset consent (show banner again)
   */
  resetConsent(): void {
    clearConsent(this.config);
    clearConsentUid(this.config);
    this.userId = null;
    this.identityGeneration++;
    this.pageChoice = null;
    this.impliedChoice = null;
    // Undecided again: the signals go back to denied while the banner asks, and a pending
    // init() stops instead of restoring or granting what it read before the reset.
    this.consentEpoch++;
    this.reconcile(false);
    // A pending init() stops after this reset, so with no banner mounted yet the reset itself
    // leaves the banner pending for the component that mounts later.
    this.requestBanner();
  }

  /**
   * Whether tracking calls are suppressed: the visitor's choice leaves analytics off. Before any
   * choice, advanced mode sends events under the Consent Mode defaults (cookieless pings);
   * basic mode sends nothing until the visitor allows analytics (a grant implied by the
   * jurisdiction is never stored there, so it is no choice).
   *
   * In basic mode the choice may have changed in another tab since this page last pushed
   * consent (the cookie is shared): the Google tag is brought in line with it first, so a grant
   * made elsewhere loads the tag here, a withdrawal made elsewhere stops it, and a change of
   * marketing alone updates the ad signals (the four signals follow analytics and marketing).
   */
  private analyticsSuppressed(): boolean {
    if (!this.basicMode) {
      const consent = this.choiceInEffect();
      return consent !== null && !consent.categories.analytics;
    }
    return !this.syncFromOutside();
  }

  /**
   * Track a page view manually (for SPA navigation).
   * Skips sending if analytics consent is explicitly denied.
   * Before user makes a choice, page views are sent under Consent Mode defaults (cookieless pings).
   */
  trackPageView(path: string, title?: string): void {
    if (this.basicMode) {
      // The page in view is measured once the visitor allows analytics. It replaces a view held
      // for a page already left, and a grant found by the check below sends it (or the tag's
      // first page view covers it), so it is not sent a second time here.
      this.pendingPageView = { path, title };
      if (this.analyticsSuppressed() || this.pendingPageView === null) return;
      this.pendingPageView = null;
    } else if (this.analyticsSuppressed()) {
      return;
    }
    gtagTrackPageView(path, title);
  }

  /**
   * Track a custom event (GA4 recommended events, ecommerce, or custom).
   * Skips sending if analytics consent is explicitly denied.
   * Before user makes a choice, events are sent under Consent Mode defaults (cookieless pings).
   *
   * @param eventName - GA4 event name (e.g., 'sign_up', 'purchase', 'add_to_cart')
   * @param params - Event parameters
   *
   * @example
   * ```typescript
   * manager.trackEvent('sign_up', { method: 'email' });
   * manager.trackEvent('purchase', { transaction_id: 'T_123', value: 99.99, currency: 'USD', items: [...] });
   * ```
   */
  trackEvent(eventName: string, params?: Record<string, unknown>): void {
    if (this.analyticsSuppressed()) return;
    gtagTrackEvent(eventName, params);
  }

  // --- Typed GA4 Ecommerce Helpers ---
  // Cast to Record<string, unknown> is intentional: these methods provide strict
  // compile-time types for GA4 params while trackEvent() stays flexible for custom events.
  // The cast is safe because GA4 params are plain objects compatible with gtag().

  /**
   * Track a purchase event with typed parameters.
   * @see https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
   */
  trackPurchase(params: GA4PurchaseParams): void {
    this.trackEvent("purchase", params as unknown as Record<string, unknown>);
  }

  /**
   * Track add_to_cart event.
   */
  trackAddToCart(params: GA4EcommerceParams): void {
    this.trackEvent("add_to_cart", params as unknown as Record<string, unknown>);
  }

  /**
   * Track begin_checkout event.
   */
  trackBeginCheckout(params: GA4EcommerceParams): void {
    this.trackEvent("begin_checkout", params as unknown as Record<string, unknown>);
  }

  /**
   * Track view_item event.
   */
  trackViewItem(params: GA4EcommerceParams): void {
    this.trackEvent("view_item", params as unknown as Record<string, unknown>);
  }

  /**
   * Track view_item_list event.
   */
  trackViewItemList(
    params: Omit<GA4EcommerceParams, "value"> & { item_list_id?: string; item_list_name?: string }
  ): void {
    this.trackEvent("view_item_list", params as unknown as Record<string, unknown>);
  }

  /**
   * Track select_item event (click on product in list).
   */
  trackSelectItem(
    params: Omit<GA4EcommerceParams, "value"> & { item_list_id?: string; item_list_name?: string }
  ): void {
    this.trackEvent("select_item", params as unknown as Record<string, unknown>);
  }

  /**
   * Track add_shipping_info event.
   */
  trackAddShippingInfo(params: GA4EcommerceParams & { shipping_tier?: string }): void {
    this.trackEvent("add_shipping_info", params as unknown as Record<string, unknown>);
  }

  /**
   * Track add_payment_info event.
   */
  trackAddPaymentInfo(params: GA4EcommerceParams & { payment_type?: string }): void {
    this.trackEvent("add_payment_info", params as unknown as Record<string, unknown>);
  }

  /**
   * Track sign_up event.
   * @param method - Registration method (e.g., 'email', 'google', 'facebook')
   */
  trackSignUp(method?: string): void {
    this.trackEvent("sign_up", method ? { method } : undefined);
  }

  /**
   * Track login event.
   * @param method - Login method (e.g., 'email', 'google', 'facebook')
   */
  trackLogin(method?: string): void {
    this.trackEvent("login", method ? { method } : undefined);
  }

  /**
   * Track generate_lead event (form submission, contact request).
   */
  trackGenerateLead(params?: GA4GenerateLeadParams): void {
    this.trackEvent("generate_lead", params as Record<string, unknown> | undefined);
  }

  /**
   * Check if consent manager has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if user is detected as EU
   */
  isEUUser(): boolean | null {
    return this.isEU;
  }

  /**
   * Check if user is in a CCPA-covered US state (California, Virginia, Colorado, etc.).
   * Returns true only if ccpaEnabled is true in config and user is in a covered region.
   * Matching is case-insensitive to handle variations in geo API responses.
   */
  isCCPAUser(): boolean {
    if (!this.config.ccpaEnabled) return false;
    if (!this.geoResult) return false;
    if (this.geoResult.countryCode !== "US") return false;
    const region = this.geoResult.region?.toLowerCase() ?? "";
    return CCPA_REGIONS.has(region);
  }

  /**
   * Get the region/state detected for the user.
   * Returns undefined if region detection has not run or region is not available.
   */
  getRegion(): string | undefined {
    return this.geoResult?.region;
  }

  /**
   * Get geo-detection result (countryCode, region, method, isEU).
   * Returns null if geo detection has not run yet.
   * Note: When consent is restored from cookie, this returns the stored geo result.
   */
  getGeoResult(): GeoDetectionResult | null {
    return this.geoResult;
  }

  /**
   * Get geo-detection log showing all methods attempted with their results.
   * Useful for debugging geo-detection issues in the debug panel.
   * Returns empty array if geo detection has not run yet.
   */
  getGeoDetectionLog(): GeoDetectionLogEntry[] {
    return this.geoDetectionLog;
  }

  /**
   * Get configuration
   */
  getConfig(): ConsentConfig {
    return this.config;
  }

  /**
   * Register router tracking cleanup function.
   * Called internally by setupRouterTracking when used with the Vue plugin.
   * @internal
   */
  setRouterCleanup(cleanup: (() => void) | null): void {
    // Call previous cleanup before overwriting (in case router tracking is re-initialized)
    this.routerCleanup?.();
    this.routerCleanup = cleanup;
  }

  /**
   * Clean up resources (script blocker observer, router tracking, etc.).
   * Call when unmounting the app.
   */
  destroy(): void {
    this.destroyed = true;
    this.scriptBlockerCleanup?.();
    this.scriptBlockerCleanup = null;
    this.tabWatchCleanup?.();
    this.tabWatchCleanup = null;

    this.routerCleanup?.();
    this.routerCleanup = null;

    this.consentChangeListeners.length = 0;
    this.showBannerCallback = null;
    this.hideBannerCallback = null;
    this.showPreferenceCenterCallback = null;
    this.hidePreferenceCenterCallback = null;
  }
}

/**
 * Create a new ConsentManager instance
 */
export function createConsentManager(config: ConsentConfig = {}): ConsentManager {
  return new ConsentManager(config);
}
