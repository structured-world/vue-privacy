/**
 * Shared utility functions for vanilla components.
 */

/** HTML entity map for escaping */
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape HTML special characters for safe DOM insertion.
 * Uses string replacement for better performance than DOM-based approach.
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

/**
 * Sanitize URL for use in href attribute.
 * Blocks dangerous protocols (javascript:, data:, vbscript:) while allowing
 * relative paths, http/https URLs, and tel/mailto links.
 * Does NOT escape HTML entities - use escapeHtml() on the result when inserting into HTML.
 */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  const lowered = trimmed.toLowerCase();
  // Block dangerous protocols
  if (
    lowered.startsWith("javascript:") ||
    lowered.startsWith("data:") ||
    lowered.startsWith("vbscript:")
  ) {
    return "#";
  }
  // Return trimmed URL for consistency
  return trimmed;
}
