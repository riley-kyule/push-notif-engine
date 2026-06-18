import type { SubscriberRecord } from "../subscribers/subscribers.types";
import type {
  SegmentDefinition,
  SegmentDefinitionInput,
  SegmentField,
  SegmentOperator,
  SegmentRule,
  SegmentRuleInput,
} from "./segments.types";

const STRING_FIELDS: readonly SegmentField[] = ["country", "browser", "deviceType", "language", "status"];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.length > 0);
}

function normalizeRule(rule: SegmentRuleInput): SegmentRule {
  if (!rule.field || !rule.operator) {
    throw new Error("Each segment rule must include a field and operator");
  }

  if (rule.field === "lastSeenAt") {
    if (rule.operator !== "withinDays" && rule.operator !== "olderThanDays") {
      throw new Error("lastSeenAt only supports withinDays and olderThanDays operators");
    }

    const days = typeof rule.value === "string" ? Number(rule.value) : rule.value;
    if (typeof days !== "number" || !Number.isFinite(days) || days <= 0) {
      throw new Error("lastSeenAt rules require a positive number of days");
    }

    return {
      field: rule.field,
      operator: rule.operator,
      value: Math.floor(days),
    };
  }

  if (!STRING_FIELDS.includes(rule.field)) {
    throw new Error(`Unsupported segment field: ${rule.field}`);
  }

  if (rule.operator === "withinDays" || rule.operator === "olderThanDays") {
    throw new Error(`${rule.field} does not support ${rule.operator}`);
  }

  if (rule.operator === "in" || rule.operator === "notIn") {
    if (!isStringArray(rule.value)) {
      throw new Error(`${rule.field} ${rule.operator} rules require a non-empty array of strings`);
    }

    return {
      field: rule.field,
      operator: rule.operator,
      value: rule.value,
    };
  }

  if (rule.operator !== "is" && rule.operator !== "isNot") {
    throw new Error(`Unsupported operator for ${rule.field}: ${rule.operator}`);
  }

  if (typeof rule.value !== "string" || rule.value.length === 0) {
    throw new Error(`${rule.field} ${rule.operator} rules require a non-empty string value`);
  }

  return {
    field: rule.field,
    operator: rule.operator,
    value: rule.value,
  };
}

export function normalizeSegmentDefinition(input: SegmentDefinitionInput): SegmentDefinition {
  if (!input.rules || input.rules.length === 0) {
    throw new Error("At least one segment rule is required");
  }

  const matchMode = input.matchMode ?? "all";
  if (matchMode !== "all" && matchMode !== "any") {
    throw new Error("Segment match mode must be all or any");
  }

  return {
    matchMode,
    rules: input.rules.map((rule) => normalizeRule(rule)),
  };
}

function matchesRule(subscriber: Pick<SubscriberRecord, "browser" | "country" | "deviceType" | "language" | "status" | "lastSeenAt">, rule: SegmentRule): boolean {
  switch (rule.field) {
    case "country":
    case "browser":
    case "deviceType":
    case "language":
    case "status": {
      const value = subscriber[rule.field];
      if (rule.operator === "is") {
        return value === rule.value;
      }
      if (rule.operator === "isNot") {
        return value !== rule.value;
      }
      if (rule.operator === "in") {
        if (!Array.isArray(rule.value)) {
          return false;
        }
        return rule.value.includes(value);
      }
      if (rule.operator === "notIn") {
        if (!Array.isArray(rule.value)) {
          return false;
        }
        return !rule.value.includes(value);
      }
      return false;
    }
    case "lastSeenAt": {
      if (!subscriber.lastSeenAt) {
        return false;
      }

      const thresholdMs = Number(rule.value) * 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - thresholdMs;
      const lastSeen = subscriber.lastSeenAt.getTime();

      if (rule.operator === "withinDays") {
        return lastSeen >= cutoff;
      }

      if (rule.operator === "olderThanDays") {
        return lastSeen < cutoff;
      }

      return false;
    }
  }
}

export function matchesSegmentDefinition(
  subscriber: Pick<SubscriberRecord, "browser" | "country" | "deviceType" | "language" | "status" | "lastSeenAt">,
  definition: SegmentDefinition,
): boolean {
  if (definition.rules.length === 0) {
    return true;
  }

  const checks = definition.rules.map((rule) => matchesRule(subscriber, rule));
  return definition.matchMode === "any" ? checks.some(Boolean) : checks.every(Boolean);
}
