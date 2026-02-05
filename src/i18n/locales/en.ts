import type { Translations } from "../types";

export const en: Translations = {
  banner: {
    title: "Cookie Consent",
    message:
      "We use cookies to improve your experience. You can accept all cookies or customize your preferences.",
    acceptAll: "Accept All",
    rejectAll: "Reject All",
    customize: "Customize",
    privacyLinkText: "Privacy Policy",
  },
  preferenceCenter: {
    title: "Privacy Preferences",
    description:
      "Choose which cookies you want to allow. You can change these settings at any time.",
    savePreferences: "Save Preferences",
    acceptAll: "Accept All",
    categories: {
      necessary: {
        name: "Strictly Necessary",
        description:
          "These cookies are essential for the website to function properly. They cannot be disabled.",
      },
      analytics: {
        name: "Analytics",
        description:
          "These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.",
      },
      marketing: {
        name: "Marketing",
        description:
          "These cookies are used to track visitors across websites to display relevant advertisements.",
      },
      functional: {
        name: "Functional",
        description:
          "These cookies enable enhanced functionality and personalization, such as language preferences.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
