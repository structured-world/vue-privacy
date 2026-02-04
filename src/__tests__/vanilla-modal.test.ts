// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createModal, injectVanillaModalStyles, MODAL_CSS } from "../vanilla/modal";
import { createConsentManager } from "../core/consent-manager";
import type { ConsentManager } from "../core/consent-manager";

const STYLE_ID = "vue-privacy-vanilla-modal";
const CONTAINER_ID = "vue-privacy-modal";

describe("injectVanillaModalStyles", () => {
  beforeEach(() => {
    document.getElementById(STYLE_ID)?.remove();
  });

  it("appends a <style> element with the correct id", () => {
    injectVanillaModalStyles();
    const el = document.getElementById(STYLE_ID);
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe("STYLE");
    expect(el!.textContent).toContain(".consent-modal");
  });

  it("does not duplicate when called multiple times", () => {
    injectVanillaModalStyles();
    injectVanillaModalStyles();
    injectVanillaModalStyles();
    const elements = document.querySelectorAll(`#${STYLE_ID}`);
    expect(elements.length).toBe(1);
  });

  it("re-injects if the style element was removed externally", () => {
    injectVanillaModalStyles();
    document.getElementById(STYLE_ID)!.remove();
    expect(document.getElementById(STYLE_ID)).toBeNull();

    injectVanillaModalStyles();
    expect(document.getElementById(STYLE_ID)).not.toBeNull();
  });
});

describe("MODAL_CSS", () => {
  it("contains essential CSS rules", () => {
    expect(MODAL_CSS).toContain(".consent-modal-overlay");
    expect(MODAL_CSS).toContain(".consent-modal");
    expect(MODAL_CSS).toContain(".consent-modal__header");
    expect(MODAL_CSS).toContain(".consent-modal__body");
    expect(MODAL_CSS).toContain(".consent-modal__footer");
    expect(MODAL_CSS).toContain(".consent-toggle");
    expect(MODAL_CSS).toContain(".consent-modal__btn--save");
  });
});

describe("createModal", () => {
  let manager: ConsentManager;

  beforeEach(() => {
    // Clean up DOM
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(CONTAINER_ID)?.remove();
    document.body.innerHTML = "";

    // Create a fresh manager for each test
    manager = createConsentManager({
      euDetection: "never", // Disable geo detection for tests
    });
  });

  afterEach(() => {
    // Clean up
    document.body.innerHTML = "";
  });

  it("creates a modal element in the DOM", () => {
    const modal = createModal({ manager });

    const container = document.getElementById(CONTAINER_ID);
    expect(container).not.toBeNull();

    const overlayEl = container!.querySelector(".consent-modal-overlay");
    expect(overlayEl).not.toBeNull();

    const modalEl = container!.querySelector(".consent-modal");
    expect(modalEl).not.toBeNull();

    modal.destroy();
  });

  it("uses provided container selector", () => {
    const customContainer = document.createElement("div");
    customContainer.id = "custom-container";
    document.body.appendChild(customContainer);

    const modal = createModal({
      manager,
      container: "#custom-container",
    });

    const modalEl = customContainer.querySelector(".consent-modal");
    expect(modalEl).not.toBeNull();

    // Default container should not be created
    expect(document.getElementById(CONTAINER_ID)).toBeNull();

    modal.destroy();
  });

  it("uses provided container element", () => {
    const customContainer = document.createElement("div");
    document.body.appendChild(customContainer);

    const modal = createModal({
      manager,
      container: customContainer,
    });

    const modalEl = customContainer.querySelector(".consent-modal");
    expect(modalEl).not.toBeNull();

    modal.destroy();
  });

  it("throws error if container selector not found", () => {
    expect(() => {
      createModal({
        manager,
        container: "#non-existent",
      });
    }).toThrow('createModal: container "#non-existent" not found');
  });

  it("applies theme data attribute", () => {
    const modalLight = createModal({ manager, theme: "light" });
    expect(document.querySelector('[data-consent-theme="light"]')).not.toBeNull();
    modalLight.destroy();

    const modalDark = createModal({ manager, theme: "dark" });
    expect(document.querySelector('[data-consent-theme="dark"]')).not.toBeNull();
    modalDark.destroy();

    const modalAuto = createModal({ manager, theme: "auto" });
    expect(document.querySelector('[data-consent-theme="auto"]')).not.toBeNull();
    modalAuto.destroy();
  });

  it("starts hidden by default", () => {
    const modal = createModal({ manager });
    const overlayEl = document.querySelector(".consent-modal-overlay");
    expect(overlayEl!.classList.contains("consent-modal-overlay--hidden")).toBe(true);
    expect(modal.isVisible()).toBe(false);
    modal.destroy();
  });

  it("show() makes modal visible", () => {
    const modal = createModal({ manager });
    modal.show();
    const overlayEl = document.querySelector(".consent-modal-overlay");
    expect(overlayEl!.classList.contains("consent-modal-overlay--hidden")).toBe(false);
    expect(modal.isVisible()).toBe(true);
    modal.destroy();
  });

  it("hide() makes modal hidden", () => {
    const modal = createModal({ manager });
    modal.show();
    modal.hide();
    const overlayEl = document.querySelector(".consent-modal-overlay");
    expect(overlayEl!.classList.contains("consent-modal-overlay--hidden")).toBe(true);
    expect(modal.isVisible()).toBe(false);
    modal.destroy();
  });

  it("renders all consent category toggles", () => {
    const modal = createModal({ manager });

    const analyticsToggle = document.querySelector('[data-category="analytics"]');
    const marketingToggle = document.querySelector('[data-category="marketing"]');
    const functionalToggle = document.querySelector('[data-category="functional"]');

    expect(analyticsToggle).not.toBeNull();
    expect(marketingToggle).not.toBeNull();
    expect(functionalToggle).not.toBeNull();

    // Necessary category should be disabled
    const necessaryToggle = document.querySelector(
      ".consent-toggle__input:disabled"
    ) as HTMLInputElement;
    expect(necessaryToggle).not.toBeNull();
    expect(necessaryToggle.checked).toBe(true);

    modal.destroy();
  });

  it("renders save and accept-all buttons", () => {
    const modal = createModal({ manager });

    const saveBtn = document.querySelector('[data-action="save"]');
    const acceptAllBtn = document.querySelector('[data-action="accept-all"]');

    expect(saveBtn).not.toBeNull();
    expect(acceptAllBtn).not.toBeNull();

    modal.destroy();
  });

  it("renders close button", () => {
    const modal = createModal({ manager });

    const closeBtn = document.querySelector('[data-action="close"]');
    expect(closeBtn).not.toBeNull();

    modal.destroy();
  });

  it("calls onClose callback when close button clicked", () => {
    const onClose = vi.fn();
    const modal = createModal({ manager, onClose });
    modal.show();

    const closeBtn = document.querySelector('[data-action="close"]') as HTMLButtonElement;
    closeBtn.click();

    expect(onClose).toHaveBeenCalled();
    expect(modal.isVisible()).toBe(false);

    modal.destroy();
  });

  it("calls onClose callback when clicking overlay background", () => {
    const onClose = vi.fn();
    const modal = createModal({ manager, onClose });
    modal.show();

    const overlayEl = document.querySelector(".consent-modal-overlay") as HTMLElement;
    // Click directly on overlay (not on modal content)
    overlayEl.click();

    expect(onClose).toHaveBeenCalled();
    expect(modal.isVisible()).toBe(false);

    modal.destroy();
  });

  it("calls onSave callback when save button clicked", async () => {
    const onSave = vi.fn();
    const modal = createModal({ manager, onSave });
    modal.show();

    // Toggle analytics on
    const analyticsToggle = document.querySelector(
      '[data-category="analytics"]'
    ) as HTMLInputElement;
    analyticsToggle.checked = true;

    const saveBtn = document.querySelector('[data-action="save"]') as HTMLButtonElement;
    saveBtn.click();

    // Wait for async handler
    await vi.waitFor(() => expect(onSave).toHaveBeenCalled());

    expect(onSave).toHaveBeenCalledWith({
      analytics: true,
      marketing: false,
      functional: true, // Default value
    });

    modal.destroy();
  });

  it("calls onClose callback when accept-all clicked", async () => {
    const onClose = vi.fn();
    const modal = createModal({ manager, onClose });
    modal.show();

    const acceptAllBtn = document.querySelector('[data-action="accept-all"]') as HTMLButtonElement;
    acceptAllBtn.click();

    // Wait for async handler
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());

    modal.destroy();
  });

  it("closes modal on Escape key", () => {
    const onClose = vi.fn();
    const modal = createModal({ manager, onClose });
    modal.show();

    const overlayEl = document.querySelector(".consent-modal-overlay") as HTMLElement;
    overlayEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(onClose).toHaveBeenCalled();
    expect(modal.isVisible()).toBe(false);

    modal.destroy();
  });

  it("has proper accessibility attributes", () => {
    const modal = createModal({ manager });
    const modalEl = document.querySelector(".consent-modal");

    expect(modalEl!.getAttribute("role")).toBe("dialog");
    expect(modalEl!.getAttribute("aria-modal")).toBe("true");
    expect(modalEl!.getAttribute("aria-labelledby")).toBe("consent-modal-title");
    expect(modalEl!.getAttribute("tabindex")).toBe("-1");

    modal.destroy();
  });

  it("loads current consent state when opened", async () => {
    // First accept all to store consent
    await manager.acceptAll();

    const modal = createModal({ manager });
    modal.show();

    const analyticsToggle = document.querySelector(
      '[data-category="analytics"]'
    ) as HTMLInputElement;
    const marketingToggle = document.querySelector(
      '[data-category="marketing"]'
    ) as HTMLInputElement;
    const functionalToggle = document.querySelector(
      '[data-category="functional"]'
    ) as HTMLInputElement;

    // All should be checked after acceptAll
    expect(analyticsToggle.checked).toBe(true);
    expect(marketingToggle.checked).toBe(true);
    expect(functionalToggle.checked).toBe(true);

    modal.destroy();
  });

  it("destroy() removes the modal from DOM", () => {
    const modal = createModal({ manager });
    expect(document.querySelector(".consent-modal-overlay")).not.toBeNull();

    modal.destroy();
    expect(document.querySelector(".consent-modal-overlay")).toBeNull();
  });

  it("destroy() removes auto-created container", () => {
    const modal = createModal({ manager });
    expect(document.getElementById(CONTAINER_ID)).not.toBeNull();

    modal.destroy();
    expect(document.getElementById(CONTAINER_ID)).toBeNull();
  });

  it("destroy() does not remove provided container", () => {
    const customContainer = document.createElement("div");
    customContainer.id = "custom-container";
    document.body.appendChild(customContainer);

    const modal = createModal({
      manager,
      container: customContainer,
    });

    modal.destroy();
    expect(document.getElementById("custom-container")).not.toBeNull();
  });

  it("escapes HTML in text content", () => {
    const managerWithHtml = createConsentManager({
      euDetection: "never",
      preferenceCenter: {
        title: "<script>alert('xss')</script>",
        description: "<img src=x onerror=alert('xss')>",
      },
    });

    const modal = createModal({ manager: managerWithHtml });
    const titleEl = document.getElementById("consent-modal-title");
    const descEl = document.querySelector(".consent-modal__description");

    // Script tags should be escaped, not executed
    expect(titleEl!.innerHTML).not.toContain("<script>");
    expect(descEl!.innerHTML).not.toContain("<img src=x");
    expect(titleEl!.textContent).toContain("<script>");

    modal.destroy();
  });
});
