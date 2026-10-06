/** Reload the current page; kept in its own module so the consent flow can be tested without navigating. */
export function reloadPage(): void {
  if (typeof window !== "undefined") window.location.reload();
}
