import type { Translations } from "../types";

export const el: Translations = {
  banner: {
    title: "Συναίνεση για cookies",
    message:
      "Χρησιμοποιούμε cookies για να βελτιώσουμε την εμπειρία σας. Μπορείτε να αποδεχτείτε όλα τα cookies ή να προσαρμόσετε τις προτιμήσεις σας.",
    acceptAll: "Αποδοχή όλων",
    rejectAll: "Απόρριψη όλων",
    customize: "Προσαρμογή",
    privacyLinkText: "Πολιτική απορρήτου",
  },
  preferenceCenter: {
    title: "Ρυθμίσεις απορρήτου",
    description:
      "Επιλέξτε ποια cookies θέλετε να επιτρέψετε. Μπορείτε να αλλάξετε αυτές τις ρυθμίσεις ανά πάσα στιγμή.",
    savePreferences: "Αποθήκευση προτιμήσεων",
    acceptAll: "Αποδοχή όλων",
    rejectAll: "Απόρριψη όλων",
    categories: {
      necessary: {
        name: "Απολύτως απαραίτητα",
        description:
          "Αυτά τα cookies είναι απαραίτητα για τη σωστή λειτουργία του ιστότοπου. Δεν μπορούν να απενεργοποιηθούν.",
      },
      analytics: {
        name: "Στατιστικά",
        description:
          "Αυτά τα cookies μας βοηθούν να κατανοήσουμε πώς οι επισκέπτες χρησιμοποιούν τον ιστότοπό μας, συλλέγοντας και αναφέροντας πληροφορίες ανώνυμα.",
      },
      marketing: {
        name: "Μάρκετινγκ",
        description:
          "Αυτά τα cookies χρησιμοποιούνται για την παρακολούθηση των επισκεπτών σε διάφορους ιστότοπους, ώστε να εμφανίζονται σχετικές διαφημίσεις.",
      },
      functional: {
        name: "Λειτουργικά",
        description:
          "Αυτά τα cookies επιτρέπουν βελτιωμένη λειτουργικότητα και εξατομίκευση, όπως τις προτιμήσεις γλώσσας.",
      },
    },
  },
  ccpa: {
    doNotSell: "Do Not Sell My Personal Information",
  },
};
