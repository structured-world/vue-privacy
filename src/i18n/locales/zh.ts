import type { Translations } from "../types";

export const zh: Translations = {
  banner: {
    title: "Cookie 同意",
    message: "我们使用 Cookie 来改善您的体验。您可以接受所有 Cookie 或自定义您的偏好设置。",
    acceptAll: "全部接受",
    rejectAll: "全部拒绝",
    customize: "自定义",
    privacyLinkText: "隐私政策",
  },
  preferenceCenter: {
    title: "隐私偏好设置",
    description: "选择您要允许的 Cookie。您可以随时更改这些设置。",
    savePreferences: "保存偏好设置",
    acceptAll: "全部接受",
    categories: {
      necessary: {
        name: "严格必要",
        description: "这些 Cookie 对于网站的正常运行至关重要，无法禁用。",
      },
      analytics: {
        name: "分析",
        description: "这些 Cookie 通过匿名收集和报告信息，帮助我们了解访问者如何与我们的网站互动。",
      },
      marketing: {
        name: "营销",
        description: "这些 Cookie 用于跨网站跟踪访问者，以展示相关广告。",
      },
      functional: {
        name: "功能性",
        description: "这些 Cookie 支持增强功能和个性化设置，例如语言偏好。",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
