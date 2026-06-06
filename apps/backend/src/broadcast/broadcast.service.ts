import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { getDB } from '../database/db';

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 3 * 60 * 1000; // 3 minutes

export type BroadcastStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface TargetFilter {
  plans?: Array<'weekly' | 'monthly' | 'yearly'>;
}

export interface BroadcastRow {
  id: string;
  subject: string;
  body: string;
  target_filter: TargetFilter;
  status: BroadcastStatus;
  scheduled_at: string;
  sent_at: string | null;
  recipient_count: number | null;
  open_count: number;
  created_at: string;
}

export interface BroadcastBatchRow {
  id: string;
  broadcast_id: string;
  batch_index: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  recipients: string[];
  scheduled_at: string;
  sent_at: string | null;
  error: string | null;
  retry_count: number;
}

export interface CreateBroadcastDto {
  subject: string;
  body: string;
  targetFilter: TargetFilter;
  scheduledAt: Date;
}

@Injectable()
export class BroadcastService {
  async getRecipientEmails(filter: TargetFilter): Promise<string[]> {
    const db = getDB();

    if (filter.plans && filter.plans.length > 0) {
      const result = await db.query<{ email: string }>(
        `SELECT DISTINCT u.email
         FROM users u
         JOIN subscriptions s ON s.user_id = u.id
         WHERE s.status = 'active'
           AND s.plan = ANY($1::text[])
         ORDER BY u.email`,
        [filter.plans],
      );
      return result.rows.map((r) => r.email);
    }

    const result = await db.query<{ email: string }>(
      `SELECT email FROM users ORDER BY email`,
    );
    return result.rows.map((r) => r.email);
  }

  async countRecipients(filter: TargetFilter): Promise<number> {
    const emails = await this.getRecipientEmails(filter);
    return emails.length;
  }

  async createBroadcast(dto: CreateBroadcastDto): Promise<BroadcastRow> {
    if (!dto.subject.trim()) throw new BadRequestException('Subject is required');
    if (!dto.body.trim()) throw new BadRequestException('Body is required');

    const emails = await this.getRecipientEmails(dto.targetFilter);
    if (emails.length === 0) {
      throw new BadRequestException('No recipients match the selected filter');
    }

    const client = await getDB().connect();
    let broadcast: BroadcastRow;

    try {
      await client.query('BEGIN');

      const broadcastResult = await client.query<BroadcastRow>(
        `INSERT INTO broadcasts (subject, body, target_filter, status, scheduled_at, recipient_count)
         VALUES ($1, $2, $3, 'scheduled', $4, $5)
         RETURNING *`,
        [
          dto.subject.trim(),
          dto.body.trim(),
          JSON.stringify(dto.targetFilter),
          dto.scheduledAt,
          emails.length,
        ],
      );

      broadcast = broadcastResult.rows[0];

      // Slice recipients into batches and schedule each with 3-min offsets
      const batches = chunkArray(emails, BATCH_SIZE);
      for (let idx = 0; idx < batches.length; idx++) {
        const batchScheduledAt = new Date(dto.scheduledAt.getTime() + idx * BATCH_DELAY_MS);
        await client.query(
          `INSERT INTO broadcast_batches
             (broadcast_id, batch_index, status, recipients, scheduled_at)
           VALUES ($1, $2, 'pending', $3, $4)`,
          [broadcast.id, idx, batches[idx], batchScheduledAt],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return broadcast;
  }

  async listBroadcasts(): Promise<BroadcastRow[]> {
    const db = getDB();
    const result = await db.query<BroadcastRow>(
      `SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 200`,
    );
    return result.rows;
  }

  async getBroadcast(id: string): Promise<BroadcastRow> {
    const db = getDB();
    const result = await db.query<BroadcastRow>(
      `SELECT * FROM broadcasts WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) throw new NotFoundException('Broadcast not found');
    return result.rows[0];
  }

  async cancelBroadcast(id: string): Promise<void> {
    const db = getDB();
    const result = await db.query<{ status: BroadcastStatus }>(
      `SELECT status FROM broadcasts WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) throw new NotFoundException('Broadcast not found');

    const { status } = result.rows[0];
    if (status === 'sent' || status === 'cancelled') {
      throw new BadRequestException(`Cannot cancel a broadcast with status '${status}'`);
    }

    await db.query(
      `UPDATE broadcasts SET status = 'cancelled' WHERE id = $1`,
      [id],
    );
    await db.query(
      `UPDATE broadcast_batches SET status = 'failed', error = 'Broadcast cancelled'
       WHERE broadcast_id = $1 AND status = 'pending'`,
      [id],
    );
  }

  async retryBroadcast(id: string): Promise<BroadcastRow> {
    const broadcast = await this.getBroadcast(id);

    if (broadcast.status !== 'failed') {
      throw new BadRequestException('Only failed broadcasts can be retried');
    }

    // Re-fetch recipients and rebuild batches from scratch
    const filter = broadcast.target_filter as TargetFilter;
    const emails = await this.getRecipientEmails(filter);
    if (emails.length === 0) {
      throw new BadRequestException('No recipients match the filter');
    }

    const now = new Date();
    const batches = chunkArray(emails, BATCH_SIZE);

    const client = await getDB().connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE broadcasts
         SET status = 'scheduled', scheduled_at = $2,
             sent_at = NULL, recipient_count = $3, open_count = 0
         WHERE id = $1`,
        [id, now, emails.length],
      );

      await client.query(
        `DELETE FROM broadcast_batches WHERE broadcast_id = $1`,
        [id],
      );

      for (let idx = 0; idx < batches.length; idx++) {
        const batchScheduledAt = new Date(now.getTime() + idx * BATCH_DELAY_MS);
        await client.query(
          `INSERT INTO broadcast_batches
             (broadcast_id, batch_index, status, recipients, scheduled_at)
           VALUES ($1, $2, 'pending', $3, $4)`,
          [id, idx, batches[idx], batchScheduledAt],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return this.getBroadcast(id);
  }

  async getBatchesForBroadcast(broadcastId: string): Promise<BroadcastBatchRow[]> {
    const db = getDB();
    const result = await db.query<BroadcastBatchRow>(
      `SELECT * FROM broadcast_batches WHERE broadcast_id = $1 ORDER BY batch_index`,
      [broadcastId],
    );
    return result.rows;
  }

  async incrementOpenCount(broadcastId: string): Promise<void> {
    const db = getDB();
    await db.query(
      `UPDATE broadcasts SET open_count = open_count + 1 WHERE id = $1`,
      [broadcastId],
    );
  }

  buildPreviewHtml(body: string): string {
    return wrapEmailBody(body);
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Mirrors the template from email.service.ts
const SERIF = `'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif`;
const SANS  = `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;

export function wrapEmailBody(body: string): string {
  return (
    '<!DOCTYPE html><html>' +
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    `<body style="background-color:#07070b;color:#e8e8e8;font-family:${SANS};margin:0;padding:0">` +
    `<div style="max-width:520px;margin:40px auto;background-color:#111118;border-radius:12px;border:1px solid #1e1e2e;overflow:hidden">` +
    `<div style="height:3px;background:linear-gradient(90deg,#6c63ff 0%,rgba(108,99,255,0.12) 100%)"></div>` +
    `<div style="padding:26px 36px 22px;border-bottom:1px solid #16161f">` +
    `<p style="font-family:${SERIF};font-size:19px;font-weight:400;font-style:italic;color:#ffffff;margin:0">ZoomGuru</p>` +
    `</div>` +
    `<div style="padding:32px 36px">${body}</div>` +
    `<div style="font-family:${SANS};font-size:12px;color:#3a3a50;padding:20px 36px;border-top:1px solid #16161f">` +
    `You received this because you have a ZoomGuru account. To unsubscribe, reply with "unsubscribe" in the subject.` +
    `</div>` +
    `</div></body></html>`
  );
}
