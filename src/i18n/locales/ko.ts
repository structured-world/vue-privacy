import type { Translations } from "../types";

export const ko: Translations = {
  banner: {
    title: "쿠키 동의",
    message:
      "더 나은 경험을 위해 쿠키를 사용합니다. 모든 쿠키를 수락하거나 환경설정을 맞춤 설정할 수 있습니다.",
    acceptAll: "모두 수락",
    rejectAll: "모두 거부",
    customize: "맞춤 설정",
    privacyLinkText: "개인정보 처리방침",
  },
  preferenceCenter: {
    title: "개인정보 설정",
    description: "허용할 쿠키를 선택하세요. 이 설정은 언제든지 변경할 수 있습니다.",
    savePreferences: "설정 저장",
    acceptAll: "모두 수락",
    categories: {
      necessary: {
        name: "필수 쿠키",
        description: "이 쿠키는 웹사이트의 정상적인 작동에 필수적입니다. 비활성화할 수 없습니다.",
      },
      analytics: {
        name: "분석",
        description:
          "이 쿠키는 방문자가 웹사이트와 어떻게 상호작용하는지 익명으로 정보를 수집하고 보고하여 이해하는 데 도움을 줍니다.",
      },
      marketing: {
        name: "마케팅",
        description:
          "이 쿠키는 관련 광고를 표시하기 위해 웹사이트 전반에서 방문자를 추적하는 데 사용됩니다.",
      },
      functional: {
        name: "기능",
        description: "이 쿠키는 언어 기본 설정과 같은 향상된 기능 및 개인화를 가능하게 합니다.",
      },
    },
  },
};
