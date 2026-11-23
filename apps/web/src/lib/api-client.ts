import { ApiResponse, ApiErrorResponse } from "@civictrack/contracts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export interface ApiClientOptions extends RequestInit {
  token?: string | null;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly statusCode: number;

  constructor(message: string, code = "API_ERROR", statusCode = 500, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const { token, headers = {}, ...customConfig } = options;

  let url: string;
  if (endpoint.startsWith("http")) {
    url = endpoint;
  } else if (typeof window !== "undefined") {
    // In browser client: use relative path /api/v1/... to leverage Next.js rewrites and cookies smoothly
    const cleanEndpoint = endpoint.replace(/^\/?(api\/v1\/)?/, "");
    url = `/api/v1/${cleanEndpoint}`;
  } else {
    // In server environment: use configured API_BASE_URL
    const cleanEndpoint = endpoint.replace(/^\/?(api\/v1\/)?/, "");
    url = `${API_BASE_URL.replace(/\/$/, "")}/${cleanEndpoint}`;
  }

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers as Record<string, string>),
  };

  const response = await fetch(url, {
    credentials: "include",
    ...customConfig,
    headers: requestHeaders,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorBody = data as ApiErrorResponse;
    throw new ApiError(
      errorBody.error?.message || `Request failed with status ${response.status}`,
      errorBody.error?.code || "HTTP_ERROR",
      response.status,
      errorBody.error?.details
    );
  }

  const successBody = data as ApiResponse<T>;
  return successBody.data;
}
