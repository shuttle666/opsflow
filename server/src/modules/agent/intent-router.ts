export type AgentIntent =
  | "READ_ONLY_QUERY"
  | "CREATE_CUSTOMER"
  | "UPDATE_CUSTOMER"
  | "CREATE_JOB"
  | "UPDATE_JOB"
  | "ASSIGN_JOB"
  | "SCHEDULE_JOB"
  | "CHANGE_JOB_STATUS"
  | "CANCEL_JOB";

export type AgentIntentClassification = {
  intent: AgentIntent;
  confidence: number;
  reason: string;
  extracted: {
    customerQuery?: string;
    jobQuery?: string;
    staffQuery?: string;
    timeQuery?: string;
    serviceAddress?: string;
    customerFields?: Partial<{
      name: string;
      phone: string;
      email: string;
      notes: string;
    }>;
  };
};

function includesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function extractQuoted(value: string) {
  const match = value.match(/["“](.+?)["”]/u);
  return match?.[1]?.trim();
}

function extractPhone(value: string) {
  const match = value.match(/(?:\+?\d[\d\s-]{6,}\d)/u);
  return match?.[0]?.replace(/\s+/gu, " ").trim();
}

function extractEmail(value: string) {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu);
  return match?.[0]?.trim();
}

export function classifyAgentIntent(content: string): AgentIntentClassification {
  const text = content.trim();
  const normalized = text.toLowerCase();
  const customerFields: AgentIntentClassification["extracted"]["customerFields"] = {};
  const phone = extractPhone(text);
  const email = extractEmail(text);

  if (phone) customerFields.phone = phone;
  if (email) customerFields.email = email;

  if (includesAny(normalized, [/cancel|取消/u])) {
    return {
      intent: "CANCEL_JOB",
      confidence: 0.78,
      reason: "User appears to be cancelling a job.",
      extracted: {
        jobQuery: extractQuoted(text) ?? text,
      },
    };
  }

  if (
    includesAny(normalized, [
      /phone|电话|mobile|手机号/u,
      /email|邮箱|邮件/u,
      /notes?|备注/u,
    ]) &&
    includesAny(normalized, [/change|update|edit|修改|更新|改成|变更/u])
  ) {
    return {
      intent: "UPDATE_CUSTOMER",
      confidence: 0.82,
      reason: "User appears to be updating customer profile fields.",
      extracted: {
        customerQuery: extractQuoted(text) ?? text,
        customerFields,
      },
    };
  }

  if (
    includesAny(normalized, [/change|update|edit|修改|更新|改成|变更/u]) &&
    includesAny(normalized, [
      /job|work order|工单|工作/u,
      /title|标题/u,
      /description|描述/u,
      /address|地址|service address/u,
    ])
  ) {
    return {
      intent: "UPDATE_JOB",
      confidence: 0.78,
      reason: "User appears to be updating job details.",
      extracted: {
        jobQuery: extractQuoted(text) ?? text,
        serviceAddress: includesAny(normalized, [/address|地址|service address/u])
          ? text
          : undefined,
      },
    };
  }

  if (
    includesAny(normalized, [/assign|reassign|分配|派给|安排给/u]) &&
    includesAny(normalized, [/tomorrow|today|上午|下午|点|schedule|安排|预约|时间/u])
  ) {
    return {
      intent: "SCHEDULE_JOB",
      confidence: 0.82,
      reason: "User appears to be assigning and scheduling a job.",
      extracted: {
        jobQuery: extractQuoted(text) ?? text,
        staffQuery: text,
        timeQuery: text,
      },
    };
  }

  if (includesAny(normalized, [/assign|reassign|分配|派给|安排给/u])) {
    return {
      intent: "ASSIGN_JOB",
      confidence: 0.78,
      reason: "User appears to be assigning an existing job.",
      extracted: {
        jobQuery: extractQuoted(text) ?? text,
        staffQuery: text,
      },
    };
  }

  if (includesAny(normalized, [/schedule|reschedule|预约|排期|改时间|安排/u])) {
    return {
      intent: "SCHEDULE_JOB",
      confidence: 0.74,
      reason: "User appears to be scheduling or rescheduling a job.",
      extracted: {
        jobQuery: extractQuoted(text) ?? text,
        timeQuery: text,
      },
    };
  }

  if (includesAny(normalized, [/complete|完成|开始|in progress|状态|status/u])) {
    return {
      intent: "CHANGE_JOB_STATUS",
      confidence: 0.7,
      reason: "User appears to be changing job status.",
      extracted: {
        jobQuery: extractQuoted(text) ?? text,
      },
    };
  }

  if (
    includesAny(normalized, [
      /new\s+job/u,
      /create\s+job/u,
      /create\s+.*\bjob\b/u,
      /new\s+.*\bjob\b/u,
      /新建.*工作/u,
      /创建.*工作/u,
      /新增.*工作/u,
      /工单/u,
    ])
  ) {
    return {
      intent: "CREATE_JOB",
      confidence: 0.76,
      reason: "User appears to be creating a job.",
      extracted: {
        jobQuery: extractQuoted(text) ?? text,
        serviceAddress: includesAny(normalized, [/address|地址/u]) ? text : undefined,
      },
    };
  }

  if (includesAny(normalized, [/new customer|create customer|新建.*客户|创建.*客户|新增.*客户/u])) {
    return {
      intent: "CREATE_CUSTOMER",
      confidence: 0.76,
      reason: "User appears to be creating a customer.",
      extracted: {
        customerQuery: extractQuoted(text) ?? text,
        customerFields,
      },
    };
  }

  return {
    intent: "READ_ONLY_QUERY",
    confidence: 0.62,
    reason: "No mutation intent was detected.",
    extracted: {
      customerQuery: text,
      jobQuery: text,
    },
  };
}
