import type { Translations } from "../types";

export const ja: Translations = {
  banner: {
    title: "Cookieの同意",
    message:
      "当サイトでは、エクスペリエンス向上のためにCookieを使用しています。すべてのCookieを受け入れるか、設定をカスタマイズできます。",
    acceptAll: "すべて許可",
    rejectAll: "すべて拒否",
    customize: "カスタマイズ",
    privacyLinkText: "プライバシーポリシー",
  },
  preferenceCenter: {
    title: "プライバシー設定",
    description: "許可するCookieを選択してください。これらの設定はいつでも変更できます。",
    savePreferences: "設定を保存",
    acceptAll: "すべて許可",
    categories: {
      necessary: {
        name: "必要不可欠",
        description:
          "これらのCookieは、ウェブサイトが正常に機能するために不可欠です。無効にすることはできません。",
      },
      analytics: {
        name: "アナリティクス",
        description:
          "これらのCookieは、訪問者がウェブサイトとどのようにやり取りしているかを理解するために、匿名で情報を収集・報告します。",
      },
      marketing: {
        name: "マーケティング",
        description:
          "これらのCookieは、関連性の高い広告を表示するために、ウェブサイト間で訪問者を追跡するために使用されます。",
      },
      functional: {
        name: "機能性",
        description:
          "これらのCookieは、言語設定などの拡張機能とパーソナライゼーションを可能にします。",
      },
    },
  },
};
