/**
 * Central API configuration.
 *
 * Never hardcode a production URL. The deployed frontend must receive its API
 * base URL through `VITE_API_BASE_URL` at build time.
 */

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = configuredBaseUrl || 'http://localhost:3000/api/v1';

export const API_TIMEOUT_MS = 20_000;
