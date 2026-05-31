import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

const SERIF = `'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif`;
const SANS  = `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;

const BASE_STYLE = [
  'background-color:#07070b',
  'background-image:linear-gradient(135deg,transparent 28%,rgba(255,255,255,0.018) 37%,rgba(255,255,255,0.034) 44%,rgba(255,255,255,0.018) 51%,transparent 60%)',
  'color:#e8e8e8',
  `font-family:${SANS}`,
  'margin:0',
  'padding:0',
].join(';');

const CARD_STYLE = [
  'max-width:520px',
  'margin:40px auto',
  'background-color:#111118',
  'background-image:linear-gradient(135deg,transparent 18%,rgba(255,255,255,0.012) 28%,rgba(255,255,255,0.024) 36%,rgba(255,255,255,0.012) 44%,transparent 54%)',
  'border-radius:12px',
  'border:1px solid #1e1e2e',
  'overflow:hidden',
].join(';');

const ACCENT_BAR  = 'height:3px;background:linear-gradient(90deg,#6c63ff 0%,rgba(108,99,255,0.12) 100%)';
const HEADER_STYLE = 'padding:26px 36px 22px;border-bottom:1px solid #16161f';
const BODY_STYLE   = 'padding:32px 36px';
const FOOTER_STYLE = [
  `font-family:${SANS}`,
  'font-size:12px',
  'line-height:1.7',
  'color:#3a3a50',
  'padding:20px 36px',
  'border-top:1px solid #16161f',
].join(';');

const LOGO_STYLE = [
  `font-family:${SERIF}`,
  'font-size:19px',
  'font-weight:400',
  'font-style:italic',
  'color:#ffffff',
  'margin:0',
  'letter-spacing:0.2px',
].join(';');

const H1_STYLE = [
  `font-family:${SANS}`,
  'font-size:21px',
  'font-weight:600',
  'color:#f0f0f8',
  'margin:0 0 14px',
  'letter-spacing:-0.3px',
  'line-height:1.35',
].join(';');

const P_STYLE = [
  `font-family:${SANS}`,
  'font-size:15px',
  'line-height:1.75',
  'color:#8888a0',
  'margin:0 0 18px',
].join(';');

const STRONG_STYLE = 'color:#c8c8e0;font-weight:600';

const BTN_STYLE = [
  'display:inline-block',
  'background:#ffffff',
  'color:#07070b',
  'text-decoration:none',
  'padding:11px 30px',
  'border-radius:6px',
  `font-family:${SANS}`,
  'font-size:12px',
  'font-weight:700',
  'letter-spacing:0.6px',
  'text-transform:uppercase',
  'margin:4px 0 26px',
].join(';');

const BADGE_BASE = [
  'display:inline-block',
  `font-family:${SANS}`,
  'font-size:10px',
  'font-weight:700',
  'letter-spacing:1.2px',
  'text-transform:uppercase',
  'padding:4px 10px',
  'border-radius:4px',
  'margin:0 0 18px',
].join(';');

const BADGE_PLAN  = `${BADGE_BASE};background:rgba(108,99,255,0.12);border:1px solid rgba(108,99,255,0.28);color:#9d95ff`;
const BADGE_ALERT = `${BADGE_BASE};background:rgba(244,63,94,0.10);border:1px solid rgba(244,63,94,0.25);color:#f06080`;

const ROW_STYLE = `font-family:${SANS};font-size:14px;line-height:1.65;color:#8888a0;padding:11px 0;border-bottom:1px solid #16161f`;
const ROW_LAST  = `font-family:${SANS};font-size:14px;line-height:1.65;color:#8888a0;padding:11px 0`;

function wrap(body: string): string {
  return (
    '<!DOCTYPE html><html>' +
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    `<body style="${BASE_STYLE}">` +
    `<div style="${CARD_STYLE}">` +
    `<div style="${ACCENT_BAR}"></div>` +
    `<div style="${HEADER_STYLE}"><p style="${LOGO_STYLE}">ZoomGuru</p></div>` +
    `<div style="${BODY_STYLE}">${body}</div>` +
    `<div style="${FOOTER_STYLE}">You received this because you have a ZoomGuru account. If you did not initiate this action, you can safely ignore it.</div>` +
    '</div>' +
    '</body></html>'
  );
}

@Injectable()
export class EmailService {
  private readonly resend = new Resend(process.env['RESEND_API_KEY']);
  private get from(): string {
    const addr = process.env['FROM_EMAIL'] ?? 'noreply@example.com';
    return `ZoomGuru <${addr}>`;
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    const html = wrap(
      `<h1 style="${H1_STYLE}">Welcome, ${name}.</h1>` +
      `<p style="${P_STYLE}">Your ZoomGuru account is active. Open the desktop app and sign in to start using your AI interview assistant.</p>` +
      `<div style="margin:0 0 22px">` +
        `<div style="${ROW_STYLE}">Real-time AI answers streamed privately to your screen overlay</div>` +
        `<div style="${ROW_STYLE}">Instant screenshot capture and analysis for coding challenges</div>` +
        `<div style="${ROW_LAST}">Completely invisible to screen-share and video call software</div>` +
      `</div>` +
      `<p style="${P_STYLE}">Prepare well. Perform better.</p>`,
    );
    try {
      await this.resend.emails.send({ from: this.from, to, subject: 'Welcome to ZoomGuru', html });
    } catch (err) {
      console.error('[EmailService] sendWelcome failed:', err);
    }
  }

  async sendPaymentConfirmation(to: string, name: string, plan: 'monthly' | 'lifetime'): Promise<void> {
    const planLabel = plan === 'lifetime' ? 'Lifetime' : 'Monthly';
    const planDetail = plan === 'lifetime'
      ? 'You now have permanent access — no further charges, ever.'
      : 'Your subscription renews automatically each month. You may cancel at any time from within the app.';
    const html = wrap(
      `<div style="${BADGE_PLAN}">${planLabel} Plan</div>` +
      `<h1 style="${H1_STYLE}">Payment confirmed.</h1>` +
      `<p style="${P_STYLE}">Hi ${name}, your <span style="${STRONG_STYLE}">${planLabel} Plan</span> is now active.</p>` +
      `<p style="${P_STYLE}">${planDetail}</p>` +
      `<p style="${P_STYLE}">Open the ZoomGuru desktop app — your overlay is ready.</p>`,
    );
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: `Payment confirmed — ZoomGuru ${planLabel} Plan`,
        html,
      });
    } catch (err) {
      console.error('[EmailService] sendPaymentConfirmation failed:', err);
    }
  }

  async sendPaymentFailed(to: string, name: string): Promise<void> {
    const html = wrap(
      `<div style="${BADGE_ALERT}">Action required</div>` +
      `<h1 style="${H1_STYLE}">Payment unsuccessful.</h1>` +
      `<p style="${P_STYLE}">Hi ${name}, we were unable to process your most recent subscription payment. Your account has been marked as past due.</p>` +
      `<p style="${P_STYLE}">To restore full access, open the ZoomGuru app and complete a new payment with an updated payment method.</p>` +
      `<p style="${P_STYLE}">If you believe this is a bank or card error, please contact your provider directly.</p>`,
    );
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: 'Payment unsuccessful — action required',
        html,
      });
    } catch (err) {
      console.error('[EmailService] sendPaymentFailed failed:', err);
    }
  }

  async sendExpiryReminder(to: string, name: string, daysRemaining: 3 | 1, periodEnd: string): Promise<void> {
    const date = new Date(periodEnd).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const urgency      = daysRemaining === 1 ? 'tomorrow' : 'in 3 days';
    const urgencyLabel = daysRemaining === 1 ? '1 day remaining' : '3 days remaining';
    const html = wrap(
      `<div style="${BADGE_ALERT}">${urgencyLabel}</div>` +
      `<h1 style="${H1_STYLE}">Your subscription expires ${urgency}.</h1>` +
      `<p style="${P_STYLE}">Hi ${name}, your ZoomGuru Monthly subscription expires on <span style="${STRONG_STYLE}">${date}</span>.</p>` +
      `<p style="${P_STYLE}">To keep uninterrupted access to your interview assistant, renew your subscription from within the ZoomGuru desktop app before that date.</p>` +
      `<p style="${P_STYLE}">If you have already renewed or switched to a lifetime plan, please disregard this message.</p>`,
    );
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: `Your ZoomGuru subscription expires ${urgency}`,
        html,
      });
    } catch (err) {
      console.error('[EmailService] sendExpiryReminder failed:', err);
    }
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    const html = wrap(
      `<h1 style="${H1_STYLE}">Reset your password.</h1>` +
      `<p style="${P_STYLE}">We received a request to reset the password on your ZoomGuru account. Use the button below to set a new one.</p>` +
      `<a href="${resetUrl}" style="${BTN_STYLE}">Reset password</a>` +
      `<p style="${P_STYLE}">This link expires in <span style="${STRONG_STYLE}">1 hour</span>. If you did not request this, you can safely ignore this email — your password will remain unchanged.</p>`,
    );
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: 'Reset your ZoomGuru password',
        html,
      });
    } catch (err) {
      console.error('[EmailService] sendPasswordReset failed:', err);
    }
  }
}
