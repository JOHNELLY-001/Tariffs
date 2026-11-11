import { z } from 'zod';
import { CALCULATION_STATES, MATCH_TYPES, RATE_KINDS } from '../config/constants.js';
import { importCostRequestSchema } from '../modules/calculations/calculation.schemas.js';

/**
 * OpenAPI document generation.
 *
 * Request schemas are converted directly from the Zod validators that the API
 * actually executes, so the documentation cannot silently drift from
 * validation. Response schemas are declared once here and referenced by every
 * documented endpoint.
 */

type JsonSchema = Record<string, unknown>;

function fromZod(schema: z.ZodType): JsonSchema {
  return z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io: 'input',
    unrepresentable: 'any',
  }) as unknown as JsonSchema;
}

const nullable = (type: string) => ({ type, nullable: true });

const rateComponent: JsonSchema = {
  type: 'object',
  required: ['kind', 'amount', 'currency', 'unit', 'text'],
  properties: {
    kind: { type: 'string', enum: ['percentage', 'specific'] },
    amount: { type: 'number', nullable: true, description: 'Magnitude exactly as written. Not a computed duty.' },
    currency: { type: 'string', nullable: true },
    unit: { type: 'string', nullable: true },
    text: { type: 'string', description: 'Source fragment this component was read from.' },
  },
};

const rateAnalysis: JsonSchema = {
  type: 'object',
  required: ['raw', 'kind', 'isSensitiveItem', 'components', 'warnings', 'classifiedFromSource'],
  description: 'Derived classification of the source rate text. Never a computed amount.',
  properties: {
    raw: { type: 'string', nullable: true },
    kind: { type: 'string', enum: [...RATE_KINDS] },
    isSensitiveItem: {
      type: 'boolean',
      description: 'True when the source rate references Sensitive Items treatment (for example "SI").',
    },
    components: { type: 'array', items: { $ref: '#/components/schemas/RateComponent' } },
    warnings: { type: 'array', items: { type: 'string' } },
    classifiedFromSource: { type: 'boolean' },
  },
};

const tariff: JsonSchema = {
  type: 'object',
  description: 'A tariff-line record. Source values are returned exactly as stored.',
  required: ['id', 'hsCode', 'description', 'quantity', 'rate', 'heading', 'sourcePage', 'extractionPhase', 'scheduleType', 'createdAt', 'chapterCode', 'rateAnalysis'],
  properties: {
    id: { type: 'integer', description: 'Stable database identifier.' },
    hsCode: { type: 'string', description: 'HS code exactly as stored; never rewritten.' },
    description: nullable('string'),
    quantity: nullable('string'),
    rate: { type: 'string', nullable: true, description: 'Original source rate text (may be SI, compound, specific or null).' },
    heading: nullable('string'),
    sourcePage: { type: 'integer', nullable: true },
    extractionPhase: {
      type: 'integer',
      nullable: true,
      description: 'Extraction phase number as stored (integer in the live schema). A source fact, never interpreted.',
    },
    scheduleType: {
      type: 'string',
      nullable: true,
      description: 'Schedule the row belongs to, for example MAIN_TARIFF or SENSITIVE_ITEMS. Preserved verbatim.',
    },
    createdAt: { type: 'string', nullable: true, format: 'date-time' },
    chapterCode: { ...nullable('string'), description: 'Verified chapter link when the column exists; otherwise null.' },
    rateAnalysis: { $ref: '#/components/schemas/RateAnalysis' },
  },
};

const chapter: JsonSchema = {
  type: 'object',
  required: ['id', 'chapterCode', 'chapterTitle', 'chapterNotes', 'sourcePageStart', 'sourcePageEnd', 'createdAt', 'sectionCode'],
  properties: {
    id: { type: 'integer' },
    chapterCode: { type: 'string' },
    chapterTitle: nullable('string'),
    chapterNotes: { ...nullable('string'), description: 'Verbatim legal notes. Never summarized.' },
    sourcePageStart: { type: 'integer', nullable: true },
    sourcePageEnd: { type: 'integer', nullable: true },
    createdAt: { type: 'string', nullable: true, format: 'date-time' },
    sectionCode: { ...nullable('string'), description: 'Present only when the verified mapping column exists.' },
  },
};

const section: JsonSchema = {
  type: 'object',
  required: ['id', 'sectionCode', 'sectionTitle', 'sectionNotes', 'sourcePageStart', 'sourcePageEnd', 'createdAt'],
  properties: {
    id: { type: 'integer' },
    sectionCode: { type: 'string' },
    sectionTitle: nullable('string'),
    sectionNotes: { ...nullable('string'), description: 'Verbatim legal notes. Never summarized.' },
    sourcePageStart: { type: 'integer', nullable: true },
    sourcePageEnd: { type: 'integer', nullable: true },
    createdAt: { type: 'string', nullable: true, format: 'date-time' },
  },
};

const subheadingNote: JsonSchema = {
  type: 'object',
  required: ['id', 'chapterCode', 'sectionCode', 'noteNumber', 'subheadingReference', 'noteText', 'sourcePageStart', 'sourcePageEnd', 'ownership'],
  properties: {
    id: { type: 'integer' },
    chapterCode: nullable('string'),
    sectionCode: nullable('string'),
    noteNumber: nullable('string'),
    subheadingReference: nullable('string'),
    noteText: nullable('string'),
    sourcePageStart: { type: 'integer', nullable: true },
    sourcePageEnd: { type: 'integer', nullable: true },
    ownership: { type: 'string', enum: ['chapter', 'section', 'unassigned'] },
  },
};

const paginationMeta: JsonSchema = {
  type: 'object',
  required: ['page', 'pageSize', 'total', 'totalPages', 'hasNextPage', 'hasPreviousPage'],
  properties: {
    page: { type: 'integer' },
    pageSize: { type: 'integer' },
    total: { type: 'integer' },
    totalPages: { type: 'integer' },
    hasNextPage: { type: 'boolean' },
    hasPreviousPage: { type: 'boolean' },
  },
};

const componentSchemas: Record<string, JsonSchema> = {
  SuccessEnvelope: {
    type: 'object',
    required: ['success', 'data', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: { type: 'object' },
      meta: {
        type: 'object',
        required: ['requestId'],
        properties: { requestId: { type: 'string' } },
        additionalProperties: true,
      },
    },
  },
  ErrorEnvelope: {
    type: 'object',
    required: ['success', 'error', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [false] },
      error: {
        type: 'object',
        required: ['code', 'message', 'details'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: { path: { type: 'string' }, message: { type: 'string' }, code: { type: 'string' } },
            },
          },
        },
      },
      meta: { type: 'object', required: ['requestId'], properties: { requestId: { type: 'string' } } },
    },
  },
  PaginationMeta: paginationMeta,
  RateComponent: rateComponent,
  RateAnalysis: rateAnalysis,
  Tariff: tariff,
  Chapter: chapter,
  Section: section,
  SubheadingNote: subheadingNote,
  ClassificationContext: {
    type: 'object',
    required: ['tariff', 'chapter', 'section', 'subheadingNotes', 'sensitiveItemsReference', 'contextComplete', 'chapterSource', 'warnings', 'disclaimer'],
    properties: {
      tariff: { $ref: '#/components/schemas/Tariff' },
      chapter: { allOf: [{ $ref: '#/components/schemas/Chapter' }], nullable: true },
      section: { allOf: [{ $ref: '#/components/schemas/Section' }], nullable: true },
      subheadingNotes: { type: 'array', items: { $ref: '#/components/schemas/SubheadingNote' } },
      sensitiveItemsReference: {
        type: 'object',
        nullable: true,
        description:
          'Present only when the stored rate is an SI (Sensitive Items) reference. Lists SENSITIVE_ITEMS schedule rows sharing the HS code — a factual cross-reference, never a substituted rate.',
        required: ['reason', 'matches'],
        properties: {
          reason: { type: 'string' },
          matches: { type: 'array', items: { $ref: '#/components/schemas/Tariff' } },
        },
      },
      contextComplete: { type: 'boolean', description: 'True only when chapter and section are both verified.' },
      chapterSource: { type: 'string', enum: ['verified_column', 'derived_from_hs_code', 'none'] },
      warnings: { type: 'array', items: { type: 'string' } },
      disclaimer: { type: 'string' },
    },
  },
  ImportCostResult: {
    type: 'object',
    required: ['state', 'inputs', 'tariff', 'candidates', 'valuation', 'duty', 'tax', 'items', 'totals', 'assumptions', 'ruleIds', 'warnings', 'disclaimer', 'generatedAt'],
    properties: {
      state: { type: 'string', enum: [...CALCULATION_STATES] },
      inputs: { type: 'object', additionalProperties: true },
      tariff: {
        type: 'object',
        nullable: true,
        additionalProperties: true,
        description: 'Selected tariff line. Null when the code is ambiguous or resolved by no record.',
      },
      candidates: {
        type: 'array',
        description: 'Populated instead of `tariff` when multiple records share the code.',
        items: { type: 'object', additionalProperties: true },
      },
      valuation: { type: 'object', additionalProperties: true },
      duty: { type: 'object', additionalProperties: true },
      tax: { type: 'object', additionalProperties: true },
      items: { type: 'array', items: { type: 'object', additionalProperties: true } },
      totals: { type: 'object', nullable: true, description: 'Always null until verified rules exist.' },
      assumptions: { type: 'array', items: { type: 'string' } },
      ruleIds: { type: 'array', items: { type: 'string' } },
      warnings: { type: 'array', items: { type: 'string' } },
      disclaimer: { type: 'string' },
      generatedAt: { type: 'string', format: 'date-time' },
    },
  },
};

const errorResponses = {
  '400': { $ref: '#/components/responses/BadRequest' },
  '404': { $ref: '#/components/responses/NotFound' },
  '422': { $ref: '#/components/responses/Unprocessable' },
  '429': { $ref: '#/components/responses/RateLimited' },
  '500': { $ref: '#/components/responses/InternalError' },
} as const;

function okResponse(description: string, dataSchema: JsonSchema) {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/SuccessEnvelope' },
            { type: 'object', properties: { data: dataSchema } },
          ],
        },
      },
    },
  };
}

function jsonBody(schema: JsonSchema) {
  return { required: true, content: { 'application/json': { schema } } };
}

const pageParam = {
  name: 'page',
  in: 'query',
  required: false,
  schema: { type: 'integer', minimum: 1, default: 1 },
};
const pageSizeParam = {
  name: 'pageSize',
  in: 'query',
  required: false,
  schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
};

export function buildOpenApiDocument(apiBasePath: string) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'CET Tariff Information & Import Cost API',
      version: '1.0.0',
      description: [
        'Read-only tariff information API over the East African Community Common External Tariff (CET 2022, updated June 2025).',
        '',
        'A text-search or code match is a candidate tariff line, not a legally confirmed classification ruling.',
        'Original rates, quantities, descriptions and notes are returned exactly as stored; `SI` is a Sensitive Items reference, not a numeric rate.',
        'The calculation endpoint exposes the contract only: no duty, levy, VAT or landed cost is computed in this release.',
      ].join('\n'),
    },
    servers: [{ url: apiBasePath }],
    tags: [
      { name: 'Health' },
      { name: 'Search' },
      { name: 'Tariffs' },
      { name: 'Sections' },
      { name: 'Chapters' },
      { name: 'Notes' },
      { name: 'Calculations' },
    ],
    paths: {
      '/health/live': {
        get: {
          tags: ['Health'],
          summary: 'Liveness probe',
          responses: { '200': okResponse('Process is running.', { type: 'object', additionalProperties: true }) },
        },
      },
      '/health/ready': {
        get: {
          tags: ['Health'],
          summary: 'Readiness probe (verifies database connectivity)',
          responses: {
            '200': okResponse('Ready to serve tariff traffic.', { type: 'object', additionalProperties: true }),
            '503': { $ref: '#/components/responses/ServiceUnavailable' },
          },
        },
      },
      '/search': {
        get: {
          tags: ['Search'],
          summary: 'Search tariff codes and descriptions',
          description:
            'Exact HS-code matches rank above code-prefix and description matches. `matchType` and `relevance` are search metadata, not classification confidence.',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2, maxLength: 120 } },
            { name: 'chapter_code', in: 'query', required: false, schema: { type: 'string', pattern: '^\\d{1,2}$' } },
            {
              name: 'schedule_type',
              in: 'query',
              required: false,
              description: 'Restrict results to one schedule, for example MAIN_TARIFF or SENSITIVE_ITEMS.',
              schema: { type: 'string', maxLength: 40 },
            },
            pageParam,
            pageSizeParam,
          ],
          responses: {
            '200': okResponse('Paginated search results.', {
              type: 'object',
              required: ['items'],
              properties: {
                items: {
                  type: 'array',
                  items: {
                    allOf: [
                      { $ref: '#/components/schemas/Tariff' },
                      {
                        type: 'object',
                        properties: {
                          matchType: { type: 'string', enum: [...MATCH_TYPES] },
                          relevance: { type: 'number', minimum: 0, maximum: 1 },
                        },
                      },
                    ],
                  },
                },
              },
            }),
            ...errorResponses,
          },
        },
      },
      '/tariffs/{id}': {
        get: {
          tags: ['Tariffs'],
          summary: 'Retrieve a tariff line by database id',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
          responses: {
            '200': okResponse('The tariff line.', { $ref: '#/components/schemas/Tariff' }),
            '400': errorResponses['400'],
            '404': errorResponses['404'],
            '429': errorResponses['429'],
            '500': errorResponses['500'],
          },
        },
      },
      '/tariffs/hs/{code}': {
        get: {
          tags: ['Tariffs'],
          summary: 'Exact HS-code lookup',
          description:
            'Dots, spaces, hyphens and slashes are ignored for comparison. The stored code is returned unchanged. When several records share the code, all matches are returned and `ambiguous` is true.',
          parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string', minLength: 2, maxLength: 40 } }],
          responses: {
            '200': okResponse('Candidate tariff lines. Never a single silent choice.', {
              type: 'object',
              required: ['matches'],
              properties: { matches: { type: 'array', items: { $ref: '#/components/schemas/Tariff' } } },
            }),
            '400': errorResponses['400'],
            '404': errorResponses['404'],
            '429': errorResponses['429'],
            '500': errorResponses['500'],
          },
        },
      },
      '/tariffs/{id}/notes': {
        get: {
          tags: ['Notes'],
          summary: 'Classification context for a tariff line',
          description: 'Chapter, section and applicable subheading guidance, retrieved in a bounded number of queries.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
          responses: {
            '200': okResponse('Classification context.', { $ref: '#/components/schemas/ClassificationContext' }),
            '400': errorResponses['400'],
            '404': errorResponses['404'],
            '429': errorResponses['429'],
            '500': errorResponses['500'],
          },
        },
      },
      '/sections': {
        get: {
          tags: ['Sections'],
          summary: 'List sections',
          parameters: [pageParam, pageSizeParam],
          responses: {
            '200': okResponse('Paginated sections.', {
              type: 'object',
              properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Section' } } },
            }),
            ...errorResponses,
          },
        },
      },
      '/sections/{code}': {
        get: {
          tags: ['Sections'],
          summary: 'Section detail with chapters and notes',
          parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': okResponse('Section detail. `chapters` is null until the mapping is verified.', {
              type: 'object',
              properties: {
                section: { $ref: '#/components/schemas/Section' },
                chapters: { type: 'array', items: { $ref: '#/components/schemas/Chapter' }, nullable: true },
                chapterCount: { type: 'integer', nullable: true },
                contextComplete: { type: 'boolean' },
                warnings: { type: 'array', items: { type: 'string' } },
              },
            }),
            '404': errorResponses['404'],
            '429': errorResponses['429'],
            '500': errorResponses['500'],
          },
        },
      },
      '/chapters': {
        get: {
          tags: ['Chapters'],
          summary: 'List chapters, optionally filtered by section',
          parameters: [
            { name: 'section_code', in: 'query', required: false, schema: { type: 'string' } },
            pageParam,
            pageSizeParam,
          ],
          responses: {
            '200': okResponse('Paginated chapters.', {
              type: 'object',
              properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Chapter' } } },
            }),
            ...errorResponses,
          },
        },
      },
      '/chapters/{code}': {
        get: {
          tags: ['Chapters'],
          summary: 'Chapter detail with notes and section summary',
          parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string', pattern: '^\\d{1,2}$' } }],
          responses: {
            '200': okResponse('Chapter detail.', { type: 'object', additionalProperties: true }),
            '400': errorResponses['400'],
            '404': errorResponses['404'],
            '429': errorResponses['429'],
            '500': errorResponses['500'],
          },
        },
      },
      '/chapters/{code}/tariffs': {
        get: {
          tags: ['Chapters'],
          summary: 'Tariff lines in a chapter',
          parameters: [
            { name: 'code', in: 'path', required: true, schema: { type: 'string', pattern: '^\\d{1,2}$' } },
            pageParam,
            pageSizeParam,
          ],
          responses: {
            '200': okResponse('Paginated tariff lines.', {
              type: 'object',
              properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Tariff' } } },
            }),
            '400': errorResponses['400'],
            '429': errorResponses['429'],
            '500': errorResponses['500'],
          },
        },
      },
      '/subheading-notes': {
        get: {
          tags: ['Notes'],
          summary: 'List or filter subheading guidance',
          parameters: [
            { name: 'chapter_code', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'section_code', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'reference', in: 'query', required: false, schema: { type: 'string' } },
            pageParam,
            pageSizeParam,
          ],
          responses: {
            '200': okResponse('Paginated subheading notes.', {
              type: 'object',
              properties: { items: { type: 'array', items: { $ref: '#/components/schemas/SubheadingNote' } } },
            }),
            ...errorResponses,
          },
        },
      },
      '/calculations/import-cost': {
        post: {
          tags: ['Calculations'],
          summary: 'Import-cost calculation foundation',
          description:
            'Validates the request and reports `unsupported` or `needs_review` until verified valuation, duty and tax rules are configured. No amount is invented.',
          requestBody: jsonBody(fromZod(importCostRequestSchema)),
          responses: {
            '200': okResponse('Calculation contract result.', { $ref: '#/components/schemas/ImportCostResult' }),
            '400': errorResponses['400'],
            '404': errorResponses['404'],
            '422': errorResponses['422'],
            '429': errorResponses['429'],
            '500': errorResponses['500'],
          },
        },
      },
    },
    components: {
      schemas: componentSchemas,
      responses: {
        BadRequest: {
          description: 'Invalid request parameters.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
        },
        NotFound: {
          description: 'Resource not found.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
        },
        Unprocessable: {
          description: 'The request is understood but cannot be processed.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
        },
        RateLimited: {
          description: 'Too many requests.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
        },
        ServiceUnavailable: {
          description: 'Database not configured or unreachable.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
        },
        InternalError: {
          description: 'Unexpected server error. No internal detail is exposed.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
        },
      },
    },
  };
}
