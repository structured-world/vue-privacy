/**
 * The custom properties a stylesheet gives `el`, the system preferring a dark colour scheme or
 * not. jsdom evaluates no media queries, so this applies the rules in source order: the palette
 * rules differ in their condition, not in specificity, which order alone settles.
 */
export function customProperties(
  css: string,
  el: Element,
  prefersDark: boolean
): Record<string, string> {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  const result: Record<string, string> = {};
  try {
    const apply = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSMediaRule) {
          // Minified stylesheets write the query without spaces.
          const query = rule.media.mediaText.replace(/\s/g, "");
          if (query.includes("prefers-color-scheme:dark") && prefersDark) {
            apply(rule.cssRules);
          }
        } else if (rule instanceof CSSStyleRule && el.matches(rule.selectorText)) {
          for (const name of Array.from(rule.style)) {
            if (name.startsWith("--")) result[name] = rule.style.getPropertyValue(name).trim();
          }
        }
      }
    };
    apply((style.sheet as CSSStyleSheet).cssRules);
  } finally {
    style.remove();
  }
  return result;
}
