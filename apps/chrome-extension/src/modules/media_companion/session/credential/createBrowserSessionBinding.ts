export function createBrowserSessionBinding(): () => Promise<string> {
  const instance = crypto.getRandomValues(new Uint8Array(32));
  const bindingPromise = crypto.subtle.digest(
    "SHA-256",
    new Uint8Array([...new TextEncoder().encode("navia-media-browser-session/v1\0"), ...instance])
  ).then((digest) => {
    instance.fill(0);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  });
  return () => bindingPromise;
}
