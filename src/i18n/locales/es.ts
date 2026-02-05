import type { Translations } from "../types";

export const es: Translations = {
  banner: {
    title: "Consentimiento de cookies",
    message:
      "Usamos cookies para mejorar su experiencia. Puede aceptar todas las cookies o personalizar sus preferencias.",
    acceptAll: "Aceptar todo",
    rejectAll: "Rechazar todo",
    customize: "Personalizar",
    privacyLinkText: "Política de privacidad",
  },
  preferenceCenter: {
    title: "Preferencias de privacidad",
    description:
      "Elija qué cookies desea permitir. Puede cambiar esta configuración en cualquier momento.",
    savePreferences: "Guardar preferencias",
    acceptAll: "Aceptar todo",
    categories: {
      necessary: {
        name: "Estrictamente necesarias",
        description:
          "Estas cookies son esenciales para el correcto funcionamiento del sitio web. No se pueden desactivar.",
      },
      analytics: {
        name: "Analíticas",
        description:
          "Estas cookies nos ayudan a entender cómo los visitantes interactúan con nuestro sitio web, recopilando y reportando información de forma anónima.",
      },
      marketing: {
        name: "Marketing",
        description:
          "Estas cookies se utilizan para rastrear a los visitantes en los sitios web y mostrar anuncios relevantes.",
      },
      functional: {
        name: "Funcionales",
        description:
          "Estas cookies permiten funcionalidades mejoradas y personalización, como las preferencias de idioma.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
