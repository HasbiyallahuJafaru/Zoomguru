import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { getDB } from '../database/db';

@Controller('analytics')
export class AnalyticsController {
  @Get('download')
  async trackDownload(
    @Query('platform') platform: string | undefined,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const safePlatform = ['windows', 'mac'].includes(platform ?? '') ? (platform as string) : 'unknown';
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() ?? req.ip ?? '';

    // Named for what it holds, not who hosts it. The old name, R2_DOWNLOAD_URL_*,
    // outlived Cloudflare R2 by two migrations — it has pointed at a GitHub
    // release asset and now at Firebase Storage — and each time it sent someone
    // reading this code to the wrong bucket. A host-neutral name cannot go stale
    // the next time distribution moves.
    //
    // The old name is still read as a fallback so the download survives whichever
    // order the deploy and the Railway variable land in. Delete the fallback once
    // R2_DOWNLOAD_URL_* is gone from Railway.
    const downloadUrl =
      safePlatform === 'mac'
        ? process.env['APP_DOWNLOAD_LINK_MAC'] ?? process.env['R2_DOWNLOAD_URL_MAC']
        : process.env['APP_DOWNLOAD_LINK_WINDOWS'] ?? process.env['R2_DOWNLOAD_URL_WINDOWS'];

    if (!downloadUrl) {
      await reply.code(503).send({ error: 'Download not available yet' });
      return;
    }

    // Counted here, AFTER the availability check, because this is the first
    // line that means a file is actually being served. It used to run before
    // the check, so ?platform=mac recorded a download and then 503'd — there
    // is no macOS build, so every mac row in this table is a download that
    // never happened. Nothing downstream can tell those apart afterwards.
    void getDB().query(
      'INSERT INTO downloads (platform, ip) VALUES ($1, $2)',
      [safePlatform, ip],
    );

    reply.raw.writeHead(302, { Location: downloadUrl });
    reply.raw.end();
  }
}
