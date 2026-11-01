import type { Prisma } from '@prisma/client';
import type { AuditAction } from '@recruitflow/shared';
import { logger } from './logger';
import { prisma } from './prisma';

export interface AuditEntry {
  companyId: string | null;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}

/** Append-only audit trail. Failures are logged but never break the user's request. */
export async function audit(entry: AuditEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: entry.companyId,
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
        metadata: entry.metadata,
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, action: entry.action }, 'Failed to write audit log');
  }
}
