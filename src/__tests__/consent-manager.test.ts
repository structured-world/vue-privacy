// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { ConsentManager, CCPA_REGIONS } from "../core/consent-manager";
import { clearConsentUid, setConsentUid, siteConsentUid } from "../core/storage";
import type { GeoDetectionResult } from "../core/types";

/**
 * Remote storage whose first `pending` writes wait until the test settles them, in call order;
 * later writes resolve to `id` at once.
 */
function pendingWrites(pending: number, id: string) {
  const settle: Array<(id: string) => void> = [];
  const set = vi.fn();
  for (let i = 0; i < pending; i++) {
    set.mockImplementationOnce(() => new Promise<string>((resolve) => settle.push(resolve)));
  }
  set.mockResolvedValue(id);
  return { storage: { get: vi.fn().mockResolvedValue(null), set }, settle };
}

/** The record ID the first grant on a page in a consent jurisdiction writes to. */
async function recordOfFirstGrant(storage: { get: Mock; set: Mock }) {
  const manager = new ConsentManager({
    storage,
    geoDetector: createMockGeoDetector(true),
    version: "1.0",
  });
  await manager.init();
  await manager.acceptAll();
  await vi.waitFor(() => expect(storage.set).toHaveBeenCalledTimes(1));
  return storage.set.mock.calls[0][0];
}

/**
 * A grant restored with consent_uid=record-a, then a new choice whose write to record-a is still
 * running (the first of `pending` writes that wait for the test).
 */
async function writeInFlightToRecordA(pending: number, laterId: string) {
  const grant = {
    categories: { analytics: true, marketing: true, functional: true },
    timestamp: Date.now(),
    version: "1.0",
    consentRequired: true,
  };
  cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(grant))}; consent_uid=record-a`;
  const { storage, settle } = pendingWrites(pending, laterId);
  const manager = new ConsentManager({
    storage,
    geoDetector: createMockGeoDetector(true),
    version: "1.0",
  });
  await manager.init();
  await manager.savePreferences({ analytics: true, marketing: false, functional: true });
  await vi.waitFor(() => expect(storage.set).toHaveBeenCalledTimes(1));
  return { manager, storage, settle, grant };
}

/**
 * A visitor with a remote grant under consent_uid=account, now in a consent jurisdiction: init()
 * does not restore the grant and the banner asks.
 */
async function roamingVisitor(writtenId: string) {
  cookieStore = "consent_uid=account";
  const storage = {
    get: vi.fn().mockResolvedValue({
      categories: { analytics: true, marketing: true, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    }),
    set: vi.fn().mockResolvedValue(writtenId),
  };
  const manager = new ConsentManager({
    storage,
    geoDetector: createMockGeoDetector(true),
    version: "1.0",
  });
  await manager.init();
  return { manager, storage };
}

async function restoreLinkedRefusal() {
  const refusal = {
    categories: { analytics: false, marketing: false, functional: false },
    timestamp: Date.now(),
    version: "1.0",
    consentRequired: true,
  };
  cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(refusal))}; consent_uid=old-identity`;
  const mockStorage = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("new-identity"),
  };
  const manager = new ConsentManager({
    storage: mockStorage,
    geoDetector: createMockGeoDetector(true),
    version: "1.0",
  });
  await manager.init();
  return { refusal, mockStorage, manager };
}

function createMockGeoDetector(consentRequired = false, countryCode?: string, region?: string) {
  return {
    detect: vi.fn().mockResolvedValue({
      consentRequired,
      countryCode,
      region,
      method: "manual" as const,
    }),
  };
}

// Mock document.cookie
let cookieStore = "";

beforeEach(() => {
  cookieStore = "";
  Object.defineProperty(document, "cookie", {
    get: () => cookieStore,
    set: (value: string) => {
      const [nameValue] = value.split(";");
      const [name] = nameValue.split("=");
      // A deletion is an expiry in the past; the value itself may contain "1970" (a timestamp).
      if (/;\s*expires=Thu, 01 Jan 1970/i.test(value)) {
        const cookies = cookieStore
          .split(";")
          .map((c) => c.trim())
          .filter((c) => c && !c.startsWith(`${name}=`));
        cookieStore = cookies.join("; ");
      } else {
        const cookies = cookieStore
          .split(";")
          .map((c) => c.trim())
          .filter((c) => c && !c.startsWith(`${name}=`));
        cookies.push(nameValue);
        cookieStore = cookies.join("; ");
      }
    },
    configurable: true,
  });

  // Reset script tags (gtag)
  document.head.innerHTML = "";
  vi.restoreAllMocks();
  // An ID a test set with setConsentUid() would count as this page's for the next test: start
  // each from a site that has set none.
  clearConsentUid();
  cookieStore = "";
});

describe("ConsentManager with remote storage", () => {
  it("pushes consent to remote storage on acceptAll", async () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("generated-uuid"),
    };

    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });

    await manager.init();
    await manager.acceptAll();

    // Wait for fire-and-forget promise
    await vi.waitFor(() => {
      expect(mockStorage.set).toHaveBeenCalledTimes(1);
    });

    const [uid, consent] = mockStorage.set.mock.calls[0];
    expect(uid).toBeNull(); // first time, no userId
    expect(consent.categories.analytics).toBe(true);
    expect(consent.categories.marketing).toBe(true);
    expect(consent.version).toBe("1.0");
  });

  it("does not set consent_uid cookie on rejectAll", async () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("reject-uuid"),
    };

    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: {
        detect: vi.fn().mockResolvedValue({ consentRequired: true, method: "manual" }),
      },
      version: "1.0",
    });

    await manager.init();
    await manager.rejectAll();

    await vi.waitFor(() => {
      expect(mockStorage.set).toHaveBeenCalledTimes(1);
    });

    // The refusal is stored in the consent cookie; consent_uid is kept for grants only.
    expect(cookieStore).not.toContain("consent_uid");
    expect(manager.getConsent()?.categories.analytics).toBe(false);
  });

  it("replaces an earlier grant when the visitor rejects all", async () => {
    // Regression: the next page load restored "accept all" for a visitor who had withdrawn.
    const manager = new ConsentManager({ geoDetector: createMockGeoDetector(true) });

    await manager.init();
    await manager.acceptAll();
    expect(manager.getConsent()?.categories.analytics).toBe(true);

    await manager.rejectAll();

    // Functional is optional too (chat widgets, A/B testing): rejecting all refuses it as well.
    expect(manager.hasConsent()).toBe(true);
    expect(manager.getConsent()?.categories).toEqual({
      analytics: false,
      marketing: false,
      functional: false,
    });
  });

  it.each([
    ["rejectAll()", (m: ConsentManager) => m.rejectAll()],
    [
      "savePreferences() with every optional category off",
      (m: ConsentManager) => m.savePreferences({ analytics: false, marketing: false }),
    ],
  ])("remembers a refusal on the next page after %s", async (_name, refuse) => {
    // A refusal is stored like a grant: the banner does not ask again on every page.
    const first = new ConsentManager({ geoDetector: createMockGeoDetector(true, "DE") });
    await first.init();
    await refuse(first);

    const showBanner = vi.fn();
    const next = new ConsentManager({ geoDetector: createMockGeoDetector(true, "DE") });
    next.onShowBanner(showBanner);
    await next.init();

    expect(showBanner).not.toHaveBeenCalled();
    expect(next.getConsent()?.categories.analytics).toBe(false);
  });

  it("keeps a CCPA opt-out on the next page instead of granting again", async () => {
    // Regression: the opt-out was not stored, so the next page granted everything silently and
    // stored that grant (California Civil Code 1798.135(c)(4): the opt-out must be honoured).
    const californian = () =>
      new ConsentManager({
        ccpaEnabled: true,
        geoDetector: createMockGeoDetector(false, "US", "CA"),
      });
    const first = californian();
    await first.init();
    await first.savePreferences({ analytics: false, marketing: false });

    const next = californian();
    await next.init();

    expect(next.getConsent()?.categories.analytics).toBe(false);
    expect(next.getConsent()?.categories.marketing).toBe(false);
  });

  it("keeps a CCPA opt-out made in a consent callback during init()", async () => {
    // Regression: init() stored the silent grant after the callbacks ran, overwriting an
    // opt-out the site made in response to that grant, so the next page tracked again.
    let first: ConsentManager | null = null;
    first = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "CA"),
      onConsentChange: (consent) => {
        if (consent.categories.analytics) void first?.rejectAll();
      },
    });
    await first.init();

    const next = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "CA"),
    });
    await next.init();
    expect(next.getConsent()?.categories.analytics).toBe(false);
  });

  it("does not restore consent_uid when a grant's remote write completes after a withdrawal", async () => {
    // Regression: the grant's pending remote write finished after the visitor rejected and
    // wrote its consent_uid back, so the next visit could fetch the withdrawn grant.
    let finishGrant: (id: string) => void = () => {};
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi
        .fn()
        .mockImplementationOnce(() => new Promise<string>((resolve) => (finishGrant = resolve)))
        .mockResolvedValue(null),
    };
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });

    await manager.init();
    await manager.acceptAll();
    await manager.rejectAll();
    finishGrant("granted-uid");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(cookieStore).not.toContain("consent_uid");
  });

  it("drops consent_uid on withdrawal so a failed remote write cannot restore the grant", async () => {
    // Regression: the withdrawal cleared the local cookie but kept consent_uid; when the remote
    // write of the refusal failed, the next non-EU visit fetched the old remote grant by uid.
    const remoteGrant = {
      categories: { analytics: true, marketing: true, functional: true },
      timestamp: Date.now(),
      version: "1.0",
    };
    const mockStorage = {
      get: vi.fn().mockResolvedValue(remoteGrant),
      set: vi.fn().mockResolvedValue("granted-uid"),
    };
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });

    await manager.init();
    await manager.acceptAll();
    await vi.waitFor(() => expect(cookieStore).toContain("consent_uid=granted-uid"));

    mockStorage.set.mockRejectedValue(new Error("Network error"));
    await manager.rejectAll();
    expect(cookieStore).not.toContain("consent_uid");

    const nextVisit = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(false),
      version: "1.0",
    });
    mockStorage.get.mockClear();
    await nextVisit.init();

    expect(mockStorage.get).not.toHaveBeenCalled();
    expect(nextVisit.getConsent()?.categories.analytics).toBe(false);
  });

  it("restores consent from remote storage when consent_uid cookie exists", async () => {
    // Simulate returning user with consent_uid cookie
    cookieStore = "consent_uid=existing-user-id";

    const mockStorage = {
      get: vi.fn().mockResolvedValue({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: Date.now(),
        version: "1.0",
      }),
      set: vi.fn().mockResolvedValue(null),
    };

    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(false), // Not in EU
      version: "1.0",
    });

    await manager.init();

    // Remote storage was queried with the uid
    expect(mockStorage.get).toHaveBeenCalledWith("existing-user-id", "1.0");

    // Consent was restored
    const consent = manager.getConsent();
    expect(consent).not.toBeNull();
    expect(consent!.categories.analytics).toBe(true);
  });

  // A site links devices by giving them one consent_uid (the signed-in account's ID) before
  // init(). Regression: with a local choice on the device, init() restored it from the cookie and
  // never took the ID, so the next choice created a new remote record instead of updating the
  // shared one, and the other device never saw it.
  it.each([
    ["a grant", true],
    ["a refusal", false],
  ])(
    "writes the next choice to a shared consent_uid when %s is stored locally",
    async (_, granted) => {
      const local = {
        categories: { analytics: granted, marketing: granted, functional: granted },
        timestamp: Date.now(),
        version: "1.0",
        consentRequired: true,
      };
      cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(local))}; consent_uid=shared-account`;
      const mockStorage = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue("shared-account"),
      };
      const manager = new ConsentManager({
        storage: mockStorage,
        geoDetector: createMockGeoDetector(true),
        version: "1.0",
      });

      await manager.init();
      await (granted ? manager.rejectAll() : manager.acceptAll());

      await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
      expect(mockStorage.set.mock.calls[0][0]).toBe("shared-account");
    }
  );

  // A refusal clears consent_uid. When a consent callback replaces it at once with a grant, the
  // refusal's write is dropped, and the grant must still go to the shared record the refusal took
  // over, not to a new one.
  it("keeps the shared ID when a callback replaces a refusal", async () => {
    const local = {
      categories: { analytics: true, marketing: true, functional: true },
      timestamp: Date.now(),
      version: "1.0",
      consentRequired: true,
    };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(local))}; consent_uid=shared-account`;
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("shared-account"),
    };
    let replaced = false;
    const manager: ConsentManager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
      onConsentChange: (consent) => {
        if (consent.categories.analytics || replaced) return;
        replaced = true;
        void manager.acceptAll();
      },
    });

    await manager.init();
    await manager.rejectAll();

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalled());
    expect(mockStorage.set.mock.calls.map((call) => call[0])).toEqual(["shared-account"]);
    expect(mockStorage.set.mock.calls[0][1].categories.analytics).toBe(true);
  });

  // A choice made before init() is supported too; its write must also go to the shared ID.
  it("writes a choice made before init() to a shared consent_uid", async () => {
    cookieStore = "consent_uid=shared-account";
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("shared-account"),
    };
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });

    await manager.acceptAll();
    // The write runs before init() is ever called.
    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
    await manager.init();

    expect(mockStorage.set.mock.calls[0][0]).toBe("shared-account");
  });

  // Another tab's reset clears both cookies while this page checks the location of a choice
  // made outside consent jurisdictions; the ID it read before must not come back with the next
  // choice, or the record the reset abandoned is written to again.
  it("forgets the ID another tab's reset cleared during init()", async () => {
    const local = {
      categories: { analytics: true, marketing: true, functional: true },
      timestamp: Date.now(),
      version: "1.0",
      consentRequired: false,
    };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(local))}; consent_uid=old-identity`;
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("new-identity"),
    };
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: {
        detect: vi.fn().mockImplementation(async () => {
          // The other tab resets while the lookup runs.
          cookieStore = "";
          return { consentRequired: true, method: "manual" as const };
        }),
      },
      version: "1.0",
    });

    await manager.init();
    await manager.acceptAll();

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
    expect(mockStorage.set.mock.calls[0][0]).toBeNull();
  });

  // After init(), a page holding a record ID (here kept from a restored refusal) must drop it
  // when another tab resets: the next choice starts a new record, not the abandoned one.
  it("forgets the record ID after another tab's reset", async () => {
    const local = {
      categories: { analytics: false, marketing: false, functional: false },
      timestamp: Date.now(),
      version: "1.0",
      consentRequired: true,
    };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(local))}; consent_uid=old-identity`;
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("new-identity"),
    };
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });
    await manager.init();

    // Another tab resets: both cookies go.
    cookieStore = "";
    await manager.acceptAll();

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
    expect(mockStorage.set.mock.calls[0][0]).toBeNull();
  });

  // Another tab reset and chose again since this page restored a refusal: the cookie names that
  // tab's new record now, and this page's next choice must update it, not the abandoned one.
  it("writes to the record another tab started after its reset", async () => {
    const { refusal, mockStorage, manager } = await restoreLinkedRefusal();

    // Another tab resets, then grants: both cookies are back, naming its new record.
    const grant = {
      ...refusal,
      categories: { analytics: true, marketing: true, functional: true },
      timestamp: Date.now() + 1,
    };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(grant))}; consent_uid=new-identity`;
    await manager.rejectAll();

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
    expect(mockStorage.set.mock.calls[0][0]).toBe("new-identity");
  });

  // A refusal restored with a signed-in account's ID keeps that ID once its cookie is gone. When
  // the site then signs the visitor out with clearConsentUid(), the next choice must not write
  // to the account's record.
  it("drops a kept ID when the site clears consent_uid", async () => {
    const refusal = {
      categories: { analytics: false, marketing: false, functional: false },
      timestamp: Date.now(),
      version: "1.0",
      consentRequired: true,
    };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(refusal))}; consent_uid=account`;
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("anonymous"),
    };
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });
    await manager.init();

    clearConsentUid();
    await manager.acceptAll();

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
    expect(mockStorage.set.mock.calls[0][0]).toBeNull();
  });

  // A grant restored with a signed-in account's ID, then another tab signs out: its
  // clearConsentUid() removes consent_uid but cannot tell this page, and the consent cookie is
  // unchanged. The next choice here must not write the signed-out visitor's preferences to the
  // account's record.
  it("drops a kept ID when another tab clears consent_uid", async () => {
    const grant = {
      categories: { analytics: true, marketing: true, functional: true },
      timestamp: Date.now(),
      version: "1.0",
      consentRequired: true,
    };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(grant))}; consent_uid=account`;
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("anonymous"),
    };
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });
    await manager.init();

    // The other tab's sign-out: only the cookie goes, this page's module state stays.
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(grant))}`;
    await manager.savePreferences({ analytics: true, marketing: false, functional: true });

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
    expect(mockStorage.set.mock.calls[0][0]).toBeNull();
  });

  // A refusal restored with an account's ID removed consent_uid itself, so the cookie says
  // nothing when another tab signs out. That tab's clearConsentUid() must still reach this page:
  // the next grant here must not go to the account's record.
  it("drops a kept ID of a refusal when another tab signs out", async () => {
    const { mockStorage, manager } = await restoreLinkedRefusal();
    const before = siteConsentUid().revision;

    // Another tab: its own instance of the storage module.
    vi.resetModules();
    const otherTab = await import("../core/storage");
    otherTab.clearConsentUid();
    await vi.waitFor(() => expect(siteConsentUid().revision).not.toBe(before));
    await manager.acceptAll();

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
    expect(mockStorage.set.mock.calls[0][0]).toBeNull();
  });

  // An anonymous refusal's write creates a record while a newer grant waits behind it. The grant
  // updates that record, and its consent_uid must name it, so later pages and tabs reuse it.
  it("keeps consent_uid for a grant that updates the record a refusal created", async () => {
    const { storage, settle } = pendingWrites(1, "record-x");
    const manager = new ConsentManager({
      storage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });
    await manager.init();
    await manager.rejectAll();
    await vi.waitFor(() => expect(storage.set).toHaveBeenCalledTimes(1));
    await manager.acceptAll();

    settle[0]("record-x");
    await vi.waitFor(() => expect(storage.set).toHaveBeenCalledTimes(2));
    expect(storage.set.mock.calls[1][0]).toBe("record-x");
    await vi.waitFor(() => expect(cookieStore).toContain("consent_uid=record-x"));
  });

  // The site signs out, but its clearConsentUid() does not reach the cookie (blocked writes, or a
  // cookie of another path). The old account's ID the cookie still shows is no longer the
  // visitor's: the next choice must not write to that record.
  it("lets a sign-out win over a consent_uid it could not remove", async () => {
    const { manager, storage } = await roamingVisitor("anonymous");
    const cookie = Object.getOwnPropertyDescriptor(document, "cookie")!;
    Object.defineProperty(document, "cookie", {
      get: cookie.get,
      set: (value: string) => {
        if (!value.startsWith("consent_uid=")) cookie.set!.call(document, value);
      },
      configurable: true,
    });
    cookieStore = `${cookieStore}; consent_uid=account`;
    try {
      clearConsentUid();
    } finally {
      Object.defineProperty(document, "cookie", cookie);
    }
    await manager.acceptAll();

    await vi.waitFor(() => expect(storage.set).toHaveBeenCalledTimes(1));
    expect(storage.set.mock.calls[0][0]).toBeNull();
  });

  // Two apps on one origin keep their consent under different cookie paths. A sign-in in the
  // app under /a must not reach the app under /b, which cannot read that app's consent_uid.
  it("ignores a sign-in another tab makes for a different cookie path", async () => {
    const storage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("anonymous"),
    };
    const manager = new ConsentManager({
      storage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
      cookie: { path: "/b" },
    });
    await manager.init();
    const before = siteConsentUid().revision;

    vi.resetModules();
    const otherApp = await import("../core/storage");
    otherApp.setConsentUid("account-a", { cookie: { path: "/a" } });
    // That cookie belongs to /a: pages under /b never see it.
    cookieStore = "";
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(siteConsentUid().revision).toBe(before);

    await manager.acceptAll();
    await vi.waitFor(() => expect(storage.set).toHaveBeenCalledTimes(1));
    expect(storage.set.mock.calls[0][0]).toBeNull();
  });

  // init() checks a choice made outside consent jurisdictions against the location. While that
  // runs, another tab saves a choice made in one, in the same millisecond. The location check
  // must take it for a new choice (its revision differs) and keep it, not clear it.
  it("keeps another tab's choice of the same millisecond made during the roaming check", async () => {
    const timestamp = Date.now();
    const outside = {
      categories: { analytics: true, marketing: true, functional: true },
      timestamp,
      version: "1.0",
      consentRequired: false,
      revision: "outside",
    };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(outside))}`;
    let locate: (value: GeoDetectionResult) => void = () => {};
    const manager = new ConsentManager({
      geoDetector: {
        detect: vi.fn(() => new Promise<GeoDetectionResult>((resolve) => (locate = resolve))),
      },
      version: "1.0",
    });
    const init = manager.init();

    const otherTab = {
      categories: { analytics: false, marketing: false, functional: false },
      timestamp,
      version: "1.0",
      consentRequired: true,
      revision: "other-tab",
    };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(otherTab))}`;
    locate({ consentRequired: true, method: "manual" });
    await init;

    expect(cookieStore).toContain("other-tab");
    expect(manager.getConsent()?.revision).toBe("other-tab");
  });

  // This tab is in a consent jurisdiction; another tab that has not noticed the move saves a
  // grant made outside one in the same millisecond as this page's choice. The roaming rule
  // rejects that grant here: it must not pass for this page's own choice by its time alone.
  it("does not take another tab's same-millisecond grant for this page's choice", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });
    await manager.init();
    await manager.rejectAll();
    const own = manager.getConsent()!;

    const otherTab = {
      categories: { analytics: true, marketing: true, functional: true },
      timestamp: own.timestamp,
      version: "1.0",
      consentRequired: false,
      revision: "other-tab",
    };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(otherTab))}`;

    expect(manager.getConsent()).toBeNull();
  });

  // In a sandboxed frame with an opaque origin the browser exposes BroadcastChannel but its
  // constructor throws. The manager must still be created, without cross-tab sign-outs.
  it("works where BroadcastChannel cannot be created", async () => {
    vi.stubGlobal(
      "BroadcastChannel",
      class {
        constructor() {
          throw new DOMException("opaque origin", "SecurityError");
        }
      }
    );
    try {
      vi.resetModules();
      const framed = await import("../core/consent-manager");
      const framedStorage = await import("../core/storage");
      const storage = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue("anonymous"),
      };
      const manager = new framed.ConsentManager({
        storage,
        geoDetector: createMockGeoDetector(true),
        version: "1.0",
      });
      expect(() => framedStorage.clearConsentUid()).not.toThrow();
      await manager.init();
      await manager.acceptAll();
      await vi.waitFor(() => expect(storage.set).toHaveBeenCalledTimes(1));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // With cookie.path set, a client-side route outside it cannot see consent_uid. A choice made
  // there must still update the record the page saw on a route inside the path.
  it("keeps the record ID on a route outside cookie.path", async () => {
    const grant = {
      categories: { analytics: true, marketing: true, functional: true },
      timestamp: Date.now(),
      version: "1.0",
      consentRequired: true,
    };
    window.history.pushState({}, "", "/app/page");
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(grant))}; consent_uid=account`;
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("account"),
    };
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
      cookie: { path: "/app" },
    });
    try {
      await manager.init();

      // The route leaves /app: the browser no longer sends either cookie to this page.
      window.history.pushState({}, "", "/other");
      cookieStore = "";
      await manager.rejectAll();

      await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
      expect(mockStorage.set.mock.calls[0][0]).toBe("account");
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  // Another tab reset and then refused: the consent cookie is back, consent_uid is not. That
  // decision replaced the one this page kept an ID for, so the ID may name the record the reset
  // abandoned, and the next choice must not write to it.
  it("drops a kept ID once another tab's decision replaced this page's", async () => {
    const { refusal, mockStorage, manager } = await restoreLinkedRefusal();

    // Another tab resets, then refuses: a new consent cookie, no consent_uid.
    const later = { ...refusal, timestamp: Date.now() + 1 };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(later))}`;
    await manager.acceptAll();

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
    expect(mockStorage.set.mock.calls[0][0]).toBeNull();
  });

  it("drops an abandoned ID when the replacement refusal has the same timestamp", async () => {
    // Timer quantization must not make another tab's reset-and-refusal the old identity.
    const { refusal, mockStorage, manager } = await restoreLinkedRefusal();
    vi.spyOn(Date, "now").mockReturnValue(refusal.timestamp);
    cookieStore = "";
    const other = new ConsentManager({ geoDetector: createMockGeoDetector(true), version: "1.0" });
    await other.rejectAll();
    await manager.acceptAll();
    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
    expect(mockStorage.set.mock.calls[0][0]).toBeNull();
  });

  // After a sign-in on a route outside cookie.path, the ID the site sets cannot be read back on
  // that route. The next choice must still go to it.
  it("writes to an ID the site set on a route outside cookie.path", async () => {
    window.history.pushState({}, "", "/other");
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("account"),
    };
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
      cookie: { path: "/app" },
    });
    try {
      await manager.init();

      setConsentUid("account", { cookie: { path: "/app" } });
      // The browser does not show the new cookie on this route.
      cookieStore = "";
      await manager.acceptAll();

      await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
      expect(mockStorage.set.mock.calls[0][0]).toBe("account");
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  // The site may set the ID before it creates the manager, also on a route that cannot read it
  // back: the next choice must still go to it.
  it("writes to an ID the site set before creating the manager", async () => {
    window.history.pushState({}, "", "/other");
    setConsentUid("account", { cookie: { path: "/app" } });
    // The browser does not show the cookie on this route.
    cookieStore = "";
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("account"),
    };
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
      cookie: { path: "/app" },
    });
    try {
      await manager.init();
      await manager.acceptAll();

      await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
      expect(mockStorage.set.mock.calls[0][0]).toBe("account");
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  // A choice's record is fixed when it is made. A consent callback that signs the visitor in
  // (setConsentUid()) reacts to that choice; the choice's write must not go to the new account.
  it("writes an anonymous choice to no account a consent callback sets", async () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("anonymous"),
    };
    let signedIn = false;
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
      onConsentChange: (consent) => {
        if (!consent.categories.analytics || signedIn) return;
        signedIn = true;
        setConsentUid("account");
      },
    });
    await manager.init();
    await manager.acceptAll();

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
    expect(mockStorage.set.mock.calls[0][0]).toBeNull();
  });

  // An older write may settle after the site signed in and a newer choice kept the account's ID
  // (on a route outside cookie.path, where the cookie cannot tell). Its record is the one before
  // the sign-in, so a later choice must still go to the account.
  it("keeps the account a newer choice took over an older write's record", async () => {
    window.history.pushState({}, "", "/other");
    const { storage: mockStorage, settle } = pendingWrites(2, "account");
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
      cookie: { path: "/app" },
    });
    try {
      await manager.init();
      await manager.acceptAll();
      await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));

      setConsentUid("account", { cookie: { path: "/app" } });
      // The browser does not show the cookie on this route.
      cookieStore = "";
      await manager.rejectAll();
      // The first write settles now, with the record it created before the sign-in.
      settle[0]("anonymous");
      await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(2));
      // A choice while the account's write still runs.
      await manager.acceptAll();
      settle[1]("account");

      await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(3));
      expect(mockStorage.set.mock.calls[2][0]).toBe("account");
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  // A refusal made before init() keeps its record ID; init() then adds the jurisdiction to that
  // same choice in the cookie. That rewrite is this page's own, not another tab's decision, so the
  // next choice must still update the shared record.
  it("keeps the record ID when init() adds the jurisdiction to a choice", async () => {
    cookieStore = "consent_uid=shared-account";
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("shared-account"),
    };
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });
    await manager.rejectAll();
    await manager.init();
    await manager.acceptAll();

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(2));
    expect(mockStorage.set.mock.calls[1][0]).toBe("shared-account");
  });

  // A write to record A runs while another tab resets and starts record B; this page's refusal
  // then takes B. When the A write settles before the B write, it must not hand A back as this
  // page's record: a choice made meanwhile would write to the abandoned A.
  it("keeps a newer choice's record when an older write settles", async () => {
    const {
      manager,
      storage: mockStorage,
      settle,
      grant,
    } = await writeInFlightToRecordA(2, "record-b");

    // Another tab resets and grants: record B.
    const other = { ...grant, timestamp: Date.now() + 1 };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(other))}; consent_uid=record-b`;
    await manager.rejectAll();
    settle[0]("record-a");
    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(2));
    // A choice while the B write still runs.
    await manager.acceptAll();
    settle[1]("record-b");

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(3));
    expect(mockStorage.set.mock.calls[2][0]).toBe("record-b");
  });

  // A write to record A runs while another tab resets and refuses; this page's next choice then
  // keeps no record. The A write settling meanwhile must not make A this page's record again, or
  // the queued write updates the record the reset abandoned.
  it("keeps no record when an older write settles after a reset elsewhere", async () => {
    const {
      manager,
      storage: mockStorage,
      settle,
      grant,
    } = await writeInFlightToRecordA(1, "fresh");

    // Another tab resets and refuses: a new consent cookie, no consent_uid.
    const refusal = {
      ...grant,
      categories: { analytics: false, marketing: false, functional: false },
      timestamp: Date.now() + 1,
    };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(refusal))}`;
    await manager.acceptAll();
    settle[0]("record-a");

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(2));
    expect(mockStorage.set.mock.calls[1][0]).toBeNull();
  });

  // An empty consent_uid (setConsentUid(""), or a server's `consent_uid=`) names no record; a
  // write must create one rather than file every such visitor under the empty key.
  it("treats an empty consent_uid as no record", async () => {
    cookieStore = "consent_uid=";
    const record = await recordOfFirstGrant({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("fresh"),
    });
    expect(record).toBeNull();
  });

  // Where cookie writes stop taking effect, an older cookie with the same moment and categories
  // must not pass for the new choice: its revision differs, and the next choice would take it for
  // another tab's decision and drop the linked record.
  it("does not confirm a cookie write by an older choice of the same moment", async () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const refusal = {
      categories: { analytics: false, marketing: false, functional: false },
      timestamp: now,
      version: "1.0",
      consentRequired: true,
      revision: "earlier",
    };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(refusal))}; consent_uid=account`;
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("account"),
    };
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });
    await manager.init();

    // Cookie writes stop taking effect (blocked from here on).
    Object.defineProperty(document, "cookie", {
      get: () => cookieStore,
      set: () => {},
      configurable: true,
    });
    await manager.rejectAll();
    await manager.acceptAll();

    // The refusal's write is superseded before it runs; the grant's write is the one that counts.
    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalled());
    expect(mockStorage.set.mock.calls.at(-1)?.[0]).toBe("account");
  });

  // resetConsent() forgets the visitor's record, also an account ID the site set earlier. A
  // manager created again on the same page (an SPA remount) must not bring that ID back.
  it("does not bring back a reset account in a recreated manager", async () => {
    setConsentUid("account");
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("fresh"),
    };
    const first = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });
    await first.init();
    first.resetConsent();
    first.destroy();

    const second = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });
    await second.init();
    await second.acceptAll();

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
    expect(mockStorage.set.mock.calls[0][0]).toBeNull();
  });

  // A remote record not restored in a consent jurisdiction stays this page's record while the
  // banner asks. Another tab's decision meanwhile (after a reset there) replaces it: the banner's
  // answer must not go to the abandoned record.
  it("drops the record kept for a jurisdiction change once another tab decides", async () => {
    const { manager, storage: mockStorage } = await roamingVisitor("fresh");

    // Another tab resets and refuses.
    const refusal = {
      categories: { analytics: false, marketing: false, functional: false },
      timestamp: Date.now(),
      version: "1.0",
      consentRequired: true,
    };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(refusal))}`;
    await manager.acceptAll();

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
    expect(mockStorage.set.mock.calls[0][0]).toBeNull();
  });

  // The remote record of a visitor now in a consent jurisdiction is not restored: the banner asks
  // and consent_uid goes. The answer must still update that record, or other devices linked to
  // it keep the earlier grant.
  it("writes the answer to the remote record a jurisdiction change did not restore", async () => {
    const { manager, storage: mockStorage } = await roamingVisitor("account");
    expect(manager.getConsent()).toBeNull();

    await manager.rejectAll();

    await vi.waitFor(() => expect(mockStorage.set).toHaveBeenCalledTimes(1));
    expect(mockStorage.set.mock.calls[0][0]).toBe("account");
  });

  // init() looks up the remote record a consent_uid names; another tab's reset clears both
  // cookies while the lookup runs, and it finds nothing. That ID named no adopted record, so the
  // next choice must not write to it.
  it("does not keep a looked-up ID that another tab's reset cleared", async () => {
    cookieStore = "consent_uid=old-identity";
    const record = await recordOfFirstGrant({
      get: vi.fn().mockImplementation(async () => {
        cookieStore = "";
        return null;
      }),
      set: vi.fn().mockResolvedValue("new-identity"),
    });
    expect(record).toBeNull();
  });

  // A cookie value another app or a server wrote raw (`%` is no valid percent-encoding) made
  // decodeURIComponent throw, and init() rejected instead of deciding the consent. An undecodable
  // value counts as absent.
  it("restores the local choice when consent_uid holds an undecodable value", async () => {
    const local = {
      categories: { analytics: true, marketing: false, functional: false },
      timestamp: Date.now(),
      version: "1.0",
      consentRequired: true,
    };
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify(local))}; consent_uid=%`;
    const mockStorage = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });

    await manager.init();

    expect(manager.getConsent()?.categories.analytics).toBe(true);
  });

  it("asks again when consent_preferences holds an undecodable value", async () => {
    cookieStore = "consent_preferences=%";
    const showBanner = vi.fn();
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });
    manager.onShowBanner(showBanner);

    await manager.init();

    expect(manager.getConsent()).toBeNull();
    expect(showBanner).toHaveBeenCalledTimes(1);
  });

  it("blocks remote storage restore and shows banner when user roamed to EU", async () => {
    // User has consent_uid from previous session (consent given outside EU)
    cookieStore = "consent_uid=existing-user-id";

    const mockStorage = {
      get: vi.fn().mockResolvedValue({
        categories: { analytics: true, marketing: true, functional: true },
        timestamp: Date.now(),
        version: "1.0",
      }),
      set: vi.fn().mockResolvedValue(null),
    };

    const showBanner = vi.fn();

    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(true, "DE"), // Now in EU!
      version: "1.0",
    });

    manager.onShowBanner(showBanner);
    await manager.init();

    // Remote storage was queried
    expect(mockStorage.get).toHaveBeenCalledWith("existing-user-id", "1.0");

    // But consent should NOT be restored (user is now in EU)
    expect(manager.hasConsent()).toBe(false);

    // consent_uid should be cleared
    expect(cookieStore).not.toContain("consent_uid");

    // Banner should be shown for GDPR disclosure
    expect(showBanner).toHaveBeenCalledTimes(1);

    // consentRequired should reflect current location
    expect(manager.isConsentRequired()).toBe(true);
  });

  it("handles remote storage errors gracefully", async () => {
    const mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockRejectedValue(new Error("Network error")),
    };

    const manager = new ConsentManager({
      storage: mockStorage,
      geoDetector: createMockGeoDetector(),
      version: "1.0",
    });

    await manager.init();

    // Should not throw
    await manager.acceptAll();

    // Wait for fire-and-forget to complete
    await vi.waitFor(() => {
      expect(mockStorage.set).toHaveBeenCalled();
    });

    // consent_preferences cookie should still be set (local storage works)
    expect(cookieStore).toContain("consent_preferences");
  });

  it("clears consent_uid on resetConsent", async () => {
    cookieStore = "consent_uid=some-uid; consent_preferences={}";

    const manager = new ConsentManager({ version: "1.0" });
    manager.resetConsent();

    expect(cookieStore).not.toContain("consent_uid");
    expect(cookieStore).not.toContain("consent_preferences");
  });
});

describe("ConsentManager banner deferred show (bannerPending)", () => {
  it("fires callback immediately when registered after init() already requested banner", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });

    // init() completes before onShowBanner is registered
    await manager.init();

    const showBanner = vi.fn();
    manager.onShowBanner(showBanner);

    // Callback fires immediately because init() set bannerPending=true
    expect(showBanner).toHaveBeenCalledTimes(1);
  });

  it("fires callback via init() when registered before init()", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(true),
      version: "1.0",
    });

    const showBanner = vi.fn();
    manager.onShowBanner(showBanner);

    // Callback not yet fired — init() hasn't run
    expect(showBanner).not.toHaveBeenCalled();

    await manager.init();

    // init() calls showBannerCallback directly
    expect(showBanner).toHaveBeenCalledTimes(1);
  });

  it("does not fire callback for non-EU user", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(false),
      version: "1.0",
    });

    await manager.init();

    const showBanner = vi.fn();
    manager.onShowBanner(showBanner);

    // Non-EU user: banner never shown, bannerPending stays false
    expect(showBanner).not.toHaveBeenCalled();
  });

  it("does not store consent for non-EU user on init (default state)", async () => {
    // Ensure no cookies exist before test
    cookieStore = "";

    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(false),
      version: "1.0",
    });

    await manager.init();

    // Non-EU user: consent is applied but NOT stored (it's the default state)
    // No consent_preferences cookie should be set
    expect(cookieStore).not.toContain("consent_preferences");

    // But hasConsent() should return false (no stored consent)
    expect(manager.hasConsent()).toBe(false);

    // getConsent() should return null (nothing stored)
    expect(manager.getConsent()).toBeNull();
  });
});

describe("ConsentManager.getGeoResult()", () => {
  it("returns null before init", () => {
    const manager = new ConsentManager({ version: "1.0" });
    expect(manager.getGeoResult()).toBeNull();
  });

  it("returns full geo result for EU user after init", async () => {
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        consentRequired: true,
        countryCode: "DE",
        method: "cloudflare" as const,
      }),
    };

    const manager = new ConsentManager({ geoDetector, version: "1.0" });
    await manager.init();

    const result = manager.getGeoResult();
    expect(result).toEqual({
      consentRequired: true,
      countryCode: "DE",
      method: "cloudflare",
    });
  });

  it("returns full geo result for non-EU user after init", async () => {
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        consentRequired: false,
        countryCode: "US",
        method: "api" as const,
      }),
    };

    const manager = new ConsentManager({ geoDetector, version: "1.0" });
    await manager.init();

    const result = manager.getGeoResult();
    expect(result).toEqual({
      consentRequired: false,
      countryCode: "US",
      method: "api",
    });
  });

  it("restores the jurisdiction from the stored consent cookie (skips geo detection)", async () => {
    // Pre-set consent cookie given in a consent jurisdiction
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        consentRequired: true,
      })
    )}`;

    // Mock geo detector to verify it's NOT called (EU consent fast-path)
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        consentRequired: false,
        countryCode: "US",
        method: "api" as const,
      }),
    };

    const manager = new ConsentManager({ version: "1.0", geoDetector });
    await manager.init();

    // Geo detection should NOT be called for EU consent (fast-path optimization)
    expect(geoDetector.detect).not.toHaveBeenCalled();

    // consentRequired should be restored from cookie
    expect(manager.isConsentRequired()).toBe(true);

    // geoResult comes from the stored choice; the cookie keeps no country
    expect(manager.getGeoResult()).toEqual({ consentRequired: true, method: "stored" });
  });

  it("runs geo detection when consent restored from old cookie without geo data", async () => {
    // Pre-set consent cookie WITHOUT geo data (old format - triggers roaming check)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: Date.now(),
        version: "1.0",
      })
    )}`;

    // Mock geo detector to return non-EU (consent should be kept)
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        consentRequired: false,
        countryCode: "US",
        method: "api" as const,
      }),
    };

    const manager = new ConsentManager({ version: "1.0", geoDetector });
    await manager.init();

    // Geo detection should have run to check for roaming
    expect(geoDetector.detect).toHaveBeenCalled();
    // consentRequired should now reflect current location
    expect(manager.isConsentRequired()).toBe(false);
    expect(manager.getGeoResult()?.countryCode).toBe("US");
  });

  it("clears consent and shows banner when user with legacy cookie roams to EU", async () => {
    // Legacy cookie WITHOUT consentRequired field (pre-roaming-protection format)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: true, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        // No consentRequired field — legacy cookie, triggers roaming check
      })
    )}`;

    // User is now in EU (roaming scenario)
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        consentRequired: true,
        countryCode: "DE",
        method: "cloudflare" as const,
      }),
    };

    const showBanner = vi.fn();
    const manager = new ConsentManager({ version: "1.0", geoDetector });
    manager.onShowBanner(showBanner);
    await manager.init();

    // Consent should be cleared (user needs GDPR-compliant re-consent)
    expect(manager.hasConsent()).toBe(false);
    expect(manager.getConsent()).toBeNull();

    // Banner should be shown for GDPR disclosure
    expect(showBanner).toHaveBeenCalledTimes(1);

    // consentRequired should reflect current location
    expect(manager.isConsentRequired()).toBe(true);
    expect(manager.getGeoResult()?.countryCode).toBe("DE");
  });

  it("keeps consent when user with legacy cookie stays outside EU", async () => {
    // Legacy cookie WITHOUT consentRequired field (pre-roaming-protection format)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        // No consentRequired field — legacy cookie, triggers roaming check
      })
    )}`;

    // User is still outside EU
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        consentRequired: false,
        countryCode: "CA",
        method: "api" as const,
      }),
    };

    const showBanner = vi.fn();
    const manager = new ConsentManager({ version: "1.0", geoDetector });
    manager.onShowBanner(showBanner);
    await manager.init();

    // Consent should be preserved (no GDPR applies)
    expect(manager.hasConsent()).toBe(true);
    const consent = manager.getConsent();
    expect(consent).not.toBeNull();
    expect(consent!.categories.analytics).toBe(true);
    expect(consent!.categories.marketing).toBe(false);

    // Banner should NOT be shown
    expect(showBanner).not.toHaveBeenCalled();

    // consentRequired should reflect current location
    expect(manager.isConsentRequired()).toBe(false);
    expect(manager.getGeoResult()?.countryCode).toBe("CA");
  });

  it("keeps a legacy cookie's consent when geo detection fails with geoFailure 'grant'", async () => {
    // The default ('require-consent') asks again instead; see consent-jurisdiction.test.ts.
    // Legacy cookie WITHOUT consentRequired field (pre-roaming-protection format)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        // No consentRequired field — legacy cookie, triggers roaming check
      })
    )}`;

    // Geo detection fails (network error, API unavailable, etc.)
    const geoDetector = {
      detect: vi.fn().mockRejectedValue(new Error("Network error")),
    };

    const showBanner = vi.fn();
    const manager = new ConsentManager({ version: "1.0", geoDetector, geoFailure: "grant" });
    manager.onShowBanner(showBanner);
    await manager.init();

    // Geo detector WAS called (roaming check attempted)
    expect(geoDetector.detect).toHaveBeenCalled();

    // Consent should be preserved (fail-safe: keep existing consent on error)
    expect(manager.hasConsent()).toBe(true);
    const consent = manager.getConsent();
    expect(consent).not.toBeNull();
    expect(consent!.categories.analytics).toBe(true);
    expect(consent!.categories.marketing).toBe(false);

    // Banner should NOT be shown (fail-safe behavior)
    expect(showBanner).not.toHaveBeenCalled();

    // consentRequired is null because: legacy cookie has no such field to restore from,
    // and geo detection failed. The roaming check returned false (fail-safe),
    // consent was applied, and init() returned early without running main geo flow.
    expect(manager.isConsentRequired()).toBeNull();

    // geoDetectionLog should show the failure
    const log = manager.getGeoDetectionLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log.some((entry) => entry.status === "failed")).toBe(true);
  });

  it("clears consent and shows banner when user with consentRequired=false roams to EU", async () => {
    // User gave consent with explicit consentRequired=false (e.g., CCPA in California)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: true, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        consentRequired: false,
        geoMethod: "api",
        countryCode: "US",
        region: "California",
      })
    )}`;

    // User has now traveled to EU
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        consentRequired: true,
        countryCode: "DE",
        method: "cloudflare" as const,
      }),
    };

    const showBanner = vi.fn();
    const manager = new ConsentManager({ version: "1.0", geoDetector });
    manager.onShowBanner(showBanner);
    await manager.init();

    // Geo detector IS called for roaming check
    expect(geoDetector.detect).toHaveBeenCalled();

    // Consent should be cleared (user is now in EU, needs GDPR disclosure)
    expect(manager.hasConsent()).toBe(false);

    // Banner should be shown
    expect(showBanner).toHaveBeenCalledTimes(1);

    // consentRequired should reflect current location
    expect(manager.isConsentRequired()).toBe(true);
    expect(manager.getGeoResult()?.countryCode).toBe("DE");
  });

  it("keeps consent when user with consentRequired=false stays outside EU", async () => {
    // User gave consent with explicit consentRequired=false (e.g., CCPA in California)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: true, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        consentRequired: false,
        geoMethod: "api",
        countryCode: "US",
        region: "California",
      })
    )}`;

    // User is still outside EU (traveled to Canada)
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        consentRequired: false,
        countryCode: "CA",
        method: "api" as const,
      }),
    };

    const showBanner = vi.fn();
    const manager = new ConsentManager({ version: "1.0", geoDetector });
    manager.onShowBanner(showBanner);
    await manager.init();

    // Geo detector IS called for roaming check
    expect(geoDetector.detect).toHaveBeenCalled();

    // Consent should be preserved (still outside EU)
    expect(manager.hasConsent()).toBe(true);

    // Banner should NOT be shown
    expect(showBanner).not.toHaveBeenCalled();

    // consentRequired should reflect current location
    expect(manager.isConsentRequired()).toBe(false);
    expect(manager.getGeoResult()?.countryCode).toBe("CA");
  });
});

describe("ConsentManager.getGeoDetectionLog()", () => {
  it("returns empty array before init", () => {
    const manager = new ConsentManager({ version: "1.0" });
    expect(manager.getGeoDetectionLog()).toEqual([]);
  });

  it("returns log entry when geo detection runs", async () => {
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        consentRequired: true,
        countryCode: "DE",
        method: "cloudflare" as const,
      }),
    };

    const manager = new ConsentManager({ geoDetector, version: "1.0" });
    await manager.init();

    const log = manager.getGeoDetectionLog();
    expect(log.length).toBe(1);
    expect(log[0].method).toBe("cloudflare");
    expect(log[0].status).toBe("success");
    expect(log[0].result).toEqual({ consentRequired: true, countryCode: "DE" });
  });

  it("restores log entry from the stored jurisdiction", async () => {
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        consentRequired: true,
      })
    )}`;

    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const log = manager.getGeoDetectionLog();
    expect(log.length).toBe(1);
    expect(log[0].method).toBe("stored");
    expect(log[0].status).toBe("success");
    expect(log[0].result).toEqual({ consentRequired: true });
  });
});

// The consent cookie remembers the choice and whether it was made in a consent jurisdiction;
// the location itself is not strictly necessary for that and is not stored.
describe("ConsentManager jurisdiction persistence", () => {
  it("stores the jurisdiction, without the location, when accepting consent", async () => {
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        consentRequired: true,
        countryCode: "IT",
        method: "api" as const,
      }),
    };

    const manager = new ConsentManager({ geoDetector, version: "1.0" });
    await manager.init();
    await manager.acceptAll();

    // Parse the stored consent cookie
    const cookieValue = decodeURIComponent(
      cookieStore.split("consent_preferences=")[1]?.split(";")[0] ?? ""
    );
    const stored = JSON.parse(cookieValue);

    expect(stored.consentRequired).toBe(true);
    expect(stored).not.toHaveProperty("geoMethod");
    expect(stored).not.toHaveProperty("countryCode");
  });

  it("stores the jurisdiction when saving preferences", async () => {
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        consentRequired: true,
        countryCode: "ES",
        method: "worker" as const,
      }),
    };

    const manager = new ConsentManager({ geoDetector, version: "1.0" });
    await manager.init();
    await manager.savePreferences({ analytics: true, marketing: false });

    const cookieValue = decodeURIComponent(
      cookieStore.split("consent_preferences=")[1]?.split(";")[0] ?? ""
    );
    const stored = JSON.parse(cookieValue);

    expect(stored.consentRequired).toBe(true);
    expect(stored).not.toHaveProperty("countryCode");
  });

  it("stores the jurisdiction for a visitor outside who explicitly saves preferences", async () => {
    // Visitors outside consent jurisdictions normally get automatic "accept all" without
    // storing consent. If they save custom preferences, consentRequired=false is persisted, so
    // the next visit runs the roaming check.
    const geoDetector = {
      detect: vi.fn().mockResolvedValue({
        consentRequired: false,
        countryCode: "US",
        method: "api" as const,
      }),
    };

    const manager = new ConsentManager({ geoDetector, version: "1.0" });
    await manager.init();

    // Non-EU user explicitly changes preferences through preference center
    await manager.savePreferences({ analytics: true, marketing: false });

    const cookieValue = decodeURIComponent(
      cookieStore.split("consent_preferences=")[1]?.split(";")[0] ?? ""
    );
    const stored = JSON.parse(cookieValue);

    expect(stored.consentRequired).toBe(false);
    expect(stored).not.toHaveProperty("countryCode");
  });
});

describe("ConsentManager.trackEvent()", () => {
  it("sends event when analytics consent is granted", async () => {
    // Pre-set consent with analytics=true
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify({ categories: { analytics: true, marketing: false, functional: true }, timestamp: Date.now(), version: "1.0" }))}`;

    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    // Mock gtag
    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackEvent("sign_up", { method: "email" });

    expect(gtagCalls).toContainEqual(["event", "sign_up", { method: "email" }]);
  });

  it("does not send event when analytics consent is denied", async () => {
    // Pre-set consent with analytics=false and consentRequired=true (EU consent is valid everywhere)
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify({ categories: { analytics: false, marketing: false, functional: true }, timestamp: Date.now(), version: "1.0", consentRequired: true }))}`;

    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    // Mock gtag
    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackEvent("sign_up", { method: "email" });

    // No event should be sent
    expect(gtagCalls.filter((c) => c[0] === "event" && c[1] === "sign_up")).toHaveLength(0);
  });

  it("sends event without params", async () => {
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify({ categories: { analytics: true, marketing: false, functional: true }, timestamp: Date.now(), version: "1.0" }))}`;

    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackEvent("test_event");

    expect(gtagCalls).toContainEqual(["event", "test_event"]);
  });
});

describe("ConsentManager ecommerce helpers", () => {
  beforeEach(async () => {
    // Pre-set consent with analytics=true
    cookieStore = `consent_preferences=${encodeURIComponent(JSON.stringify({ categories: { analytics: true, marketing: true, functional: true }, timestamp: Date.now(), version: "1.0" }))}`;
  });

  it("trackPurchase sends purchase event with correct params", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackPurchase({
      transaction_id: "ORDER_123",
      currency: "USD",
      value: 99.99,
      shipping: 5.99,
      items: [{ item_id: "SKU_1", item_name: "Widget", price: 99.99, quantity: 1 }],
    });

    const purchaseCall = gtagCalls.find((c) => c[1] === "purchase");
    expect(purchaseCall).toBeDefined();
    expect(purchaseCall![2]).toMatchObject({
      transaction_id: "ORDER_123",
      currency: "USD",
      value: 99.99,
      shipping: 5.99,
    });
  });

  it("trackAddToCart sends add_to_cart event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackAddToCart({
      currency: "USD",
      value: 29.99,
      items: [{ item_id: "SKU_2", item_name: "Gadget", price: 29.99 }],
    });

    const addToCartCall = gtagCalls.find((c) => c[1] === "add_to_cart");
    expect(addToCartCall).toBeDefined();
    expect(addToCartCall![2]).toMatchObject({
      currency: "USD",
      value: 29.99,
    });
  });

  it("trackBeginCheckout sends begin_checkout event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackBeginCheckout({
      currency: "EUR",
      value: 50,
      coupon: "SAVE10",
      items: [{ item_id: "SKU_3", item_name: "Product", price: 50 }],
    });

    const checkoutCall = gtagCalls.find((c) => c[1] === "begin_checkout");
    expect(checkoutCall).toBeDefined();
    expect(checkoutCall![2]).toMatchObject({
      currency: "EUR",
      value: 50,
      coupon: "SAVE10",
    });
  });

  it("trackSignUp sends sign_up event with method", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackSignUp("google");

    const signUpCall = gtagCalls.find((c) => c[1] === "sign_up");
    expect(signUpCall).toBeDefined();
    expect(signUpCall![2]).toEqual({ method: "google" });
  });

  it("trackSignUp sends sign_up event without method", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackSignUp();

    const signUpCall = gtagCalls.find((c) => c[1] === "sign_up");
    expect(signUpCall).toEqual(["event", "sign_up"]);
  });

  it("trackLogin sends login event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackLogin("email");

    const loginCall = gtagCalls.find((c) => c[1] === "login");
    expect(loginCall).toBeDefined();
    expect(loginCall![2]).toEqual({ method: "email" });
  });

  it("trackGenerateLead sends generate_lead event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackGenerateLead({ value: 100, currency: "USD" });

    const leadCall = gtagCalls.find((c) => c[1] === "generate_lead");
    expect(leadCall).toBeDefined();
    expect(leadCall![2]).toMatchObject({
      value: 100,
      currency: "USD",
    });
  });

  it("trackViewItem sends view_item event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackViewItem({
      currency: "USD",
      value: 19.99,
      items: [{ item_id: "SKU_4", item_name: "Book", price: 19.99 }],
    });

    const viewItemCall = gtagCalls.find((c) => c[1] === "view_item");
    expect(viewItemCall).toBeDefined();
  });

  it("trackViewItemList sends view_item_list event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackViewItemList({
      currency: "USD",
      item_list_id: "category_shirts",
      item_list_name: "T-Shirts",
      items: [
        { item_id: "SKU_5", item_name: "Red Shirt", price: 29.99 },
        { item_id: "SKU_6", item_name: "Blue Shirt", price: 29.99 },
      ],
    });

    const call = gtagCalls.find((c) => c[1] === "view_item_list");
    expect(call).toBeDefined();
    expect(call![2]).toMatchObject({
      currency: "USD",
      item_list_id: "category_shirts",
      item_list_name: "T-Shirts",
    });
  });

  it("trackSelectItem sends select_item event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackSelectItem({
      currency: "USD",
      item_list_id: "search_results",
      items: [{ item_id: "SKU_7", item_name: "Selected Product", price: 49.99, index: 3 }],
    });

    const call = gtagCalls.find((c) => c[1] === "select_item");
    expect(call).toBeDefined();
    expect(call![2]).toMatchObject({
      currency: "USD",
      item_list_id: "search_results",
    });
  });

  it("trackAddShippingInfo sends add_shipping_info event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackAddShippingInfo({
      currency: "USD",
      value: 75.0,
      shipping_tier: "Express",
      items: [{ item_id: "SKU_8", item_name: "Laptop Stand", price: 75.0 }],
    });

    const call = gtagCalls.find((c) => c[1] === "add_shipping_info");
    expect(call).toBeDefined();
    expect(call![2]).toMatchObject({
      currency: "USD",
      value: 75.0,
      shipping_tier: "Express",
    });
  });

  it("trackAddPaymentInfo sends add_payment_info event", async () => {
    const manager = new ConsentManager({ version: "1.0" });
    await manager.init();

    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => gtagCalls.push(args);

    manager.trackAddPaymentInfo({
      currency: "EUR",
      value: 120.0,
      payment_type: "Credit Card",
      items: [{ item_id: "SKU_9", item_name: "Headphones", price: 120.0 }],
    });

    const call = gtagCalls.find((c) => c[1] === "add_payment_info");
    expect(call).toBeDefined();
    expect(call![2]).toMatchObject({
      currency: "EUR",
      value: 120.0,
      payment_type: "Credit Card",
    });
  });
});

describe("CCPA_REGIONS constant", () => {
  // CCPA_REGIONS stores lowercase values for case-insensitive matching
  it("includes California (lowercase)", () => {
    expect(CCPA_REGIONS.has("california")).toBe(true);
    expect(CCPA_REGIONS.has("ca")).toBe(true);
  });

  it("includes Virginia (lowercase)", () => {
    expect(CCPA_REGIONS.has("virginia")).toBe(true);
    expect(CCPA_REGIONS.has("va")).toBe(true);
  });

  it("includes Colorado (lowercase)", () => {
    expect(CCPA_REGIONS.has("colorado")).toBe(true);
    expect(CCPA_REGIONS.has("co")).toBe(true);
  });

  it("includes Connecticut (lowercase)", () => {
    expect(CCPA_REGIONS.has("connecticut")).toBe(true);
    expect(CCPA_REGIONS.has("ct")).toBe(true);
  });

  it("includes Utah (lowercase)", () => {
    expect(CCPA_REGIONS.has("utah")).toBe(true);
    expect(CCPA_REGIONS.has("ut")).toBe(true);
  });

  it("does not include non-CCPA states", () => {
    expect(CCPA_REGIONS.has("texas")).toBe(false);
    expect(CCPA_REGIONS.has("tx")).toBe(false);
    expect(CCPA_REGIONS.has("new york")).toBe(false);
    expect(CCPA_REGIONS.has("ny")).toBe(false);
  });
});

describe("ConsentManager.isCCPAUser()", () => {
  it("returns false when ccpaEnabled is not set", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(false, "US", "California"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(false);
  });

  it("returns false when ccpaEnabled is false", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: false,
      geoDetector: createMockGeoDetector(false, "US", "California"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(false);
  });

  it("returns true for California user when ccpaEnabled", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "California"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(true);
  });

  it("returns true for CA abbreviation when ccpaEnabled", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "CA"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(true);
  });

  it("returns true for Virginia user when ccpaEnabled", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "Virginia"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(true);
  });

  it("handles case-insensitive region matching", async () => {
    // Test uppercase from geo API
    const managerUpper = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "CALIFORNIA"),
      version: "1.0",
    });
    await managerUpper.init();
    expect(managerUpper.isCCPAUser()).toBe(true);

    // Test lowercase
    const managerLower = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "california"),
      version: "1.0",
    });
    await managerLower.init();
    expect(managerLower.isCCPAUser()).toBe(true);

    // Test mixed case
    const managerMixed = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "CaLiFoRnIa"),
      version: "1.0",
    });
    await managerMixed.init();
    expect(managerMixed.isCCPAUser()).toBe(true);
  });

  it("returns false for non-CCPA US state", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "Texas"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(false);
  });

  it("returns false for non-US country", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "CA", "Ontario"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(false);
  });

  it("returns false when region is not provided", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.isCCPAUser()).toBe(false);
  });

  it("returns false before init()", () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      version: "1.0",
    });

    expect(manager.isCCPAUser()).toBe(false);
  });
});

describe("ConsentManager.getRegion()", () => {
  it("returns undefined before init()", () => {
    const manager = new ConsentManager({ version: "1.0" });
    expect(manager.getRegion()).toBeUndefined();
  });

  it("returns region after init()", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(false, "US", "California"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.getRegion()).toBe("California");
  });

  it("returns undefined when region not in geo result", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(false, "US"),
      version: "1.0",
    });
    await manager.init();

    expect(manager.getRegion()).toBeUndefined();
  });
});

describe("ConsentManager CCPA flow", () => {
  it("grants consent silently for CCPA user (no banner)", async () => {
    const showBanner = vi.fn();
    const onCCPAUser = vi.fn();

    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "California"),
      version: "1.0",
      onCCPAUser,
    });

    manager.onShowBanner(showBanner);
    await manager.init();

    // Banner should NOT be shown for CCPA users
    expect(showBanner).not.toHaveBeenCalled();
    // onCCPAUser callback should be called
    expect(onCCPAUser).toHaveBeenCalledTimes(1);
  });

  it("shows banner for EU user even when ccpaEnabled", async () => {
    const showBanner = vi.fn();

    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(true, "DE"),
      version: "1.0",
    });

    manager.onShowBanner(showBanner);
    await manager.init();

    // EU takes precedence — banner should be shown
    expect(showBanner).toHaveBeenCalledTimes(1);
  });

  it("does not call onCCPAUser for EU user", async () => {
    const onCCPAUser = vi.fn();

    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(true, "DE"),
      version: "1.0",
      onCCPAUser,
    });

    await manager.init();

    expect(onCCPAUser).not.toHaveBeenCalled();
  });

  it("does not call onCCPAUser for non-CCPA US state", async () => {
    const onCCPAUser = vi.fn();

    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "Texas"),
      version: "1.0",
      onCCPAUser,
    });

    await manager.init();

    expect(onCCPAUser).not.toHaveBeenCalled();
  });

  it("persists CCPA consent to cookie", async () => {
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector: createMockGeoDetector(false, "US", "California"),
      version: "1.0",
    });
    await manager.init();

    // CCPA consent should be stored in cookie
    const cookieValue = decodeURIComponent(
      cookieStore.split("consent_preferences=")[1]?.split(";")[0] ?? ""
    );
    const stored = JSON.parse(cookieValue);

    expect(stored.categories).toEqual({
      analytics: true,
      marketing: true,
      functional: true,
    });
    // The opt-out model needs the choice, not the state it was made in: the next visit detects
    // the region again (roaming check).
    expect(stored).not.toHaveProperty("region");
    expect(stored).not.toHaveProperty("countryCode");
    expect(stored.consentRequired).toBe(false);
  });

  it("runs geo detection for GDPR roaming check when CCPA consent exists", async () => {
    // Pre-fill cookie with CCPA consent (consentRequired=false)
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: true, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        consentRequired: false,
        geoMethod: "worker",
        countryCode: "US",
        region: "California",
      })
    )}`;

    // Geo returns same location (not roaming to EU)
    const geoDetector = createMockGeoDetector(false, "US", "California");
    const manager = new ConsentManager({
      ccpaEnabled: true,
      geoDetector,
      version: "1.0",
    });
    await manager.init();

    // Geo detector IS called for GDPR roaming check (even for CCPA consent)
    expect(geoDetector.detect).toHaveBeenCalled();
    // Consent preserved since user is still in non-EU location
    expect(manager.hasConsent()).toBe(true);
    expect(manager.getRegion()).toBe("California");
  });
});

describe("ConsentManager region", () => {
  it("does not store the region in the cookie when saving preferences", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(false, "US", "California"),
      version: "1.0",
    });
    await manager.init();
    await manager.savePreferences({ analytics: true, marketing: false });

    const cookieValue = decodeURIComponent(
      cookieStore.split("consent_preferences=")[1]?.split(";")[0] ?? ""
    );
    const stored = JSON.parse(cookieValue);

    expect(stored).not.toHaveProperty("region");
    expect(stored).not.toHaveProperty("countryCode");
    expect(stored.consentRequired).toBe(false);
  });

  it("restores region from geo detection when consent has consentRequired=false", async () => {
    // Cookie with consentRequired=false triggers roaming check
    cookieStore = `consent_preferences=${encodeURIComponent(
      JSON.stringify({
        categories: { analytics: true, marketing: false, functional: true },
        timestamp: Date.now(),
        version: "1.0",
        consentRequired: false,
        geoMethod: "worker",
        countryCode: "US",
        region: "Virginia",
      })
    )}`;

    // Geo detection returns current location (same region)
    const geoDetector = createMockGeoDetector(false, "US", "Virginia");
    const manager = new ConsentManager({ version: "1.0", geoDetector });
    await manager.init();

    // Region comes from geo detection (roaming check was run)
    expect(manager.getRegion()).toBe("Virginia");
    expect(manager.getGeoResult()?.region).toBe("Virginia");
  });

  it("includes region in geo detection log", async () => {
    const manager = new ConsentManager({
      geoDetector: createMockGeoDetector(false, "US", "Colorado"),
      version: "1.0",
    });
    await manager.init();

    const log = manager.getGeoDetectionLog();
    expect(log.length).toBe(1);
    expect(log[0].result?.region).toBe("Colorado");
  });
});
