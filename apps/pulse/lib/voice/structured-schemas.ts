import { z } from 'zod';

/**
 * Named structured-output schemas the gateway exposes. Each entry pairs a
 * runtime Zod schema (for validation at the edge) with a JSON Schema
 * (Anthropic's tools API needs JSON Schema).
 *
 * Keep these in sync with the seed prompt templates in
 * packages/db/migrations/0007_voice_init.sql so the analytics tool can call
 * `output_schema_name: 'analytics.tag_post'` etc. and trust the shape.
 */

const TagPostSchema = z.object({
  pillar: z.enum([
    'educational',
    'promotional',
    'behind_the_scenes',
    'testimonial',
    'lifestyle',
    'news',
    'other',
  ]),
  hook_style: z.enum([
    'question',
    'statement',
    'list',
    'story',
    'contrarian',
    'none',
  ]),
  format_quality: z.number().int().min(1).max(5),
  reasoning: z.string().max(200),
});

const TagPostJsonSchema = {
  type: 'object',
  properties: {
    pillar: {
      type: 'string',
      enum: [
        'educational',
        'promotional',
        'behind_the_scenes',
        'testimonial',
        'lifestyle',
        'news',
        'other',
      ],
    },
    hook_style: {
      type: 'string',
      enum: ['question', 'statement', 'list', 'story', 'contrarian', 'none'],
    },
    format_quality: { type: 'integer', minimum: 1, maximum: 5 },
    reasoning: { type: 'string', maxLength: 200 },
  },
  required: ['pillar', 'hook_style', 'format_quality', 'reasoning'],
} as const;

const RecommendationSchema = z.object({
  recommendations: z
    .array(
      z.object({
        kind: z.enum([
          'new_post',
          'repeat_post',
          'change_format',
          'change_cadence',
          'pillar_rebalance',
          'audience_test',
        ]),
        title: z.string().max(60),
        rationale_md: z.string().max(400),
        evidence_post_ids: z.array(z.string()).default([]),
      })
    )
    .min(1)
    .max(8),
});

const RecommendationJsonSchema = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: [
              'new_post',
              'repeat_post',
              'change_format',
              'change_cadence',
              'pillar_rebalance',
              'audience_test',
            ],
          },
          title: { type: 'string', maxLength: 60 },
          rationale_md: { type: 'string', maxLength: 400 },
          evidence_post_ids: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['kind', 'title', 'rationale_md', 'evidence_post_ids'],
      },
    },
  },
  required: ['recommendations'],
} as const;

const ChartPickSchema = z.object({
  chart_type: z.enum(['line', 'bar', 'scatter', 'table']),
  x_axis: z.string(),
  y_axis: z.string(),
  series: z
    .array(
      z.object({
        label: z.string(),
        dataset_filter: z.string(),
      })
    )
    .default([]),
  title: z.string().max(80),
  explanation: z.string().max(200),
});

const ChartPickJsonSchema = {
  type: 'object',
  properties: {
    chart_type: {
      type: 'string',
      enum: ['line', 'bar', 'scatter', 'table'],
    },
    x_axis: { type: 'string' },
    y_axis: { type: 'string' },
    series: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          dataset_filter: { type: 'string' },
        },
        required: ['label', 'dataset_filter'],
      },
    },
    title: { type: 'string', maxLength: 80 },
    explanation: { type: 'string', maxLength: 200 },
  },
  required: ['chart_type', 'x_axis', 'y_axis', 'series', 'title', 'explanation'],
} as const;

export interface StructuredSchemaEntry {
  name: string;
  schema: z.ZodTypeAny;
  jsonSchema: Record<string, unknown>;
  description: string;
}

export const STRUCTURED_SCHEMAS: Record<string, StructuredSchemaEntry> = {
  'analytics.tag_post': {
    name: 'analytics_tag_post',
    schema: TagPostSchema,
    jsonSchema: TagPostJsonSchema as unknown as Record<string, unknown>,
    description:
      'Classify a single social post: pillar, hook style, format quality, reasoning.',
  },
  'analytics.recommendation': {
    name: 'analytics_recommendation',
    schema: RecommendationSchema,
    jsonSchema: RecommendationJsonSchema as unknown as Record<string, unknown>,
    description:
      'Return a list of 1-8 concrete recommendations for the next two weeks.',
  },
  'analytics.chart_pick': {
    name: 'analytics_chart_pick',
    schema: ChartPickSchema,
    jsonSchema: ChartPickJsonSchema as unknown as Record<string, unknown>,
    description:
      'Pick a chart spec for a natural-language question over a metrics dataset.',
  },
};

export const STRUCTURED_SCHEMA_NAMES = Object.keys(
  STRUCTURED_SCHEMAS
) as Array<keyof typeof STRUCTURED_SCHEMAS>;

export function getStructuredSchema(
  name: string
): StructuredSchemaEntry | null {
  return STRUCTURED_SCHEMAS[name] ?? null;
}
