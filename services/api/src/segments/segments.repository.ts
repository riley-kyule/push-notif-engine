import type {
  SegmentDefinition,
  SegmentListFilters,
  SegmentListResult,
  SegmentRecord,
  SegmentStatus,
} from "./segments.types";

export interface CreateSegmentInput {
  siteId: string;
  name: string;
  description: string | null;
  definition: SegmentDefinition;
  status: SegmentStatus;
}

export interface UpdateSegmentInput {
  name?: string;
  description?: string | null;
  definition?: SegmentDefinition;
  status?: SegmentStatus;
}

export interface SegmentsRepository {
  create(input: CreateSegmentInput): Promise<SegmentRecord>;
  update(id: string, input: UpdateSegmentInput): Promise<SegmentRecord | null>;
  findById(id: string): Promise<SegmentRecord | null>;
  delete(id: string): Promise<boolean>;
  list(filters: SegmentListFilters): Promise<SegmentListResult>;
  estimateReach(siteId: string, definition: SegmentDefinition): Promise<number>;
}
