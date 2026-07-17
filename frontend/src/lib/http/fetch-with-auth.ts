export async function fetchWithAuth(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...init?.headers,
    },
  });
}

