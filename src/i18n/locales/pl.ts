import type { Translations } from "../types";

export const pl: Translations = {
  banner: {
    title: "Zgoda na pliki cookie",
    message:
      "Używamy plików cookie, aby poprawić Twoje doświadczenia. Możesz zaakceptować wszystkie pliki cookie lub dostosować swoje preferencje.",
    acceptAll: "Zaakceptuj wszystkie",
    rejectAll: "Odrzuć wszystkie",
    customize: "Dostosuj",
    privacyLinkText: "Polityka prywatności",
  },
  preferenceCenter: {
    title: "Ustawienia prywatności",
    description:
      "Wybierz, które pliki cookie chcesz zezwolić. Możesz zmienić te ustawienia w dowolnym momencie.",
    savePreferences: "Zapisz preferencje",
    acceptAll: "Zaakceptuj wszystkie",
    categories: {
      necessary: {
        name: "Ściśle niezbędne",
        description:
          "Te pliki cookie są niezbędne do prawidłowego funkcjonowania strony internetowej. Nie można ich wyłączyć.",
      },
      analytics: {
        name: "Analityczne",
        description:
          "Te pliki cookie pomagają nam zrozumieć, jak odwiedzający korzystają z naszej strony internetowej, zbierając i raportując informacje anonimowo.",
      },
      marketing: {
        name: "Marketingowe",
        description:
          "Te pliki cookie służą do śledzenia odwiedzających na stronach internetowych w celu wyświetlania odpowiednich reklam.",
      },
      functional: {
        name: "Funkcjonalne",
        description:
          "Te pliki cookie umożliwiają rozszerzoną funkcjonalność i personalizację, taką jak preferencje językowe.",
      },
    },
  },
};
