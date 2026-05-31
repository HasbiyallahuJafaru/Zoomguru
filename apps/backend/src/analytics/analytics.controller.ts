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

    void getDB().query(
      'INSERT INTO downloads (platform, ip) VALUES ($1, $2)',
      [safePlatform, ip],
    );

    const r2Url =
      safePlatform === 'mac'
        ? process.env['R2_DOWNLOAD_URL_MAC']
        : process.env['R2_DOWNLOAD_URL_WINDOWS'];

    if (!r2Url) {
      await reply.code(503).send({ error: 'Download not available yet' });
      return;
    }

    reply.raw.writeHead(302, { Location: r2Url });
    reply.raw.end();
  }
}
