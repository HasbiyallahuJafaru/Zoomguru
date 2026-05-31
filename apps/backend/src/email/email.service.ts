import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

const BASE_STYLE = `
  background:#07070b;color:#e8e8e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  margin:0;padding:0;
`;
const CARD_STYLE = `
  max-width:520px;margin:40px auto;background:#111118;border-radius:12px;
  padding:40px 36px;border:1px solid #1e1e2e;
`;
const LOGO_STYLE = `font-size:22px;font-weight:700;color:#fff;margin:0 0 32px;letter-spacing:-0.5px;`;
const H1_STYLE = `font-size:24px;font-weight:600;color:#fff;margin:0 0 16px;`;
const P_STYLE = `font-size:15px;line-height:1.6;color:#b0b0c0;margin:0 0 20px;`;
const BTN_STYLE = `
  display:inline-block;background:#6c63ff;color:#fff;text-decoration:none;
  padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;margin:8px 0 24px;
`;
const FOOTER_STYLE = `font-size:12px;color:#555566;margin:24px 0 0;border-top:1px solid #1e1e2e;padding-top:20px;`;

function wrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="${BASE_STYLE}"><div style="${CARD_STYLE}"><p style="${LOGO_STYLE}">ZoomGuru</p>${body}<p style="${FOOTER_STYLE}">You received this email because you have an account with ZoomGuru. If you did not create an account, you can safely ignore this email.</p></div></body></html>`;
}

@Injectable()
export class EmailService {
  private readonly resend = new Resend(process.env['RESEND_API_KEY']);
  private get from(): string {
    const addr = process.env['FROM_EMAIL'] ?? 'noreply@example.com';
    return `ZoomGuru <${addr}>`;
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    const html = wrap(`
      <h1 style="${H1_STYLE}">Welcome, ${name} 👋</h1>
      <p style="${P_STYLE}">Your ZoomGuru account is ready. Open the desktop app and log in to start using your AI interview assistant.</p>
      <p style="${P_STYLE}">With ZoomGuru you can:</p>
      <ul style="font-size:15px;line-height:1.8;color:#b0b0c0;padding-left:20px;margin:0 0 20px;">
        <li>Get real-time AI answers streamed directly to your overlay</li>
        <li>Capture and analyse screenshots of coding problems</li>
        <li>Stay invisible to screen-share software during interviews</li>
      </ul>
      <p style="${P_STYLE}">Good luck with your interviews!</p>
    `);
    try {
      await this.resend.emails.send({ from: this.from, to, subject: 'Welcome to ZoomGuru', html });
    } catch (err) {
      console.error('[EmailService] sendWelcome failed:', err);
    }
  }

  async sendPaymentConfirmation(to: string, name: string, plan: 'monthly' | 'lifetime'): Promise<void> {
    const planLabel = plan === 'lifetime' ? 'Lifetime' : 'Monthly';
    const planDetail = plan === 'lifetime'
      ? 'You now have lifetime access — no further charges, ever.'
      : 'Your subscription renews automatically each month. You can cancel at any time from the app.';
    const html = wrap(`
      <h1 style="${H1_STYLE}">Payment confirmed ✅</h1>
      <p style="${P_STYLE}">Hi ${name}, your <strong>${planLabel} Plan</strong> is now active.</p>
      <p style="${P_STYLE}">${planDetail}</p>
      <p style="${P_STYLE}">Open the ZoomGuru desktop app to get started. Your overlay is ready and waiting.</p>
    `);
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
    const html = wrap(`
      <h1 style="${H1_STYLE}">Payment failed ⚠️</h1>
      <p style="${P_STYLE}">Hi ${name}, we were unable to process your most recent subscription payment.</p>
      <p style="${P_STYLE}">Your account has been marked as past due. To restore access, please update your payment method and complete a new payment through the ZoomGuru app.</p>
      <p style="${P_STYLE}">If you believe this is an error, please check with your bank or card provider.</p>
    `);
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: 'Payment failed — action required',
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
    const urgency = daysRemaining === 1 ? 'tomorrow' : 'in 3 days';
    const html = wrap(`
      <h1 style="${H1_STYLE}">Your subscription expires ${urgency}</h1>
      <p style="${P_STYLE}">Hi ${name}, your ZoomGuru Monthly subscription expires on <strong>${date}</strong>.</p>
      <p style="${P_STYLE}">To keep uninterrupted access to your AI interview assistant, renew your subscription through the ZoomGuru desktop app before that date.</p>
      <p style="${P_STYLE}">If you have already renewed or switched to a lifetime plan, you can ignore this message.</p>
    `);
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
    const html = wrap(`
      <h1 style="${H1_STYLE}">Reset your password</h1>
      <p style="${P_STYLE}">We received a request to reset the password for your ZoomGuru account. Click the button below to set a new password.</p>
      <a href="${resetUrl}" style="${BTN_STYLE}">Reset password</a>
      <p style="${P_STYLE}">This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
    `);
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
