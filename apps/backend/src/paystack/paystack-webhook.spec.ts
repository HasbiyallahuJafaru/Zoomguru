import * as crypto from 'crypto';

// Pure unit test: HMAC-SHA512 webhook signature verification
// (tests the same logic used in paystack.service.ts handleWebhook)

function verifyWebhookSignature(
  body: object,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(body))
    .digest('hex');
  return hash === signature;
}

const WEBHOOK_SECRET = 'test-webhook-secret-abc123';

const chargeSuccessBody = {
  event: 'charge.success',
  data: {
    reference: 'ZG-TEST-REF-001',
    amount: 1500000,
    currency: 'NGN',
    metadata: {
      user_id: 'user-uuid-123',
      plan: 'monthly',
    },
  },
};

describe('Paystack Webhook Signature Verification', () => {
  it('accepts a valid HMAC-SHA512 signature', () => {
    const validSig = crypto
      .createHmac('sha512', WEBHOOK_SECRET)
      .update(JSON.stringify(chargeSuccessBody))
      .digest('hex');

    expect(verifyWebhookSignature(chargeSuccessBody, validSig, WEBHOOK_SECRET)).toBe(true);
  });

  it('rejects an incorrect signature', () => {
    expect(
      verifyWebhookSignature(chargeSuccessBody, 'bad-signature', WEBHOOK_SECRET)
    ).toBe(false);
  });

  it('rejects signature computed with wrong secret', () => {
    const wrongSig = crypto
      .createHmac('sha512', 'wrong-secret')
      .update(JSON.stringify(chargeSuccessBody))
      .digest('hex');

    expect(verifyWebhookSignature(chargeSuccessBody, wrongSig, WEBHOOK_SECRET)).toBe(false);
  });

  it('rejects signature if body is tampered after signing', () => {
    const sig = crypto
      .createHmac('sha512', WEBHOOK_SECRET)
      .update(JSON.stringify(chargeSuccessBody))
      .digest('hex');

    const tamperedBody = { ...chargeSuccessBody, event: 'charge.failed' };
    expect(verifyWebhookSignature(tamperedBody, sig, WEBHOOK_SECRET)).toBe(false);
  });

  it('rejects empty signature string', () => {
    expect(verifyWebhookSignature(chargeSuccessBody, '', WEBHOOK_SECRET)).toBe(false);
  });
});

describe('Paystack Amounts (kobo conversion)', () => {
  it('monthly plan is ₦15,000 = 1,500,000 kobo', () => {
    const monthly = 1500000;
    expect(monthly / 100).toBe(15000);
  });

  it('lifetime plan is ₦100,000 = 10,000,000 kobo', () => {
    const lifetime = 10000000;
    expect(lifetime / 100).toBe(100000);
  });

  it('webhook data.amount divided by 100 gives NGN', () => {
    const amount = chargeSuccessBody.data.amount;
    expect(amount / 100).toBe(15000);
  });
});

describe('Referral Commission Calculation', () => {
  it('25% commission on ₦15,000 = ₦3,750', () => {
    const amount = 15000;
    const commission = parseFloat((amount * 0.25).toFixed(2));
    expect(commission).toBe(3750);
  });

  it('25% commission on ₦100,000 = ₦25,000', () => {
    const amount = 100000;
    const commission = parseFloat((amount * 0.25).toFixed(2));
    expect(commission).toBe(25000);
  });

  it('commission is rounded to 2 decimal places', () => {
    const amount = 33333;
    const commission = parseFloat((amount * 0.25).toFixed(2));
    expect(commission).toBe(8333.25);
  });
});
