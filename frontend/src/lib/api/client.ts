import { DEMO_EMPLOYEE_HEADER, getApiBaseUrl } from "./config";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiFetchOpts = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  employeeId?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
};

function buildUrl(path: string, query?: ApiFetchOpts["query"]): string {
  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError("NEXT_PUBLIC_API_URL is not set", 0);
  }
  const url = new URL(
    path.startsWith("/") ? path : `/${path}`,
    base.endsWith("/") ? base : `${base}/`,
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function apiFetch<T>(
  path: string,
  opts: ApiFetchOpts = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (opts.employeeId) {
    headers[DEMO_EMPLOYEE_HEADER] = opts.employeeId;
  }
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const message =
      typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      (typeof (parsed as { message: unknown }).message === "string" ||
        Array.isArray((parsed as { message: unknown }).message))
        ? Array.isArray((parsed as { message: unknown[] }).message)
          ? (parsed as { message: string[] }).message.join("; ")
          : String((parsed as { message: string }).message)
        : `HTTP ${res.status}`;
    throw new ApiError(message, res.status, parsed);
  }

  return parsed as T;
}
