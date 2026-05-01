import { z } from "zod";
import { getAiIntentExtractorProfile } from "../ai/ai-profiles";
import { createOpenAiJsonExtraction } from "../ai/providers/openai-provider";
import { extractJobConcepts, normalizeJobConcepts } from "./agent-domain-dictionary";
import {
  classifyAgentIntent,
  type AgentIntent,
  type AgentIntentClassification,
} from "./intent-router";

const agentIntentSchema = z.enum([
  "READ_ONLY_QUERY",
  "CREATE_CUSTOMER",
  "UPDATE_CUSTOMER",
  "CREATE_JOB",
  "UPDATE_JOB",
  "ASSIGN_JOB",
  "SCHEDULE_JOB",
  "CHANGE_JOB_STATUS",
  "CANCEL_JOB",
]);

const optionalStringSchema = z
  .union([z.string().trim().min(1).max(500), z.null()])
  .optional()
  .transform((value) => value ?? undefined);

const aiIntentExtractionSchema = z
  .object({
    intent: agentIntentSchema,
    confidence: z.number().min(0).max(1),
    reason: optionalStringSchema,
    customerQuery: optionalStringSchema,
    jobQuery: optionalStringSchema,
    staffQuery: optionalStringSchema,
    timeQuery: optionalStringSchema,
    serviceAddress: optionalStringSchema,
    jobConcepts: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    customerFields: z
      .object({
        name: optionalStringSchema,
        phone: optionalStringSchema,
        email: optionalStringSchema,
        notes: optionalStringSchema,
      })
      .strict()
      .optional(),
  })
  .strict();

export type AiIntentExtraction = z.infer<typeof aiIntentExtractionSchema>;

export type IntentExtractionSummary = {
  enabled: boolean;
  status: "disabled" | "succeeded" | "failed";
  provider?: string;
  model?: string;
  durationMs?: number;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  error?: {
    code?: string;
    message: string;
  };
  output?: {
    intent?: AgentIntent;
    confidence?: number;
    hasCustomerQuery: boolean;
    hasJobQuery: boolean;
    hasStaffQuery: boolean;
    hasTimeQuery: boolean;
    hasServiceAddress: boolean;
    hasCustomerFields: boolean;
    hasJobConcepts: boolean;
  };
};

export type EnhancedIntentClassification = {
  classification: AgentIntentClassification;
  extraction: IntentExtractionSummary;
};

function errorSummary(error: unknown) {
  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return {
      code: typeof statusCode === "number" ? String(statusCode) : undefined,
      message: error instanceof Error ? error.message : "Intent extractor failed.",
    };
  }

  if (error instanceof Error) {
    return {
      code: error.name,
      message: error.message,
    };
  }

  return {
    message: "Intent extractor failed.",
  };
}

function outputSummary(extraction: AiIntentExtraction): IntentExtractionSummary["output"] {
  return {
    intent: extraction.intent,
    confidence: extraction.confidence,
    hasCustomerQuery: Boolean(extraction.customerQuery),
    hasJobQuery: Boolean(extraction.jobQuery),
    hasStaffQuery: Boolean(extraction.staffQuery),
    hasTimeQuery: Boolean(extraction.timeQuery),
    hasServiceAddress: Boolean(extraction.serviceAddress),
    hasCustomerFields: Boolean(
      extraction.customerFields &&
        Object.values(extraction.customerFields).some(Boolean),
    ),
    hasJobConcepts: Boolean(extraction.jobConcepts?.length),
  };
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (Array.isArray(entry)) {
        return entry.length > 0;
      }

      if (entry && typeof entry === "object") {
        return Object.values(entry).some(Boolean);
      }

      return entry !== undefined && entry !== null && entry !== "";
    }),
  ) as Partial<T>;
}

function parseAiExtraction(content: string): AiIntentExtraction {
  return aiIntentExtractionSchema.parse(JSON.parse(content));
}

function mergeCustomerFields(
  ruleFields: AgentIntentClassification["extracted"]["customerFields"],
  aiFields: AiIntentExtraction["customerFields"],
) {
  return compactObject({
    ...aiFields,
    ...ruleFields,
  });
}

export function mergeAgentIntentClassification(
  ruleResult: AgentIntentClassification,
  aiResult?: AiIntentExtraction,
): AgentIntentClassification {
  if (!aiResult) {
    return {
      ...ruleResult,
      source: "rules",
    };
  }

  const useAiIntent = aiResult.confidence >= 0.7;
  const combinedJobConcepts = normalizeJobConcepts([
    ...(ruleResult.extracted.jobConcepts ?? []),
    ...(aiResult.jobConcepts ?? []),
    ...extractJobConcepts(aiResult.jobQuery),
  ]);
  const customerFields = mergeCustomerFields(
    ruleResult.extracted.customerFields,
    aiResult.customerFields,
  );

  return {
    intent: useAiIntent ? aiResult.intent : ruleResult.intent,
    confidence: useAiIntent
      ? Math.max(ruleResult.confidence, aiResult.confidence)
      : ruleResult.confidence,
    reason: useAiIntent
      ? `AI extractor confidence ${aiResult.confidence}: ${aiResult.reason ?? "structured intent extracted."}`
      : ruleResult.reason,
    source: "merged",
    extracted: compactObject({
      customerQuery: aiResult.customerQuery ?? ruleResult.extracted.customerQuery,
      jobQuery: aiResult.jobQuery ?? ruleResult.extracted.jobQuery,
      staffQuery: aiResult.staffQuery ?? ruleResult.extracted.staffQuery,
      timeQuery: aiResult.timeQuery ?? ruleResult.extracted.timeQuery,
      serviceAddress: aiResult.serviceAddress ?? ruleResult.extracted.serviceAddress,
      jobConcepts: combinedJobConcepts,
      customerFields,
    }),
  };
}

const systemPrompt = `You extract OpsFlow dispatch intent from one user message.
Return only a JSON object. Do not return database IDs.
Use null or omit fields when not present.
Valid intents: READ_ONLY_QUERY, CREATE_CUSTOMER, UPDATE_CUSTOMER, CREATE_JOB, UPDATE_JOB, ASSIGN_JOB, SCHEDULE_JOB, CHANGE_JOB_STATUS, CANCEL_JOB.
Extract concise search hints, not the full sentence.
jobConcepts should be normalized business concepts such as leak, tap, kitchen, dishwasher, investigation, installation, ceiling, fan, aircon, maintenance.`;

export async function classifyAgentIntentWithEnhancement(
  content: string,
): Promise<EnhancedIntentClassification> {
  const ruleResult = classifyAgentIntent(content);
  const profile = getAiIntentExtractorProfile();

  if (!profile.enabled) {
    return {
      classification: mergeAgentIntentClassification(ruleResult),
      extraction: {
        enabled: false,
        status: "disabled",
      },
    };
  }

  const startedAt = Date.now();

  try {
    const response = await createOpenAiJsonExtraction({
      profile,
      system: systemPrompt,
      user: content,
    });
    const parsed = parseAiExtraction(response.content);
    const durationMs = Date.now() - startedAt;

    return {
      classification: mergeAgentIntentClassification(ruleResult, parsed),
      extraction: {
        enabled: true,
        status: "succeeded",
        provider: profile.provider,
        model: profile.model,
        durationMs,
        ...(response.usage ? { tokenUsage: response.usage } : {}),
        output: outputSummary(parsed),
      },
    };
  } catch (error) {
    return {
      classification: mergeAgentIntentClassification(ruleResult),
      extraction: {
        enabled: true,
        status: "failed",
        provider: profile.provider,
        model: profile.model,
        durationMs: Date.now() - startedAt,
        error: errorSummary(error),
      },
    };
  }
}
