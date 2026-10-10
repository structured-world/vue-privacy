<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, watch, nextTick } from "vue";
import type { ConsentManager } from "../core/consent-manager";
import type { ConsentCategories, ConsentRequest, ConsentTheme } from "../core/types";
import { getTranslations } from "../i18n/index";
import { limitToUsed, usedCategoriesOf } from "../core/categories";
import { injectModalStyles } from "./modal-styles";

const props = defineProps<{
  /** Colour palette; the manager's `theme` config, else 'auto', when not set */
  theme?: ConsentTheme;
}>();

const emit = defineEmits<{
  save: [categories: Partial<Omit<ConsentCategories, "necessary">>];
  close: [];
}>();

const consentManager = inject<ConsentManager>("consentManager");

// The stylesheet applies the dark palette for 'dark', and for 'auto' on a dark system
const theme = computed(() => props.theme ?? consentManager?.getConfig().theme ?? "auto");
const modalRef = ref<HTMLElement | null>(null);

const visible = ref(false);
// What a feature asked for (requestConsent), read on every show: a call while open refreshes it
const request = ref<ConsentRequest | null>(null);
// A pre-ticked box is no consent (CJEU C-673/17 Planet49; GDPR Recital 32): an undecided visitor
// finds every optional category unticked
const UNTICKED = { analytics: false, marketing: false, functional: false };
const categories = ref({ ...UNTICKED });

// Only the categories the site uses are offered; the manager refuses the rest on save.
const usedCategories = computed(() => usedCategoriesOf(consentManager?.getConfig() ?? {}));

// The manager's locale, tracked so the text re-renders when the site switches language
const locale = ref(consentManager?.getLocale() ?? "en");
let stopLocaleWatch: (() => void) | undefined;

// Merged config: manager config overrides > i18n translations
const modalConfig = computed(() => {
  const translations = getTranslations(locale.value);
  const t = translations.preferenceCenter;
  const cfg = consentManager?.getConfig().preferenceCenter;

  return {
    title: cfg?.title ?? t.title,
    description: cfg?.description ?? t.description,
    savePreferences: cfg?.savePreferences ?? t.savePreferences,
    acceptAll: cfg?.acceptAll ?? t.acceptAll,
    // Both buttons refuse the same thing, so they share one label: the banner's, which the
    // manager resolves to the site's text or the locale's.
    rejectAll:
      cfg?.rejectAll ??
      consentManager?.getConfig().banner?.rejectAll ??
      t.rejectAll ??
      translations.banner.rejectAll,
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
    } else {
      // Every open: toggles of a dialog closed without saving chose nothing
      categories.value = { ...UNTICKED };
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
      // A request joining the open dialog shows its reason; the toggles stay as the visitor set them
      request.value = consentManager.getConsentRequest();
      visible.value = true;
    });

    consentManager.onHidePreferenceCenter(() => {
      request.value = null;
      visible.value = false;
    });

    locale.value = consentManager.getLocale();
    stopLocaleWatch = consentManager.onLocaleChange((next) => {
      locale.value = next;
    });
  }
});

// Clean up callbacks on unmount to prevent stale references
onUnmounted(() => {
  stopLocaleWatch?.();
  if (consentManager) {
    consentManager.onShowPreferenceCenter(null);
    consentManager.onHidePreferenceCenter(null);
  }
});

async function handleSave() {
  // A category the dialog does not show is refused, in what is saved and what is emitted alike.
  const saved = limitToUsed(categories.value, consentManager?.getConfig() ?? {});
  await consentManager?.savePreferences(saved);
  emit("save", saved);
}

async function handleAcceptAll() {
  await consentManager?.acceptAll();
  emit("close");
}

async function handleRejectAll() {
  await consentManager?.rejectAll();
  emit("close");
}

function handleClose() {
  // The manager hides the dialog and answers a pending requestConsent() with the choice in effect
  if (consentManager) consentManager.hidePreferenceCenter();
  else visible.value = false;
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
        :data-consent-theme="theme"
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
            <!-- Why a feature asks for a category: the site's own text -->
            <p v-for="reason in request?.reasons ?? []" :key="reason" class="consent-modal__reason">
              {{ reason }}
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
                  <input
                    type="checkbox"
                    class="consent-toggle__input"
                    checked
                    disabled
                    :aria-label="modalConfig.categories.necessary.name"
                  />
                  <span class="consent-toggle__slider"></span>
                </label>
              </div>
              <p class="consent-modal__category-description">
                {{ modalConfig.categories.necessary.description }}
              </p>
            </div>

            <!-- The optional categories the site uses -->
            <div
              v-for="category in usedCategories"
              :key="category"
              class="consent-modal__category"
              :class="{
                'consent-modal__category--requested': request?.categories.includes(category),
              }"
            >
              <div class="consent-modal__category-header">
                <h3 class="consent-modal__category-name">
                  {{ modalConfig.categories[category].name }}
                </h3>
                <label class="consent-toggle">
                  <input
                    v-model="categories[category]"
                    type="checkbox"
                    class="consent-toggle__input"
                    :data-category="category"
                    :aria-label="modalConfig.categories[category].name"
                  />
                  <span class="consent-toggle__slider"></span>
                </label>
              </div>
              <p class="consent-modal__category-description">
                {{ modalConfig.categories[category].description }}
              </p>
            </div>
          </div>

          <div class="consent-modal__footer">
            <!-- Refusing takes one click, as accepting does, and looks the same. -->
            <button
              type="button"
              class="consent-modal__btn consent-modal__btn--reject-all"
              @click="handleRejectAll"
            >
              {{ modalConfig.rejectAll }}
            </button>
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
