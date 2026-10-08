import type { ConsentCategories, ConsentConfig, OptionalCategory } from "./types";

/** Every optional category, in the order the preference centres list them. */
export const OPTIONAL_CATEGORIES: readonly OptionalCategory[] = [
  "analytics",
  "marketing",
  "functional",
];

/** The optional categories the site uses (`usedCategories`), in display order. */
export function usedCategoriesOf(config: Partial<ConsentConfig>): OptionalCategory[] {
  const used = config.usedCategories;
  return used ? OPTIONAL_CATEGORIES.filter((c) => used.includes(c)) : [...OPTIONAL_CATEGORIES];
}

/** `categories` with every category the site does not use refused. */
export function limitToUsed(
  categories: Omit<ConsentCategories, "necessary">,
  config: Partial<ConsentConfig>
): Omit<ConsentCategories, "necessary"> {
  const used = config.usedCategories;
  if (!used) return { ...categories };
  return {
    analytics: categories.analytics && used.includes("analytics"),
    marketing: categories.marketing && used.includes("marketing"),
    functional: categories.functional && used.includes("functional"),
  };
}
