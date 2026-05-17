import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  Req,
  Res,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CvService } from './cv.service';

@Controller('cv')
@UseGuards(JwtAuthGuard)
export class CvController {
  constructor(private readonly cvService: CvService) {}

  @Post('upload')
  async upload(@Req() req: FastifyRequest & { user: any }, @Res() reply: FastifyReply) {
    try {
      // @fastify/multipart parses the request
      const data = await (req as any).file();

      if (!data) {
        throw new BadRequestException('No file uploaded');
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      if (buffer.length === 0) {
        throw new BadRequestException('Uploaded file is empty');
      }

      const profile = await this.cvService.processCV(
        req.user.userId,
        buffer,
        data.filename,
        data.mimetype
      );

      return reply.send({ success: true, profile });
    } catch (err: any) {
      if (err.statusCode) throw err;
      throw new BadRequestException(err.message || 'Failed to process CV');
    }
  }

  @Get('profile')
  async getProfile(@Req() req: any) {
    const profile = await this.cvService.getProfile(req.user.userId);
    if (!profile) throw new NotFoundException('No CV profile found. Please upload your CV.');
    return profile;
  }

  @Delete('profile')
  async deleteProfile(@Req() req: any) {
    await this.cvService.deleteProfile(req.user.userId);
    return { success: true, message: 'CV profile deleted' };
  }
}
