import { StorageKeys, readCollection, writeCollection, generateId, nowIso } from './storage';
import { getBranchById } from './branches';
import type { AuditLogRecord, AuditActionType, Employee } from './types';

export function getAuditLogs(
  branchId?: string,
  action?: AuditActionType | string,
  startDate?: string,
  endDate?: string,
  entityType?: string,
): AuditLogRecord[] {
  const logs = readCollection<AuditLogRecord>(StorageKeys.auditLogs);
  return logs
    .filter((log) => {
      if (branchId && log.branchId !== branchId) return false;
      if (action && log.action !== action) return false;
      if (entityType && log.entityType !== entityType) return false;
      if (startDate && log.timestamp < startDate) return false;
      if (endDate && log.timestamp > endDate) return false;
      return true;
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export interface RecordAuditLogInput {
  actor: Employee;
  branchId?: string | null;
  action: AuditActionType | string;
  entityType: string;
  entityId: string;
  details: string;
  metadata?: Record<string, unknown> | null;
}

export function recordAuditLog(input: RecordAuditLogInput): AuditLogRecord {
  const branchObj = input.branchId ? getBranchById(input.branchId) : null;
  const branchName = branchObj ? branchObj.name : (input.branchId ? input.branchId : 'Holding / Global');

  const logs = readCollection<AuditLogRecord>(StorageKeys.auditLogs);
  const log: AuditLogRecord = {
    id: generateId('aud'),
    timestamp: nowIso(),
    actorId: input.actor.id,
    actorName: input.actor.name,
    actorRole: input.actor.role,
    branchId: input.branchId ?? null,
    branchName,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    details: input.details.trim(),
    metadata: input.metadata ?? null,
  };

  logs.push(log);
  writeCollection(StorageKeys.auditLogs, logs);
  return log;
}
