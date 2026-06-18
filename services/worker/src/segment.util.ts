export type SegmentMatchMode = "all" | "any";

export type SegmentField = "country" | "browser" | "deviceType" | "language" | "status" | "lastSeenAt";

export type SegmentOperator = "is" | "isNot" | "in" | "notIn" | "withinDays" | "olderThanDays";

export type SegmentRuleValue = string | number | string[] | null;

export interface SegmentRule {
  field: SegmentField;
  operator: SegmentOperator;
  value: SegmentRuleValue;
}

export interface SegmentDefinition {
  matchMode: SegmentMatchMode;
  rules: SegmentRule[];
}

function buildRuleClause(rule: SegmentRule, parameterIndex: number): { clause: string; params: Array<string | number | string[]> } {
  if (rule.field === "lastSeenAt") {
    const days = Number(rule.value);
    const comparator = rule.operator === "withinDays" ? ">=" : "<";
    return {
      clause: `last_seen_at ${comparator} NOW() - ($${parameterIndex}::int * INTERVAL '1 day')`,
      params: [days],
    };
  }

  const columnMap: Record<Exclude<SegmentField, "lastSeenAt">, string> = {
    country: "country",
    browser: "browser",
    deviceType: "device_type",
    language: "language",
    status: "status",
  };

  const column = columnMap[rule.field];
  if (rule.operator === "is") {
    return { clause: `${column} = $${parameterIndex}`, params: [rule.value as string] };
  }
  if (rule.operator === "isNot") {
    return { clause: `${column} <> $${parameterIndex}`, params: [rule.value as string] };
  }
  if (rule.operator === "in") {
    return { clause: `${column} = ANY($${parameterIndex}::text[])`, params: [rule.value as string[]] };
  }
  if (rule.operator === "notIn") {
    return { clause: `NOT (${column} = ANY($${parameterIndex}::text[]))`, params: [rule.value as string[]] };
  }

  throw new Error(`Unsupported segment rule operator: ${rule.operator}`);
}

export function buildSegmentFilterClause(
  definition: SegmentDefinition,
  startingParameterIndex: number,
): { clause: string | null; params: Array<string | number | string[]> } {
  if (definition.rules.length === 0) {
    return { clause: null, params: [] };
  }

  const params: Array<string | number | string[]> = [];
  const clauses: string[] = [];

  for (const rule of definition.rules) {
    const built = buildRuleClause(rule, startingParameterIndex + params.length);
    params.push(...built.params);
    clauses.push(built.clause);
  }

  const joiner = definition.matchMode === "any" ? " OR " : " AND ";
  return { clause: `(${clauses.join(joiner)})`, params };
}
