export interface AuditLogPageDto {
  items: Array<{
    id: string;
    actorUserId: string | null;
    actorEmail: string | null;
    actorName: string | null;
    actorRole: string | null;
    action: string;
    targetType: string | null;
    targetId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}
