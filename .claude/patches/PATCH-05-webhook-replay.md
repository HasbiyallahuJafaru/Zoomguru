# PATCH-05 â€” Paystack Webhook Replay Protection

## Problem
Someone could capture a valid Paystack webhook payload and
replay it multiple times, activating licenses fraudulently.
The ON CONFLICT clause helps but doesn't catch all edge cases.

## Files Affected
- `apps/backend/src/paystack/paystack.service.ts`

## Risk Level
ðŸŸ¡ MEDIUM â€” Modifies webhook handler. Test with Paystack CLI after.

---

## Claude Code Prompt

```
Read .claude/PAYMENTS.md and .claude/DATABASE.md first.

In apps/backend/src/paystack/paystack.service.ts,
find the handleWebhook() method.

After the signature verification block (after the HMAC check
that throws BadRequestException if invalid), and BEFORE the
event handling (before the if (event === 'charge.success') block),
add this idempotency check:

  // Idempotency check â€” block replayed webhooks
  const sql = getDB();
  const reference = body?.data?.reference;
  
  if (reference) {
    const [existing] = await sql`
      SELECT id, status FROM payments
      WHERE paystack_reference = ${reference}
      AND status = 'success'
      LIMIT 1
    `;
    
    if (existing) {
      // Already processed â€” return 200 silently (Paystack expects 200)
      return { received: true, duplicate: true };
    }
  }

Place this block between the signature check and the event
if-statements. Do not move or modify any other code.
Do not change the signature verification logic.
Show me exactly where in the method this was inserted.
```

---

## Verification

```bash
# Send the same webhook payload twice using curl
# First call: should process and activate license
# Second call: should return { received: true, duplicate: true }
# Check DB: user should only have ONE license record
```

## Rollback
Remove the idempotency check block entirely.

