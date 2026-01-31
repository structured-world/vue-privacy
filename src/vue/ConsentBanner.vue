<script setup lang="ts">
import { ref, computed, onMounted, inject } from "vue";
import type { ConsentManager } from "../core/consent-manager";
import type { BannerConfig, BannerConfigDefaults } from "../core/types";
import { DEFAULT_CONFIG } from "../core/types";
import { injectBannerStyles } from "./banner-styles";

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

// Inject CSS on first mount (works for both npm and source imports)
onMounted(() => {
  injectBannerStyles();
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
