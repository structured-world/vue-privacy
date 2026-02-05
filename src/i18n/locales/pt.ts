import type { Translations } from "../types";

export const pt: Translations = {
  banner: {
    title: "Consentimento de cookies",
    message:
      "Usamos cookies para melhorar sua experiência. Você pode aceitar todos os cookies ou personalizar suas preferências.",
    acceptAll: "Aceitar tudo",
    rejectAll: "Rejeitar tudo",
    customize: "Personalizar",
    privacyLinkText: "Política de privacidade",
  },
  preferenceCenter: {
    title: "Preferências de privacidade",
    description:
      "Escolha quais cookies você deseja permitir. Você pode alterar essas configurações a qualquer momento.",
    savePreferences: "Salvar preferências",
    acceptAll: "Aceitar tudo",
    categories: {
      necessary: {
        name: "Estritamente necessários",
        description:
          "Estes cookies são essenciais para o funcionamento correto do site. Eles não podem ser desativados.",
      },
      analytics: {
        name: "Analíticos",
        description:
          "Estes cookies nos ajudam a entender como os visitantes interagem com nosso site, coletando e relatando informações de forma anônima.",
      },
      marketing: {
        name: "Marketing",
        description:
          "Estes cookies são usados para rastrear visitantes em sites e exibir anúncios relevantes.",
      },
      functional: {
        name: "Funcionais",
        description:
          "Estes cookies permitem funcionalidades aprimoradas e personalização, como preferências de idioma.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
