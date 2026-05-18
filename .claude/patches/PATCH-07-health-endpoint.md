# PATCH-07 — Health Check Endpoint

## Problem
No way to monitor if backend is alive.
Render needs a health check path for zero-downtime deploys.
UptimeRobot needs an endpoint to ping.

## Files Affected
- `apps/backend/src/app.controller.ts` (create if not exists)
- `apps/backend/src/app.module.ts`

## Risk Level
🟢 LOW — Purely additive. New endpoint only.

---

## Claude Code Prompt

```
Read .claude/BACKEND.md first.

I need to add a /health endpoint to the NestJS backend.

Step 1: Open apps/backend/src/app.controller.ts
If the file exists, ADD to it. If it doesn't exist, create it.

Add or ensure this exact content exists:

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

Step 2: In apps/backend/src/app.module.ts, ensure
AppController is in the controllers array of @Module().
If it's already there, do nothing.
If it's missing, add it — import AppController at the top
and add it to controllers: [AppController, ...existing].

Do not remove or change any existing controllers or imports.
Show me both files after the change.
```

---

## Verification

```bash
npm run start:dev

curl http://localhost:3000/health
# Expected:
# { "status": "ok", "uptime": 12, "timestamp": "...", "service": "zoomguru-backend" }
```

## UptimeRobot Setup (After Deployment)
```
Go to uptimerobot.com → Add New Monitor
Type: HTTP(s)
URL: https://api.zoomguru.com/health
Interval: 5 minutes
Alert: Email notification to your inbox
```

## Render Setup
```
In render.yaml or Render dashboard:
Health Check Path: /health
```

## Rollback
Remove the @Get('health') method. Remove AppController
from app.module.ts if it was newly added.
