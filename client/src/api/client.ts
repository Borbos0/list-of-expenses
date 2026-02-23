export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }
  Object.assign(headers, options?.headers);

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    if (!url.includes('/auth/me') && !url.includes('/auth/login')) {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}
