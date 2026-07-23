-- Make the order-confirmation email idempotent + retriable. This nullable timestamp is the
-- "claim": sendOrderConfirmation atomically flips it from NULL→now() for a PAID order, and only
-- the caller that wins the flip sends. On a Resend rejection or a crash it is released back to
-- NULL so a later paid webhook/return retry can resend — closing the at-most-once gap.
alter table orders add column if not exists email_sent_at timestamptz;
