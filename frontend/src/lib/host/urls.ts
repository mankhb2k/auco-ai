/** App entry — prod: `app.auco-ai.com`; dev: `http://localhost:8386/app`. */
export function getAppOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8386/app";
}

/** Marketing root domain (`auco-ai.com`). */
export function getMarketingOrigin(): string {
  return process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:8386";
}

export function appUrl(path = "/"): string {
  const origin = getAppOrigin().replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}

export function marketingUrl(path = "/"): string {
  const origin = getMarketingOrigin().replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}
