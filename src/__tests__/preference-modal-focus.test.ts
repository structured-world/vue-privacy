// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { createApp, type App } from "vue";
import ConsentPreferenceModal from "../vue/ConsentPreferenceModal.vue";
import { createConsentManager } from "../core/consent-manager";

// The dialog takes focus on open, on its container (tabindex -1). Shift+Tab from there must
// still wrap to the last control inside the dialog, not leave it for the page behind.
describe("ConsentPreferenceModal focus trap", () => {
  let app: App | undefined;

  afterEach(() => {
    app?.unmount();
    app = undefined;
    document.body.innerHTML = "";
  });

  async function openModal() {
    const manager = createConsentManager({ geoDetection: "never" });
    const host = document.createElement("div");
    document.body.appendChild(host);
    app = createApp(ConsentPreferenceModal);
    app.provide("consentManager", manager);
    app.mount(host);

    manager.showPreferenceCenter();
    // The open watcher focuses the container after a tick
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(document.querySelector(".consent-modal"))
    );
    return document.querySelector<HTMLElement>(".consent-modal")!;
  }

  it("Shift+Tab from the focused container moves focus to the last control", async () => {
    const container = await openModal();
    const lastControl = document.querySelector<HTMLElement>(".consent-modal__btn--save")!;

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    container.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(lastControl);
  });

  it("Shift+Tab from the first control wraps to the last control", async () => {
    await openModal();
    const firstControl = document.querySelector<HTMLElement>(".consent-modal__close")!;
    const lastControl = document.querySelector<HTMLElement>(".consent-modal__btn--save")!;
    firstControl.focus();

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    firstControl.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(lastControl);
  });
});
