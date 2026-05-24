import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req, Request } from '@nestjs/common';
import { SessionService } from './session.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('session')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post('end')
  async endSession(
    @Request() req: any,
    @Body() body: {
      sessionId: string;
      durationSeconds: number;
      totalQuestions: number;
    }
  ) {
    await this.sessionService.endSession({
      userId: req.user.userId,
      sessionId: body.sessionId,
      durationSeconds: body.durationSeconds,
      totalQuestions: body.totalQuestions,
    });
    return { success: true };
  }

  @Get('history')
  async getHistory(@Req() req: any) {
    return this.sessionService.getHistory(req.user.userId);
  }

  @Get(':id')
  async getSession(@Req() req: any, @Param('id') id: string) {
    return this.sessionService.getSession(req.user.userId, id);
  }

  @Get(':id/export')
  async exportTranscript(@Req() req: any, @Param('id') id: string) {
    const transcript = await this.sessionService.exportTranscript(req.user.userId, id);
    return { transcript };
  }

  @Delete(':id')
  async deleteSession(@Req() req: any, @Param('id') id: string) {
    return this.sessionService.deleteSession(req.user.userId, id);
  }
}
