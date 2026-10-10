import { vi } from "vitest";

/** The browser's language preferences, most preferred first, as navigator reports them. */
export function preferLanguages(...tags: string[]): void {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(tags);
  vi.spyOn(navigator, "language", "get").mockReturnValue(tags[0]);
}
