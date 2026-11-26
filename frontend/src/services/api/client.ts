import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import type { ApiEnvelope, ApiErrorDetail } from '@/types/api';
import { API_BASE_URL, API_TIMEOUT_MS } from './config';

/**
 * Normalised API failure.
 *
 * Only safe, human-readable details are exposed. Backend stack traces, SQL and
 * credentials are never surfaced to the interface.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: ApiErrorDetail[];
  readonly requestId: string | null;

  constructor(
    message: string,
    options: {
      code: string;
      status?: number;
      details?: ApiErrorDetail[];
      requestId?: string | null;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status ?? 0;
    this.details = options.details ?? [];
    this.requestId = options.requestId ?? null;
  }
}

function toApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    return new ApiError('An unexpected client error occurred.', { code: 'CLIENT_ERROR' });
  }

  const status = error.response?.status ?? 0;
  const payload = error.response?.data as ApiEnvelope<unknown> | undefined;
  const headerRequestId = error.response?.headers?.['x-request-id'];

  if (payload && payload.success === false) {
    return new ApiError(payload.error.message, {
      code: payload.error.code,
      status,
      details: payload.error.details,
      requestId: payload.meta?.requestId ?? (typeof headerRequestId === 'string' ? headerRequestId : null),
    });
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new ApiError('The request to the tariff service timed out. Please try again.', {
      code: 'REQUEST_TIMEOUT',
      status,
    });
  }

  if (status > 0) {
    return new ApiError(`The tariff service returned an unexpected response (HTTP ${status}).`, {
      code: 'UNEXPECTED_RESPONSE',
      status,
    });
  }

  return new ApiError(
    'Unable to reach the tariff service. Check that the backend is running and that VITE_API_BASE_URL is correct.',
    { code: 'NETWORK_ERROR' },
  );
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
);

export interface ApiResult<T> {
  data: T;
  meta: Record<string, unknown> & { requestId?: string };
}

/** Unwraps the backend envelope and turns a false-success payload into an error. */
export async function unwrap<T>(
  request: Promise<AxiosResponse<ApiEnvelope<T>>>,
): Promise<ApiResult<T>> {
  const response = await request;
  const body = response.data;

  if (!body.success) {
    throw new ApiError(body.error.message, {
      code: body.error.code,
      status: response.status,
      details: body.error.details,
      requestId: body.meta?.requestId ?? null,
    });
  }

  return { data: body.data, meta: body.meta };
}
