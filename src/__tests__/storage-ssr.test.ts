// @vitest-environment node
import { it, expect } from "vitest";
import { setConsentUid, clearConsentUid, siteConsentUid } from "../core/storage";

it("does not retain a site's UID across server requests", () => {
  // Without a browser there is no page identity: requests A and B must not share one.
  const before = siteConsentUid();
  setConsentUid("request-A");
  setConsentUid("request-B");
  clearConsentUid();
  expect(siteConsentUid()).toEqual(before);
  expect(siteConsentUid().uid).toBeNull();
});
