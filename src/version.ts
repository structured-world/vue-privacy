/**
 * Package version injected at build time from package.json.
 * Use this to display the library version in debug panels or diagnostics.
 */
declare const __VUE_PRIVACY_VERSION__: string;

export const VERSION: string =
  typeof __VUE_PRIVACY_VERSION__ !== "undefined" ? __VUE_PRIVACY_VERSION__ : "dev";
