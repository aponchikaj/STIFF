import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { User } from '../users/user.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { normaliseIp } from './admin-ip';

/** Anything whose value must never reach the trail, matched on the key. */
const SECRET_KEY = /pass|token|secret|hash|otp|code|authorization|cookie/i;

const MAX_DEPTH = 4;
const MAX_KEYS = 60;
const MAX_STRING = 500;

/**
 * Copies a request body into something safe to store forever.
 *
 * Redacts by key rather than by route: a body shape that grows a `password`
 * field later is redacted the day it appears, without anyone remembering to
 * come back here.
 */
export function redactBody(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= MAX_DEPTH) return '[deep]';
  if (Array.isArray(value)) {
    return value.slice(0, MAX_KEYS).map((item) => redactBody(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_KEYS)) {
      out[key] = SECRET_KEY.test(key)
        ? '[redacted]'
        : redactBody(item, depth + 1);
    }
    return out;
  }
  return '[unserialisable]';
}

export interface AdminAuditEntry {
  actor: User;
  origin: 'admin' | 'shop';
  method: string;
  path: string;
  statusCode: number;
  ip?: string | null;
  userAgent?: string | null;
  body?: unknown;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly auditRepo: Repository<AdminAuditLog>,
  ) {}

  /**
   * Never throws. An audit write that fails is worth a log line, but failing
   * the admin's actual request because the trail could not be written would
   * turn a bookkeeping problem into an outage.
   */
  async record(entry: AdminAuditEntry): Promise<void> {
    try {
      const changes = entry.body === undefined ? null : redactBody(entry.body);
      // `create` + `save` rather than `insert`: TypeORM's insert payload type
      // cannot express an open jsonb record, which both this entity's
      // `changes` and the related User's `settings` are.
      const row = this.auditRepo.create({
        actorId: entry.actor.id,
        actorEmail: entry.actor.email.slice(0, 320),
        actorUsername: entry.actor.username.slice(0, 120),
        origin: entry.origin,
        method: entry.method.toUpperCase().slice(0, 10),
        path: entry.path.slice(0, 512),
        statusCode: entry.statusCode,
        ip: normaliseIp(entry.ip)?.slice(0, 64) ?? null,
        userAgent: entry.userAgent?.slice(0, 512) ?? null,
        changes:
          changes && typeof changes === 'object'
            ? changes
            : changes === null
              ? null
              : { value: changes },
      });
      await this.auditRepo.save(row);
    } catch (err) {
      this.logger.error(
        `Failed to write audit entry for ${entry.method} ${entry.path}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
