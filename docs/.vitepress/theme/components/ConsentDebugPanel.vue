<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useConsent } from "../../../../src/vue/index";
import { categoriesToGoogleSignals, VERSION } from "../../../../src/index";
import type {
  GeoDetectionResult,
  GeoDetectionLogEntry,
  StoredConsent,
  GoogleConsentSignals,
} from "../../../../src/core/types";

const expanded = ref(false);
const initialized = ref(false);
const hasConsent = ref(false);
const isEU = ref<boolean | null>(null);
const geoResult = ref<GeoDetectionResult | null>(null);
const geoLog = ref<GeoDetectionLogEntry[]>([]);
const consent = ref<StoredConsent | null>(null);
const googleSignals = ref<GoogleConsentSignals | null>(null);
const rawPreferences = ref("");
const rawUid = ref("");
const showCookies = ref(false);
const showGeoLog = ref(false);

const methodLabels: Record<string, string> = {
  cloudflare: "Cloudflare Header",
  worker: "Cloudflare Worker",
  api: "IP API (ipapi.co)",
  fallback: "Timezone Heuristic",
  manual: "Manual Override",
};

let consentApi: ReturnType<typeof useConsent> | null = null;

function getCookieValue(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function refresh() {
  if (!consentApi) return;
  initialized.value = consentApi.manager.isInitialized();
  hasConsent.value = consentApi.hasConsent();
  isEU.value = consentApi.isEUUser();
  geoResult.value = consentApi.getGeoResult();
  geoLog.value = consentApi.manager.getGeoDetectionLog();
  consent.value = consentApi.getConsent();

  if (consent.value) {
    googleSignals.value = categoriesToGoogleSignals(consent.value.categories);
  } else {
    googleSignals.value = null;
  }

  rawPreferences.value = getCookieValue("consent_preferences");
  rawUid.value = getCookieValue("consent_uid");
}

function resetConsent() {
  if (!consentApi) return;
  consentApi.resetConsent();
  // Re-read state after reset
  setTimeout(refresh, 100);
}

function toggle() {
  expanded.value = !expanded.value;
  if (expanded.value) refresh();
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

onMounted(() => {
  try {
    consentApi = useConsent();
    // Listen for consent changes via config callback
    const origCallback = consentApi.manager.getConfig().onConsentChange;
    const config = consentApi.manager.getConfig();
    config.onConsentChange = (c) => {
      origCallback?.(c);
      setTimeout(refresh, 50);
    };
    refresh();
  } catch {
    // useConsent() may throw if plugin not yet installed (SSR)
  }
});
</script>

<template>
  <div class="consent-debug-widget" :class="{ expanded }">
    <!-- Collapsed button -->
    <button
      v-if="!expanded"
      class="debug-tab"
      @click="toggle"
      aria-label="Consent Debug Panel"
      title="Consent Debug Panel"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      <span class="debug-tab-text">Debug</span>
    </button>

    <!-- Expanded panel -->
    <div v-else class="debug-panel" role="dialog" aria-label="Consent Debug Panel">
      <div class="debug-header">
        <span class="debug-title"
          >Consent Debug <span class="debug-version">v{{ VERSION }}</span></span
        >
        <button class="debug-close" @click="toggle" aria-label="Close">&times;</button>
      </div>

      <div class="debug-body">
        <!-- Status -->
        <div class="debug-section">
          <div class="debug-section-title">Status</div>
          <div class="debug-row">
            <span class="debug-label">Initialized</span>
            <span :class="initialized ? 'val-yes' : 'val-no'">{{
              initialized ? "Yes" : "No"
            }}</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Has consent</span>
            <span :class="hasConsent ? 'val-yes' : 'val-no'">{{ hasConsent ? "Yes" : "No" }}</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">EU user</span>
            <span :class="isEU === true ? 'val-yes' : isEU === false ? 'val-no' : 'val-pending'">
              {{ isEU === null ? "Pending" : isEU ? "Yes" : "No" }}
            </span>
          </div>
        </div>

        <!-- Geo Detection -->
        <div class="debug-section">
          <div class="debug-section-title">Geo Detection</div>
          <template v-if="geoResult">
            <div class="debug-row">
              <span class="debug-label">Country</span>
              <span class="val-code">{{ geoResult.countryCode || "N/A" }}</span>
            </div>
            <div class="debug-row">
              <span class="debug-label">Method</span>
              <span class="val-code">{{ methodLabels[geoResult.method] || geoResult.method }}</span>
            </div>
            <div class="debug-row">
              <span class="debug-label">Is EU</span>
              <span :class="geoResult.isEU ? 'val-yes' : 'val-no'">{{ geoResult.isEU }}</span>
            </div>
            <!-- Detection Log (collapsible) -->
            <button
              v-if="geoLog.length > 0"
              class="debug-section-toggle debug-log-toggle"
              :aria-expanded="showGeoLog"
              @click="showGeoLog = !showGeoLog"
            >
              Detection Log {{ showGeoLog ? "▾" : "▸" }}
            </button>
            <div v-if="showGeoLog && geoLog.length > 0" class="debug-geo-log">
              <table class="geo-log-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Result</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(entry, idx) in geoLog"
                    :key="idx"
                    :class="{
                      'log-success': entry.status === 'success',
                      'log-failed': entry.status === 'failed',
                      'log-skipped': entry.status === 'skipped',
                    }"
                  >
                    <td>{{ methodLabels[entry.method] || entry.method }}</td>
                    <td>
                      <span
                        :class="{
                          'val-yes': entry.status === 'success',
                          'val-no': entry.status === 'failed',
                          'val-pending': entry.status === 'skipped',
                        }"
                      >
                        {{ entry.status }}
                      </span>
                    </td>
                    <td>
                      <template v-if="entry.result">
                        EU: {{ entry.result.isEU ? "Yes" : "No" }}
                        <span v-if="entry.result.countryCode"
                          >({{ entry.result.countryCode }})</span
                        >
                      </template>
                      <template v-else-if="entry.error">
                        <span class="val-code val-error">{{ entry.error }}</span>
                      </template>
                      <span v-else>-</span>
                    </td>
                    <td class="val-code">{{ entry.duration }}ms</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
          <div v-else class="debug-note">No geo data available</div>
        </div>

        <!-- Consent Categories -->
        <div class="debug-section">
          <div class="debug-section-title">Consent</div>
          <template v-if="consent">
            <div class="debug-row" v-for="(val, key) in consent.categories" :key="key">
              <span class="debug-label">{{ key }}</span>
              <span :class="val ? 'val-granted' : 'val-denied'">{{
                val ? "Granted" : "Denied"
              }}</span>
            </div>
            <div class="debug-row">
              <span class="debug-label">Timestamp</span>
              <span class="val-code">{{ formatTimestamp(consent.timestamp) }}</span>
            </div>
            <div class="debug-row">
              <span class="debug-label">Version</span>
              <span class="val-code">{{ consent.version }}</span>
            </div>
          </template>
          <div v-else class="debug-note">No consent yet</div>
        </div>

        <!-- Google Consent Mode -->
        <div class="debug-section">
          <div class="debug-section-title">Google Consent Mode v2</div>
          <template v-if="googleSignals">
            <div class="debug-row" v-for="(val, key) in googleSignals" :key="key">
              <span class="debug-label">{{ key }}</span>
              <span :class="val === 'granted' ? 'val-granted' : 'val-denied'">{{ val }}</span>
            </div>
          </template>
          <div v-else class="debug-note">N/A</div>
        </div>

        <!-- Cookies (collapsible) -->
        <div class="debug-section">
          <button
            class="debug-section-toggle"
            :aria-expanded="showCookies"
            @click="showCookies = !showCookies"
          >
            Cookies {{ showCookies ? "▾" : "▸" }}
          </button>
          <div v-if="showCookies" class="debug-cookies">
            <div class="debug-row">
              <span class="debug-label">consent_uid</span>
              <span class="val-code val-mono">{{ rawUid || "(empty)" }}</span>
            </div>
            <div class="debug-cookie-raw">
              <span class="debug-label">consent_preferences</span>
              <pre class="val-pre">{{ rawPreferences || "(empty)" }}</pre>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="debug-actions">
          <button class="debug-btn debug-btn-reset" @click="resetConsent">Reset Consent</button>
          <button class="debug-btn debug-btn-refresh" @click="refresh">Refresh</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.consent-debug-widget {
  position: fixed;
  left: 24px;
  bottom: 24px;
  z-index: 100;
}

.debug-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.debug-tab:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.debug-tab-text {
  display: none;
}

@media (min-width: 640px) {
  .debug-tab-text {
    display: inline;
  }
}

.debug-panel {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  width: 320px;
  max-height: 70vh;
  overflow-y: auto;
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.debug-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--vp-c-text-1);
}

.debug-version {
  font-weight: 400;
  font-size: 11px;
  color: var(--vp-c-text-3);
  margin-left: 4px;
}

.debug-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--vp-c-text-2);
  padding: 0 4px;
  line-height: 1;
}

.debug-close:hover {
  color: var(--vp-c-text-1);
}

.debug-body {
  padding: 12px 16px;
}

.debug-section {
  margin-bottom: 12px;
}

.debug-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
  margin-bottom: 6px;
}

.debug-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
  font-size: 13px;
}

.debug-label {
  color: var(--vp-c-text-2);
}

.val-yes,
.val-granted {
  color: var(--vp-c-green-1, #10b981);
  font-weight: 500;
}

.val-no,
.val-denied {
  color: var(--vp-c-red-1, #ef4444);
  font-weight: 500;
}

.val-pending {
  color: var(--vp-c-yellow-1, #f59e0b);
  font-weight: 500;
}

.val-code {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-1);
}

.val-mono {
  font-size: 11px;
  word-break: break-all;
}

.debug-note {
  font-size: 12px;
  color: var(--vp-c-text-3);
  font-style: italic;
  padding: 4px 0;
}

.debug-section-toggle {
  background: none;
  border: none;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
  cursor: pointer;
  padding: 0;
  margin-bottom: 6px;
}

.debug-section-toggle:hover {
  color: var(--vp-c-text-2);
}

.debug-cookies {
  margin-top: 4px;
}

.debug-cookie-raw {
  margin-top: 4px;
}

.debug-cookie-raw .debug-label {
  display: block;
  font-size: 12px;
  margin-bottom: 2px;
}

.val-pre {
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  background: var(--vp-c-bg-soft);
  border-radius: 4px;
  padding: 6px 8px;
  margin: 0;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--vp-c-text-2);
}

.debug-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--vp-c-divider);
}

.debug-btn {
  flex: 1;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.debug-btn-reset {
  background: var(--vp-c-red-soft, #fef2f2);
  color: var(--vp-c-red-1, #ef4444);
  border: 1px solid var(--vp-c-red-dimm-1, #fecaca);
}

.debug-btn-reset:hover {
  background: var(--vp-c-red-dimm-1, #fecaca);
}

.debug-btn-refresh {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-divider);
}

.debug-btn-refresh:hover {
  background: var(--vp-c-bg-mute);
}

/* Geo detection log styles */
.debug-log-toggle {
  margin-top: 8px;
}

.debug-geo-log {
  margin-top: 8px;
  overflow-x: auto;
}

.geo-log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.geo-log-table th,
.geo-log-table td {
  padding: 4px 6px;
  text-align: left;
  border-bottom: 1px solid var(--vp-c-divider);
}

.geo-log-table th {
  font-weight: 600;
  color: var(--vp-c-text-2);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.geo-log-table tr.log-success {
  background: var(--vp-c-green-soft, rgba(16, 185, 129, 0.1));
}

.geo-log-table tr.log-failed {
  background: transparent;
}

.geo-log-table tr.log-skipped {
  background: transparent;
  opacity: 0.7;
}

.val-error {
  color: var(--vp-c-red-1, #ef4444);
  font-size: 10px;
  word-break: break-word;
}

@media (prefers-reduced-motion: reduce) {
  .debug-panel {
    animation: none;
  }
  .debug-tab {
    transition: none;
  }
}
</style>
