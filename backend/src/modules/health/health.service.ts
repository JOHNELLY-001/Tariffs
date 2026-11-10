import { checkDatabaseHealth } from '../../config/database.js';
import { env } from '../../config/env.js';

export interface LivenessReport {
  status: 'ok';
  service: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessReport {
  status: 'ok' | 'degraded';
  service: string;
  checks: {
    database: {
      configured: boolean;
      connected: boolean;
      latencyMs: number | null;
    };
  };
  timestamp: string;
}

export function getLiveness(): LivenessReport {
  return {
    status: 'ok',
    service: 'cet-tariff-backend',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

export async function getReadiness(): Promise<ReadinessReport> {
  const database = await checkDatabaseHealth();
  return {
    status: database.connected ? 'ok' : 'degraded',
    service: 'cet-tariff-backend',
    checks: { database },
    timestamp: new Date().toISOString(),
  };
}

export const healthEnvironment = {
  nodeEnv: env.NODE_ENV,
  apiBasePath: env.API_BASE_PATH,
};
