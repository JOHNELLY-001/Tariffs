import { Router } from 'express';
import { sendSuccess } from '../../shared/http/response.js';
import { getLiveness, getReadiness } from './health.service.js';

export const healthRouter: Router = Router();

/** Liveness: the process is running. Never touches the database. */
healthRouter.get('/live', (_req, res) => {
  sendSuccess(res, getLiveness());
});

/** Readiness: the process can serve tariff traffic (database reachable). */
healthRouter.get('/ready', async (_req, res) => {
  const report = await getReadiness();
  if (report.status !== 'ok') {
    res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'The tariff database is not reachable',
        details: [{ path: 'database', message: report.checks.database.configured ? 'connection failed' : 'not configured' }],
      },
      meta: { requestId: res.locals.requestId ?? 'unavailable' },
    });
    return;
  }
  sendSuccess(res, report);
});

/** Backwards-compatible alias documented as the readiness endpoint. */
healthRouter.get('/', async (req, res, next) => {
  try {
    const report = await getReadiness();
    if (report.status !== 'ok') {
      res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'The tariff database is not reachable',
          details: [{ path: 'database', message: report.checks.database.configured ? 'connection failed' : 'not configured' }],
        },
        meta: { requestId: res.locals.requestId ?? 'unavailable' },
      });
      return;
    }
    sendSuccess(res, report);
  } catch (error) {
    next(error);
  }
});
