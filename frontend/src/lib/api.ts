export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  request_id?: string;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || "Something went wrong");
    this.code = body.code || "INTERNAL_ERROR";
    this.status = status;
    this.details = body.details;
  }
}

const BASE_URL = process.env.API_URL ?? "http://localhost:5000/api/v1";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : {};
  if (!res.ok) {
    const err = (body as { error?: ApiErrorBody }).error ?? {
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
    };
    throw new ApiError(res.status, err);
  }
  return body as T;
}

export const api = {
  get: <T,>(path: string) => request<T>(path, { method: "GET" }),
  post: <T,>(path: string, payload?: unknown) =>
    request<T>(path, { method: "POST", body: payload === undefined ? undefined : JSON.stringify(payload) }),
  patch: <T,>(path: string, payload?: unknown) =>
    request<T>(path, { method: "PATCH", body: payload === undefined ? undefined : JSON.stringify(payload) }),
  del: <T,>(path: string) => request<T>(path, { method: "DELETE" }),
  postRaw: async <T,>(path: string, raw: string): Promise<T> => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: raw,
    });
    const body = (await res.json()) as { error?: ApiErrorBody } & T;
    if (!res.ok) {
      throw new ApiError(res.status, body.error ?? { code: "INTERNAL_ERROR", message: "Failed" });
    }
    return body as T;
  },
};

export function formatINR(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}
