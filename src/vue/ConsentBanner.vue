<script setup lang="ts">
import { ref, computed, onMounted, inject } from "vue";
import type { ConsentManager } from "../core/consent-manager";
import type { BannerConfig, BannerConfigDefaults } from "../core/types";
import { DEFAULT_CONFIG } from "../core/types";

const props = defineProps<{
  /** Custom banner configuration */
  config?: Partial<BannerConfig>;
  /** Position of the banner */
  position?: "bottom" | "top" | "center";
}>();

const emit = defineEmits<{
  accept: [];
  reject: [];
  customize: [];
}>();

// Inject consent manager from Vue plugin
const consentManager = inject<ConsentManager>("consentManager");

// State
const visible = ref(false);

// Merged config with defaults
const bannerConfig = computed<BannerConfigDefaults>(() => {
  const managerConfig = consentManager?.getConfig().banner;
  const propsConfig = props.config;
  return {
    title: propsConfig?.title ?? managerConfig?.title ?? DEFAULT_CONFIG.banner.title,
    message: propsConfig?.message ?? managerConfig?.message ?? DEFAULT_CONFIG.banner.message,
    acceptAll:
      propsConfig?.acceptAll ?? managerConfig?.acceptAll ?? DEFAULT_CONFIG.banner.acceptAll,
    rejectAll:
      propsConfig?.rejectAll ?? managerConfig?.rejectAll ?? DEFAULT_CONFIG.banner.rejectAll,
    customize:
      propsConfig?.customize ?? managerConfig?.customize ?? DEFAULT_CONFIG.banner.customize,
    privacyLink:
      propsConfig?.privacyLink ?? managerConfig?.privacyLink ?? DEFAULT_CONFIG.banner.privacyLink,
    privacyLinkText:
      propsConfig?.privacyLinkText ??
      managerConfig?.privacyLinkText ??
      DEFAULT_CONFIG.banner.privacyLinkText,
  };
});

// Position classes
const positionClasses = computed(() => {
  switch (props.position ?? "bottom") {
    case "top":
      return "consent-banner--top";
    case "center":
      return "consent-banner--center";
    default:
      return "consent-banner--bottom";
  }
});

// Register show/hide callbacks with manager
onMounted(() => {
  if (consentManager) {
    consentManager.onShowBanner(() => {
      visible.value = true;
    });

    consentManager.onHideBanner(() => {
      visible.value = false;
    });
  }
});

// Actions
async function handleAccept() {
  await consentManager?.acceptAll();
  emit("accept");
}

async function handleReject() {
  await consentManager?.rejectAll();
  emit("reject");
}

function handleCustomize() {
  emit("customize");
}
</script>

<template>
  <Teleport to="body">
    <Transition name="consent-banner">
      <div
        v-if="visible"
        class="consent-banner"
        :class="positionClasses"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-banner-title"
        aria-describedby="consent-banner-message"
      >
        <div class="consent-banner__content">
          <h2 id="consent-banner-title" class="consent-banner__title">
            {{ bannerConfig.title }}
          </h2>
          <p id="consent-banner-message" class="consent-banner__message">
            {{ bannerConfig.message }}
            <a
              v-if="bannerConfig.privacyLink"
              :href="bannerConfig.privacyLink"
              class="consent-banner__privacy-link"
              target="_blank"
              rel="noopener"
            >
              {{ bannerConfig.privacyLinkText }}
            </a>
          </p>
        </div>

        <div class="consent-banner__actions">
          <button
            type="button"
            class="consent-banner__btn consent-banner__btn--reject"
            @click="handleReject"
          >
            {{ bannerConfig.rejectAll }}
          </button>

          <button
            v-if="bannerConfig.customize"
            type="button"
            class="consent-banner__btn consent-banner__btn--customize"
            @click="handleCustomize"
          >
            {{ bannerConfig.customize }}
          </button>

          <button
            type="button"
            class="consent-banner__btn consent-banner__btn--accept"
            @click="handleAccept"
          >
            {{ bannerConfig.acceptAll }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.consent-banner {
  position: fixed;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: 1rem;
  background: var(--consent-bg, #ffffff);
  color: var(--consent-text, #1a1a1a);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  font-family: var(--consent-font, system-ui, -apple-system, sans-serif);
}

.consent-banner--bottom {
  bottom: 0;
}

.consent-banner--top {
  top: 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.consent-banner--center {
  top: 50%;
  left: 50%;
  right: auto;
  transform: translate(-50%, -50%);
  max-width: 500px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.consent-banner__content {
  max-width: 1200px;
  margin: 0 auto;
}

.consent-banner__title {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
}

.consent-banner__message {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--consent-text-secondary, #666666);
}

.consent-banner__privacy-link {
  color: var(--consent-link, #0066cc);
  text-decoration: underline;
}

.consent-banner__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
  max-width: 1200px;
  margin: 0 auto;
}

.consent-banner__btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    opacity 0.2s;
}

.consent-banner__btn:hover {
  opacity: 0.9;
}

.consent-banner__btn--accept {
  background: var(--consent-btn-accept-bg, #0066cc);
  color: var(--consent-btn-accept-text, #ffffff);
}

.consent-banner__btn--reject {
  background: var(--consent-btn-reject-bg, #e0e0e0);
  color: var(--consent-btn-reject-text, #1a1a1a);
}

.consent-banner__btn--customize {
  background: transparent;
  color: var(--consent-link, #0066cc);
  border: 1px solid currentColor;
}

/* Transitions */
.consent-banner-enter-active,
.consent-banner-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.consent-banner--bottom.consent-banner-enter-from,
.consent-banner--bottom.consent-banner-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.consent-banner--top.consent-banner-enter-from,
.consent-banner--top.consent-banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.consent-banner--center.consent-banner-enter-from,
.consent-banner--center.consent-banner-leave-to {
  transform: translate(-50%, -50%) scale(0.9);
  opacity: 0;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .consent-banner {
    --consent-bg: #1a1a1a;
    --consent-text: #ffffff;
    --consent-text-secondary: #a0a0a0;
    --consent-btn-reject-bg: #333333;
    --consent-btn-reject-text: #ffffff;
  }
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .consent-banner__actions {
    flex-direction: column;
  }

  .consent-banner__btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
