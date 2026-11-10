import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { buildOpenApiDocument } from './docs/openapi.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestId } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { healthRouter } from './modules/health/health.routes.js';
import { buildApiRouter } from './routes/index.js';

/**
 * Express application factory.
 *
 * The app is built without listening so tests can drive it directly with
 * supertest, and so the HTTP server lifecycle stays in server.ts.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  // Plain query parsing: no nested objects, so validation input is predictable.
  app.set('query parser', 'simple');

  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: env.corsOrigins === '*' ? true : env.corsOrigins,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );

  app.use(requestId);
  app.use(requestLogger);

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many requests', details: [] },
          meta: { requestId: res.locals.requestId ?? 'unavailable' },
        });
      },
    }),
  );

  app.use(express.json({ limit: env.BODY_LIMIT, strict: true }));

  // Health probes live at the root, outside the versioned API.
  app.use('/health', healthRouter);

  const apiRouter = buildApiRouter();
  app.use(env.API_BASE_PATH, apiRouter);

  // OpenAPI contract and interactive reference.
  const document = buildOpenApiDocument(env.API_BASE_PATH);
  app.get(`${env.API_BASE_PATH}/openapi.json`, (_req, res) => {
    res.json(document);
  });
  app.use(`${env.API_BASE_PATH}/docs`, swaggerUi.serve, swaggerUi.setup(document, { customSiteTitle: 'CET Tariff API' }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
