export type SegmentMatchMode = "all" | "any";

export type SegmentStatus = "active" | "archived";

export type SegmentField = "country" | "browser" | "deviceType" | "language" | "status" | "lastSeenAt";

export type SegmentOperator = "is" | "isNot" | "in" | "notIn" | "withinDays" | "olderThanDays";

export type SegmentRuleValue = string | number | string[] | null;

export interface SegmentRuleInput {
  field: SegmentField;
  operator: SegmentOperator;
  value?: unknown;
}

export interface SegmentDefinitionInput {
  matchMode?: SegmentMatchMode;
  rules: SegmentRuleInput[];
}

export interface SegmentRule {
  field: SegmentField;
  operator: SegmentOperator;
  value: SegmentRuleValue;
}

export interface SegmentDefinition {
  matchMode: SegmentMatchMode;
  rules: SegmentRule[];
}

export interface SegmentRecord {
  id: string;
  siteId: string;
  name: string;
  description: string | null;
  definition: SegmentDefinition;
  status: SegmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SegmentListFilters {
  siteId?: string;
  status?: SegmentStatus;
  limit: number;
  offset: number;
}

export interface SegmentListResult {
  items: SegmentRecord[];
  total: number;
}
