/** Hostname without port, lowercased. */
export function parseHostname(host: string | null): string {
  return (host ?? "").split(":")[0].toLowerCase();
}

/**
 * App traffic: `app.auco-ai.com`, `app.localhost` (dev).
 * Override with APP_HOSTNAME when needed.
 */
export function isAppHost(host: string | null): boolean {
  const hostname = parseHostname(host);

  if (!hostname) {
    return false;
  }

  const configured = process.env.APP_HOSTNAME?.toLowerCase();

  if (configured && hostname === configured) {
    return true;
  }

  return hostname === "app.auco-ai.com" || hostname.startsWith("app.");
}
