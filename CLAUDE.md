# Project: AI Missed-Call Assistant for Driving Schools

## What we are building
An AI phone assistant for Ontario driving schools. When a school misses a call (busy, no answer, or after hours), the call is forwarded to a phone number we own. A Retell AI voice agent answers, answers questions using the school's info, and collects lead details. When the call ends, Retell sends a webhook to our app. Our app saves the call and lead, texts a summary to the school's admin, texts a confirmation to the caller, and shows everything on a dashboard.

The product does NOT replace the school's website, booking system or admin staff. It catches calls they would miss and hands admin a ready-to-book lead.

## MVP scope
IN scope:
1. Retell webhook endpoint that receives call results (transcript, recording URL, extracted lead data)
2. Save calls + leads to Supabase
3. SMS to school admin with the lead summary (Twilio)
4. SMS confirmation to the caller (Twilio)
5. Login for school owner/admin (Supabase Auth)
6. Leads dashboard: list, detail view, status buttons (New / Called back / Booked / Not interested)
7. School setup page: name, hours, AI phone number, admin phone, packages, prices, FAQs
8. Weekly stats page + weekly SMS report to owner (calls answered, leads, booked)

OUT of scope for now (do not build): direct calendar booking, payments, instructor mobile app, lesson notes, website widgets, outbound AI calls.

## Tech stack
- Next.js (App Router) + TypeScript
- Tailwind CSS for styling
- Supabase: Postgres database + Auth (Canadian region)
- Retell AI for the voice agent (configured in the Retell dashboard; our app receives its webhooks)
- Twilio for SMS
- Deployed on Vercel

## Data model
- `schools`: id, name, ai_phone_number (unique, E.164), admin_phone, owner_phone, timezone (default America/Toronto), business_hours (json), created_at
- `school_info`: id, school_id, packages (json: name, price, details), faqs (json: question, answer), extra_notes
- `calls`: id, school_id, retell_call_id (unique), from_number, to_number, started_at, duration_seconds, transcript, recording_url, summary, created_at
- `leads`: id, school_id, call_id, name, phone, licence_level (G1/G2/G/none/unknown), package_interest, preferred_times, pickup_area, questions_asked, needs_owner (bool), status (new/called_back/booked/not_interested), created_at, updated_at
- `school_users`: user_id (auth.users), school_id, role (owner/admin)

Use Row Level Security so users only see data for schools they belong to.

## How a call is matched to a school
Each school has its own AI phone number. The webhook looks up the school by the call's `to_number`.

## Rules for the code
- Keep it simple and readable. I am learning; explain what you build in plain language after each step.
- Never put API keys in code. Use `.env.local` and list every variable in `.env.example`. Never commit `.env.local`.
- Verify the Retell webhook signature before trusting a request.
- Make the webhook idempotent: the same `retell_call_id` must never create duplicate calls, leads or texts.
- Phone numbers stored in E.164 format (+14165550123).
- Times displayed in America/Toronto.
- Check the current Retell, Twilio and Supabase docs for exact field names instead of guessing.
- After each step, tell me how to test it.

## Privacy
Many callers are teenagers. Store only what we need, keep data in Canada, and the AI must tell callers the call may be recorded. Follow PIPEDA basics.
