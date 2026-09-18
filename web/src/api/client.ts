export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// In dev (and in a same-origin deploy) the Vite proxy / same domain makes a
// relative "/api" path work. Deployed as two separate Vercel projects, the
// frontend needs the API's own domain — set VITE_API_BASE_URL to that
// origin (no trailing slash, e.g. "https://parametric-demo-api.vercel.app").
export const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(method: string, path: string, body?: unknown, isFormData = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") headers["X-Parametric-Demo-Client"] = "1";
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(`${apiBase}/api${path}`, {
    method,
    credentials: "include",
    headers,
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? "UNKNOWN_ERROR", data?.message ?? res.statusText);
  }
  return data as T;
}

export const api = {
  get: <T,>(path: string) => request<T>("GET", path),
  post: <T,>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T,>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T,>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T,>(path: string) => request<T>("DELETE", path),
  postForm: <T,>(path: string, form: FormData) => request<T>("POST", path, form, true),
};
