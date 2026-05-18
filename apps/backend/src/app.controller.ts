import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  private readonly startTime = Date.now();

  @Get('health')
  health() {
    return {
      status: 'ok',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      service: 'zoomguru-backend',
    };
  }
}
