/** Live API when NEXT_PUBLIC_API_URL is set; otherwise mock/simulator mode. */
export function getApiBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function isLiveApi(): boolean {
  return Boolean(getApiBaseUrl());
}

export const DEMO_EMPLOYEE_HEADER = "X-Demo-Employee-Id";
