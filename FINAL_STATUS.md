# Upstream Water Delivery — Final MVP Status

## What is now implemented

### Customer
- Upstream/Greenpark customer-facing landing page
- Mobile-first water catalogue
- 20L refill, new bottle and bottled-water catalogue seeded in the database
- Quantity controls and cart total
- Greenpark block, house number and gate instructions
- Morning / afternoon / evening delivery slots
- M-Pesa STK Push checkout flow (server-side initiation)
- Pay-on-delivery M-Pesa and cash options recorded on the order
- Order number generation (`UP-00001`, etc.)
- Customer order history
- Status tracking: Confirmed → Packed → Out for delivery → Delivered
- Customer profile with wallet and bottle-balance display
- Phone OTP authentication through Supabase

### Admin
- Operations dashboard
- Order counts by status
- Order filtering
- Assign orders to riders
- Move orders through delivery statuses
- Rider list pulled from `user_roles`

### Rider
- Assigned delivery list
- Delivery address and gate instructions
- Move an order from Confirmed → Packed → Out for delivery → Delivered
- Simple rider-friendly interface

### Payments
- Safaricom Daraja STK Push helper
- Payment record created against an order
- Public M-Pesa callback endpoint at `/api/mpesa/callback`
- Successful callback marks payment successful and order confirmed
- Failed callback marks payment failed

## What still requires real-world configuration

These are external integrations/business operations, not UI gaps:

1. Enable Supabase Phone/SMS authentication and configure the SMS provider.
2. Configure production Daraja credentials and `MPESA_CALLBACK_URL`.
3. Add `SUPABASE_SERVICE_ROLE_KEY` only as a server-side deployment secret.
4. Obtain and configure the actual business Till/Paybill details.
5. Connect Africa's Talking / WhatsApp Business API when the business messaging accounts are ready.
6. Add live rider GPS tracking after the basic status/ETA workflow has been piloted.
7. Add subscriptions, loyalty and advanced inventory reporting after the pilot.

## Required environment variables for live M-Pesa

```text
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
MPESA_ENV=production
DARAJA_CONSUMER_KEY=...
DARAJA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...
MPESA_PASSKEY=...
MPESA_CALLBACK_URL=https://YOUR-DOMAIN/api/mpesa/callback
```

Never put `SUPABASE_SERVICE_ROLE_KEY`, Daraja secrets or passkeys in `VITE_*` variables.

## Local start

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Database

The project expects the SQL in `drizzle/migrations/0000_upstream_core_schema.sql` to be applied to the connected Supabase database. The seeded products and delivery slots are included there.

The first account created by the database trigger becomes the admin account. Additional accounts become normal users unless a rider role is assigned in `user_roles`.

## MVP boundary

The core Greenpark ordering operation is complete. SMS/WhatsApp automation, wallet top-ups, subscriptions, live GPS, advanced bottle inventory and analytics require their external providers or additional operational tables and are deliberately kept out of the critical checkout path so the first pilot can run reliably.
