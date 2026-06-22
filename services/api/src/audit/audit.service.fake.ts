import type { AuditService } from "./audit.service";

export function createFakeAuditService(): AuditService {
  return { log: async () => undefined } as unknown as AuditService;
}
