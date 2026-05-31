import {
  Controller, Post, Get, Body, Headers, Query, Req,
  BadRequestException, HttpCode, HttpException,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { getRedis } from '../redis/redis';

function sanitize(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function sanitizeLine(s: string): string {
  return s.replace(/[\x00-\x1F\x7F]/g, '');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DEVICE_ID_RE = /^[a-f0-9]{64}$/;
const TOKEN_RE = /^[a-f0-9]{64}$/;

async function checkIpRateLimit(
  ip: string,
  prefix: string,
  max: number,
  windowSec: number,
): Promise<void> {
  const redis = getRedis();
  const key = `rl:${prefix}:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSec);
  if (count > max) {
    const ttl = await redis.ttl(key);
    throw new HttpException(
      { error: 'rate_limit', retryAfter: ttl > 0 ? ttl : windowSec },
      429,
    );
  }
}

const PAGE_SVG = `<svg aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 400 520" preserveAspectRatio="none"><defs><linearGradient id="zgBF" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity="0.055"/><stop offset="42%" stop-color="#fff" stop-opacity="0.024"/><stop offset="100%" stop-color="#fff" stop-opacity="0.005"/></linearGradient><linearGradient id="zgEG" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity="0.18"/><stop offset="50%" stop-color="#fff" stop-opacity="0.07"/><stop offset="100%" stop-color="#fff" stop-opacity="0.01"/></linearGradient></defs><path d="M 435,-15 C 372,52 304,68 256,158 C 208,248 202,312 138,396 C 90,460 32,482 -22,545 L 18,572 C 64,504 116,476 163,412 C 226,328 234,264 283,172 C 332,80 400,62 462,12 Z" fill="url(#zgBF)"/><path d="M 435,-15 C 372,52 304,68 256,158 C 208,248 202,312 138,396 C 90,460 32,482 -22,545" fill="none" stroke="url(#zgEG)" stroke-width="1"/><path d="M 462,12 C 400,62 332,80 283,172 C 234,264 226,328 163,412 C 116,476 64,504 18,572" fill="none" stroke="rgba(255,255,255,0.028)" stroke-width="0.7"/><path d="M 408,-32 C 348,36 282,54 234,144 C 186,234 180,300 116,382 C 68,446 12,470 -44,530" fill="none" stroke="rgba(255,255,255,0.038)" stroke-width="0.5"/></svg>`;

function pageHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{box-sizing:border-box}body{background:#07070b;color:#e8e8e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;position:relative;overflow:hidden}.card{background:#111118;border:1px solid #1e1e2e;border-radius:12px;padding:40px 36px;width:100%;max-width:420px;position:relative;z-index:1}h1{font-size:22px;font-weight:600;color:#fff;margin:0 0 16px}p{font-size:15px;line-height:1.6;color:#b0b0c0;margin:0 0 20px}label{display:block;font-size:13px;color:#888899;margin-bottom:6px}input[type=password]{width:100%;background:#0d0d14;border:1px solid #2a2a3e;border-radius:8px;color:#e8e8e8;font-size:15px;padding:10px 14px;outline:none;margin-bottom:16px}input[type=password]:focus{border-color:#6c63ff}button{width:100%;background:#6c63ff;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;padding:12px;cursor:pointer;margin-top:4px}button:disabled{opacity:0.5;cursor:default}#msg{font-size:14px;margin-top:16px;display:none}</style></head><body>${PAGE_SVG}<div class="card">${body}</div></body></html>`;
}

function resetFormHtml(token: string): string {
  const body = `<h1>Reset your password</h1><p>Enter a new password for your ZoomGuru account.</p><form id="f"><label for="pw">New password</label><input type="password" id="pw" name="pw" minlength="8" maxlength="128" placeholder="At least 8 characters" required><label for="pw2" style="margin-top:4px">Confirm password</label><input type="password" id="pw2" name="pw2" minlength="8" maxlength="128" placeholder="Repeat password" required><button type="submit" id="btn">Set new password</button></form><p id="msg"></p><script>document.getElementById('f').addEventListener('submit',async function(e){e.preventDefault();const pw=document.getElementById('pw').value;const pw2=document.getElementById('pw2').value;const msg=document.getElementById('msg');const btn=document.getElementById('btn');if(pw!==pw2){msg.style.display='block';msg.style.color='#ff6b6b';msg.textContent='Passwords do not match.';return;}btn.disabled=true;btn.textContent='Saving…';try{const r=await fetch('/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:${JSON.stringify(token)},newPassword:pw})});const d=await r.json();msg.style.display='block';if(r.ok){msg.style.color='#6dff9f';msg.textContent='Password updated! You can now log in with your new password.';document.getElementById('f').style.display='none';}else{msg.style.color='#ff6b6b';msg.textContent=d.message||'Something went wrong. Please request a new reset link.';btn.disabled=false;btn.textContent='Set new password';}}catch(err){msg.style.display='block';msg.style.color='#ff6b6b';msg.textContent='Network error. Please try again.';btn.disabled=false;btn.textContent='Set new password';}});</script>`;
  return pageHtml('Reset Password — ZoomGuru', body);
}

function errorPageHtml(message: string): string {
  return pageHtml('Invalid Link — ZoomGuru', `<h1>Invalid link</h1><p>${message}</p><p>Please request a new password reset from the ZoomGuru app.</p>`);
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(
    @Body() body: { email: string; name: string; password: string },
    @Req() req: FastifyRequest,
  ) {
    await checkIpRateLimit(req.ip, 'register', 5, 60);

    if (!body.email || body.email.length > 254) {
      throw new BadRequestException('Invalid email');
    }
    if (!body.name || body.name.length > 100) {
      throw new BadRequestException('Invalid name');
    }
    if (!body.password || body.password.length < 8 || body.password.length > 128) {
      throw new BadRequestException('Invalid password');
    }

    const cleanEmail    = sanitizeLine(body.email);
    const cleanName     = sanitizeLine(body.name);
    const cleanPassword = sanitize(body.password);

    if (!EMAIL_RE.test(cleanEmail)) {
      throw new BadRequestException('Invalid email format');
    }

    return this.authService.register(cleanEmail, cleanName, cleanPassword);
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Headers('x-device-id') deviceId: string | undefined,
    @Req() req: FastifyRequest,
  ) {
    await checkIpRateLimit(req.ip, 'login', 10, 60);

    if (!body.email || body.email.length > 254) {
      throw new BadRequestException('Invalid email');
    }
    if (!body.password || body.password.length > 128) {
      throw new BadRequestException('Invalid password');
    }

    const cleanIdentifier = sanitizeLine(body.email);
    const cleanPassword   = sanitize(body.password);

    if (!EMAIL_RE.test(cleanIdentifier) && cleanIdentifier.length < 3) {
      throw new BadRequestException('Invalid identifier');
    }
    if (deviceId && !DEVICE_ID_RE.test(deviceId)) {
      throw new BadRequestException('Invalid device ID');
    }

    return this.authService.login(cleanIdentifier, cleanPassword);
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(
    @Body() body: { email?: string },
    @Req() req: FastifyRequest,
  ) {
    await checkIpRateLimit(req.ip, 'forgot', 3, 300);

    if (!body.email || body.email.length > 254) {
      return { message: 'If that email exists, a reset link was sent' };
    }
    const cleanEmail = sanitizeLine(body.email);
    if (!EMAIL_RE.test(cleanEmail)) {
      return { message: 'If that email exists, a reset link was sent' };
    }
    await this.authService.forgotPassword(cleanEmail);
    return { message: 'If that email exists, a reset link was sent' };
  }

  @Get('reset-password-page')
  async resetPasswordPage(
    @Query('token') token: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!token || !TOKEN_RE.test(token)) {
      await reply.type('text/html').send(errorPageHtml('This reset link is invalid or has already been used.'));
      return;
    }
    await reply.type('text/html').send(resetFormHtml(token));
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: { token?: string; newPassword?: string }) {
    if (!body.token || !TOKEN_RE.test(body.token)) {
      throw new BadRequestException('Invalid reset token');
    }
    if (!body.newPassword || body.newPassword.length < 8 || body.newPassword.length > 128) {
      throw new BadRequestException('Password must be 8–128 characters');
    }
    await this.authService.resetPassword(body.token, sanitize(body.newPassword));
    return { message: 'Password updated successfully' };
  }
}
