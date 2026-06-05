import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Resend } from 'resend';
import { getDB } from '../database/db';
import { wrapEmailBody } from './broadcast.service';

interface PendingBatch {
  id: string;
  broadcast_id: string;
  batch_index: number;
  recipients: string[];
  retry_count: number;
  broadcast_subject: string;
  broadcast_body: string;
}

interface BatchTotals {
  total: number;
  sent: number;
  failed: number;
}

@Injectable()
export class BroadcastQueueService {
  private readonly logger = new Logger(BroadcastQueueService.name);
  private readonly resend = new Resend(process.env['RESEND_API_KEY']);
  private processing = false;

  private get from(): string {
    const addr = process.env['FROM_EMAIL'] ?? 'noreply@example.com';
    return `ZoomGuru <${addr}>`;
  }

  @Cron('*/60 * * * * *')
  async processDueBatches(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.runBatchCycle();
    } finally {
      this.processing = false;
    }
  }

  private async runBatchCycle(): Promise<void> {
    const db = getDB();

    const pending = await db.query<PendingBatch>(
      `SELECT bb.id, bb.broadcast_id, bb.batch_index, bb.recipients, bb.retry_count,
              b.subject AS broadcast_subject, b.body AS broadcast_body
       FROM broadcast_batches bb
       JOIN broadcasts b ON b.id = bb.broadcast_id
       WHERE bb.status = 'pending'
         AND bb.scheduled_at <= NOW()
         AND b.status NOT IN ('cancelled', 'failed')
       ORDER BY bb.scheduled_at
       LIMIT 5`,
    );

    for (const batch of pending.rows) {
      await this.sendBatch(batch);
    }

    // After processing, check if any broadcasts are now fully complete
    await this.reconcileBroadcastStatuses();
  }

  private async sendBatch(batch: PendingBatch): Promise<void> {
    const db = getDB();

    await db.query(
      `UPDATE broadcast_batches SET status = 'sending' WHERE id = $1`,
      [batch.id],
    );

    try {
      const html = wrapEmailBody(batch.broadcast_body);
      const emails = batch.recipients.map((to) => ({
        from: this.from,
        to,
        subject: batch.broadcast_subject,
        html,
        tags: [{ name: 'broadcast_id', value: batch.broadcast_id }],
      }));

      // Resend batch API allows up to 100 emails per call
      await this.resend.batch.send(emails);

      await db.query(
        `UPDATE broadcast_batches
         SET status = 'sent', sent_at = NOW(), error = NULL
         WHERE id = $1`,
        [batch.id],
      );

      this.logger.log(
        `Broadcast ${batch.broadcast_id} batch ${batch.batch_index}: sent ${batch.recipients.length} emails`,
      );

      await db.query(
        `UPDATE broadcasts SET status = 'sending' WHERE id = $1 AND status = 'scheduled'`,
        [batch.broadcast_id],
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Broadcast ${batch.broadcast_id} batch ${batch.batch_index} failed: ${message}`,
      );

      if (batch.retry_count < 1) {
        // Retry once: reset to pending, increment retry_count, reschedule for 60s from now
        await db.query(
          `UPDATE broadcast_batches
           SET status = 'pending', retry_count = retry_count + 1,
               scheduled_at = NOW() + INTERVAL '60 seconds', error = $2
           WHERE id = $1`,
          [batch.id, message],
        );
        this.logger.warn(
          `Broadcast ${batch.broadcast_id} batch ${batch.batch_index}: scheduled for retry`,
        );
      } else {
        // Mark permanently failed — flag for manual review
        await db.query(
          `UPDATE broadcast_batches
           SET status = 'failed', error = $2
           WHERE id = $1`,
          [batch.id, `FINAL_FAILURE: ${message}`],
        );
        this.logger.error(
          `Broadcast ${batch.broadcast_id} batch ${batch.batch_index}: permanently failed after retry`,
        );
      }
    }
  }

  private async reconcileBroadcastStatuses(): Promise<void> {
    const db = getDB();

    // Mark broadcasts as 'sent' when all batches are done (sent or failed)
    const activeBroadcasts = await db.query<{ id: string }>(
      `SELECT DISTINCT broadcast_id AS id
       FROM broadcast_batches
       WHERE broadcast_id IN (
         SELECT id FROM broadcasts WHERE status IN ('sending', 'scheduled')
       )`,
    );

    for (const { id } of activeBroadcasts.rows) {
      const totals = await db.query<BatchTotals>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'sent') AS sent,
                COUNT(*) FILTER (WHERE status = 'failed') AS failed
         FROM broadcast_batches
         WHERE broadcast_id = $1`,
        [id],
      );

      const { total, sent, failed } = totals.rows[0];
      const done = sent + failed;

      if (done >= total && total > 0) {
        const newStatus = failed > 0 && sent === 0 ? 'failed' : 'sent';
        await db.query(
          `UPDATE broadcasts
           SET status = $2, sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE sent_at END
           WHERE id = $1`,
          [id, newStatus],
        );
      }
    }
  }
}
