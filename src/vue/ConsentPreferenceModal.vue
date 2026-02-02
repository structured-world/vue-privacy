<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, watch, nextTick } from "vue";
import type { ConsentManager } from "../core/consent-manager";
import type { ConsentCategories } from "../core/types";
import { getTranslations } from "../i18n/index";
import { injectModalStyles } from "./modal-styles";

const emit = defineEmits<{
  save: [categories: Partial<Omit<ConsentCategories, "necessary">>];
  close: [];
}>();

const consentManager = inject<ConsentManager>("consentManager");
const modalRef = ref<HTMLElement | null>(null);

const visible = ref(false);
const categories = ref({
  analytics: false,
  marketing: false,
  functional: true,
});

// Merged config: manager config overrides > i18n translations
const modalConfig = computed(() => {
  const locale = consentManager?.getLocale() ?? "en";
  const t = getTranslations(locale).preferenceCenter;
  const cfg = consentManager?.getConfig().preferenceCenter;

  return {
    title: cfg?.title ?? t.title,
    description: cfg?.description ?? t.description,
    savePreferences: cfg?.savePreferences ?? t.savePreferences,
    acceptAll: cfg?.acceptAll ?? t.acceptAll,
    categories: {
      necessary: {
        name: cfg?.categories?.necessary?.name ?? t.categories.necessary.name,
        description: cfg?.categories?.necessary?.description ?? t.categories.necessary.description,
      },
      analytics: {
        name: cfg?.categories?.analytics?.name ?? t.categories.analytics.name,
        description: cfg?.categories?.analytics?.description ?? t.categories.analytics.description,
      },
      marketing: {
        name: cfg?.categories?.marketing?.name ?? t.categories.marketing.name,
        description: cfg?.categories?.marketing?.description ?? t.categories.marketing.description,
      },
      functional: {
        name: cfg?.categories?.functional?.name ?? t.categories.functional.name,
        description:
          cfg?.categories?.functional?.description ?? t.categories.functional.description,
      },
    },
  };
});

// Load current consent state when modal opens
watch(visible, async (isVisible) => {
  if (isVisible) {
    const currentConsent = consentManager?.getConsent();
    if (currentConsent) {
      categories.value = { ...currentConsent.categories };
    }

    await nextTick();
    // Focus the modal container for screen readers; user can Tab into controls
    modalRef.value?.focus();
  }
});

// Inject CSS (SSR-safe)
injectModalStyles();

// Register callbacks with manager
onMounted(() => {
  if (consentManager) {
    consentManager.onShowPreferenceCenter(() => {
      visible.value = true;
    });

    consentManager.onHidePreferenceCenter(() => {
      visible.value = false;
    });
  }
});

// Clean up callbacks on unmount to prevent stale references
onUnmounted(() => {
  if (consentManager) {
    consentManager.onShowPreferenceCenter(() => {});
    consentManager.onHidePreferenceCenter(() => {});
  }
});

async function handleSave() {
  await consentManager?.savePreferences(categories.value);
  emit("save", categories.value);
}

async function handleAcceptAll() {
  await consentManager?.acceptAll();
  emit("close");
}

function handleClose() {
  visible.value = false;
  consentManager?.getConfig().onPreferenceCenterHide?.();
  emit("close");
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    handleClose();
    return;
  }

  // Focus trap: Tab cycles within this modal instance
  if (e.key === "Tab") {
    const container = modalRef.value;
    if (!container) return;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      "button, input:not(:disabled)"
    );
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="consent-modal">
      <div
        v-if="visible"
        class="consent-modal-overlay"
        @click.self="handleClose"
        @keydown="handleKeydown"
      >
        <div
          ref="modalRef"
          class="consent-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-modal-title"
          tabindex="-1"
        >
          <button
            type="button"
            class="consent-modal__close"
            aria-label="Close"
            @click="handleClose"
          >
            &times;
          </button>

          <div class="consent-modal__header">
            <h2 id="consent-modal-title" class="consent-modal__title">
              {{ modalConfig.title }}
            </h2>
            <p v-if="modalConfig.description" class="consent-modal__description">
              {{ modalConfig.description }}
            </p>
          </div>

          <div class="consent-modal__body">
            <!-- Necessary (always on) -->
            <div class="consent-modal__category">
              <div class="consent-modal__category-header">
                <h3 class="consent-modal__category-name">
                  {{ modalConfig.categories.necessary.name }}
                </h3>
                <label class="consent-toggle">
                  <input type="checkbox" class="consent-toggle__input" checked disabled />
                  <span class="consent-toggle__slider"></span>
                </label>
              </div>
              <p class="consent-modal__category-description">
                {{ modalConfig.categories.necessary.description }}
              </p>
            </div>

            <!-- Analytics -->
            <div class="consent-modal__category">
              <div class="consent-modal__category-header">
                <h3 class="consent-modal__category-name">
                  {{ modalConfig.categories.analytics.name }}
                </h3>
                <label class="consent-toggle">
                  <input
                    v-model="categories.analytics"
                    type="checkbox"
                    class="consent-toggle__input"
                  />
                  <span class="consent-toggle__slider"></span>
                </label>
              </div>
              <p class="consent-modal__category-description">
                {{ modalConfig.categories.analytics.description }}
              </p>
            </div>

            <!-- Marketing -->
            <div class="consent-modal__category">
              <div class="consent-modal__category-header">
                <h3 class="consent-modal__category-name">
                  {{ modalConfig.categories.marketing.name }}
                </h3>
                <label class="consent-toggle">
                  <input
                    v-model="categories.marketing"
                    type="checkbox"
                    class="consent-toggle__input"
                  />
                  <span class="consent-toggle__slider"></span>
                </label>
              </div>
              <p class="consent-modal__category-description">
                {{ modalConfig.categories.marketing.description }}
              </p>
            </div>

            <!-- Functional -->
            <div class="consent-modal__category">
              <div class="consent-modal__category-header">
                <h3 class="consent-modal__category-name">
                  {{ modalConfig.categories.functional.name }}
                </h3>
                <label class="consent-toggle">
                  <input
                    v-model="categories.functional"
                    type="checkbox"
                    class="consent-toggle__input"
                  />
                  <span class="consent-toggle__slider"></span>
                </label>
              </div>
              <p class="consent-modal__category-description">
                {{ modalConfig.categories.functional.description }}
              </p>
            </div>
          </div>

          <div class="consent-modal__footer">
            <button
              type="button"
              class="consent-modal__btn consent-modal__btn--accept-all"
              @click="handleAcceptAll"
            >
              {{ modalConfig.acceptAll }}
            </button>
            <button
              type="button"
              class="consent-modal__btn consent-modal__btn--save"
              @click="handleSave"
            >
              {{ modalConfig.savePreferences }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
