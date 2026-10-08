/**
 * Replaces `document.cookie` with an in-memory jar the test owns (`read` / `write` its raw
 * string), behaving like a browser's for the library's use: a write replaces the cookie of the
 * same name, a write that expires in the past deletes it, and attributes (path, expiry,
 * SameSite) are dropped from what is read back. A test may also set the jar directly, as
 * another tab's write would.
 */
export function installCookieJar(read: () => string, write: (jar: string) => void): void {
  Object.defineProperty(document, "cookie", {
    get: read,
    set: (value: string) => {
      const [nameValue] = value.split(";");
      const [name] = nameValue.split("=");
      const kept = read()
        .split(";")
        .map((c) => c.trim())
        .filter((c) => c && !c.startsWith(`${name}=`));
      // A deletion is an expiry in the past; the value itself may contain "1970" (a timestamp).
      if (!/;\s*expires=Thu, 01 Jan 1970/i.test(value)) kept.push(nameValue);
      write(kept.join("; "));
    },
    configurable: true,
  });
}
