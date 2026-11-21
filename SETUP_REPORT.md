# Setup Report: AI Missed-Call Assistant

This guide is written for a beginner. Work through **Part 2** from top to bottom and you'll go from "code on my laptop" to "a real call gets answered and I get a text."

---

## 1. What was built, and how the pieces fit

```
 Caller ──► School's phone ──(missed / busy / after hours: call forwarding)──► AI phone number
                                                                                   │
                                                                          Retell AI voice agent
                                                                    (answers, collects lead details)
                                                                                   │  call ends
                                                                                   ▼
                                                     POST /api/retell-webhook  (this app, on Vercel)
                                                       1. checks Retell's signature
                                                       2. finds the school by the number that was called
                                                       3. saves the call + lead in Supabase (no duplicates)
                                                       4. texts the admin a summary + texts the caller a thank-you (Twilio)
                                                                                   │
                                                     Dashboard (phone-friendly): Leads · Stats · Settings
                                                     Every Monday 9 a.m.: weekly report text to the owner
```

| Part | Where in the code | What it does |
|---|---|---|
| Database | `supabase/migrations/…_initial_schema.sql` | 5 tables, security rules (RLS), helper functions |
| Demo data | `supabase/seed.sql` | "Demo Driving School" with 7 packages, 8 FAQs, 5 calls/leads |
| Login | `app/login`, `proxy.ts`, `lib/supabase/*` | Email + password login; `/dashboard` requires login |
| Create school | `app/dashboard/create-school-form.tsx` | New users with no school can create one |
| Webhook | `app/api/retell-webhook/route.ts`, `lib/retell*.ts`, `lib/save-call.ts` | Receives finished calls from Retell |
| Texts | `lib/sms.ts`, `lib/messages.ts`, `lib/notify-lead.ts` | Twilio SMS, or printed in the terminal when `MOCK_SMS=true` |
| Leads | `app/dashboard/page.tsx`, `app/dashboard/leads/[id]` | List, filters, details, recording, transcript, status buttons |
| Settings | `app/dashboard/settings`, `lib/agent-prompt.ts` | School info + "Copy AI agent prompt" + Retell field list |
| Stats | `app/dashboard/stats`, `lib/stats.ts` | This week vs last week |
| Weekly report | `app/api/cron/weekly-report/route.ts`, `vercel.json` | Monday 9 a.m. text to the owner |
| Test tool | `scripts/send-test-webhook.ts` | Pretends to be Retell (`npm run test:webhook`) |

**What already works without any API keys:** the app runs, the login page shows, and the test webhook is read and checked, and its two texts are printed in your terminal ("dry run"). Nothing is saved until Supabase is connected.

---

## 2. Your checklist (do these in order)

> 💡 All commands below are typed in **PowerShell** in the project folder (`C:\Users\benny\OneDrive\Desktop\DrivingSchool`).
> Your settings file is `.env.local` in the project folder. It currently has placeholder values. **Never commit or share it.**

### ☐ Step 1: Create the Supabase project (database + login)

1. Go to <https://supabase.com> → **Sign in** → **New project**.
2. Name: `driving-school-assistant`. Set a strong **database password** and save it in your password manager.
3. **Region: Canada (Central)**. This keeps student data in Canada.
4. Click **Create new project** and wait about 2 minutes.

### ☐ Step 2: Run the migrations (creates the tables and permissions)

There are **two** files in `supabase/migrations`. Run them **in order**, one at a time:

1. In Supabase, open **SQL Editor** in the left sidebar → **New query**.
2. Open `supabase/migrations/20261121000000_initial_schema.sql` in VS Code, select all (Ctrl+A), copy.
3. Paste into the SQL editor → click **Run**. You should see "Success. No rows returned."
4. **New query** again, and do the same with `supabase/migrations/20261121000001_explicit_grants.sql`. This file gives the app permission to use the tables, because newer Supabase projects don't do that automatically. Without it you'll see *"permission denied for table school_users"*. It's safe to run again.
5. Check: **Table Editor** should now list `schools`, `school_info`, `calls`, `leads`, `school_users`.

### ☐ Step 3: Load the demo data

1. **SQL Editor** → **New query**.
2. Copy all of `supabase/seed.sql`, paste it, and click **Run**.
3. Check: **Table Editor → leads** shows 5 rows. (You can run the seed again any time to reset the demo school.)

### ☐ Step 4: Copy the Supabase keys into `.env.local`

1. In Supabase: **Project Settings** (gear icon) → **API Keys**. Copy the **Project URL** from **Project Settings → Data API** (or the "Connect" button at the top).
2. Open `.env.local` and fill in:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, like `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The **anon / public** key (on the "Legacy API keys" tab) **or** the new **Publishable key** (`sb_publishable_…`). Either works. |
| `SUPABASE_SERVICE_ROLE_KEY` | The **service_role** key (legacy tab) **or** a **Secret key** (`sb_secret_…`). ⚠️ This key can read everything. It only lives in `.env.local` and Vercel, never anywhere else. |

3. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` (change it to your Vercel URL later)
   - **Redirect URLs** → **Add URL**: `http://localhost:3000/auth/callback`

### ☐ Step 5: Create your first login and link it to the demo school

1. In Supabase: **Authentication → Users → Add user → Create new user**.
2. Enter your email and a password, and tick **Auto Confirm User** → **Create user**.
3. **SQL Editor → New query**. Paste this, put your email in, then **Run**:

```sql
insert into public.school_users (user_id, school_id, role)
select id, '11111111-1111-4111-8111-111111111111', 'owner'
from auth.users
where email = 'YOUR-EMAIL@example.com';
```

It should say "Success. 1 row affected" (0 rows means the email didn't match).

> Tip: the login page also has "Create an account". By default Supabase emails a confirmation link first. For a private pilot, you may want to turn off public sign-ups: **Authentication → Sign In / Providers → turn off "Allow new users to sign up"**.

### ☐ Step 6: Run the app locally and send a test call

1. Install packages (only needed once, or after pulling new code):

```powershell
npm install
```

2. Start the app:

```powershell
npm run dev
```

3. Open <http://localhost:3000/login> and log in. You should see the 5 demo leads.
4. Open a **second** PowerShell window in the same folder and send a fake call:

```powershell
npm run test:webhook
```

5. In the first window (the one running `npm run dev`) you should see `Saved new call …` and two **📱 MOCK SMS (not sent)** boxes. Refresh the dashboard: **Priya Sharma** is the newest lead.
6. Test that duplicates are blocked:

```powershell
npm run test:webhook -- --repeat
```

The second delivery should log `Already had call …`, with no new lead and no new texts.

7. Test a complaint call:

```powershell
npm run test:webhook -- --owner
```

The admin text should end with **⚠️ Needs owner**, and the lead shows a red **Owner** tag.

### ☐ Step 7: Twilio (real text messages)

1. Sign up at <https://www.twilio.com> and verify your phone.
2. **Console home → Account Info**: copy the **Account SID** → `TWILIO_ACCOUNT_SID` and the **Auth Token** → `TWILIO_AUTH_TOKEN`.
3. Buy a number: **Phone Numbers → Manage → Buy a number** → Country **Canada** → tick **SMS** → pick a local area code (416/647/905/289…) → **Buy**. Put it in `TWILIO_FROM_NUMBER` in E.164 format, like `+16475550100`.
4. **Canadian SMS rules: check these before going live.**
   - Read Twilio's current **"SMS guidelines: Canada"** page (search that phrase). The rules change, and some number types (for example toll-free) need a verification step first.
   - Canada's anti-spam law (CASL): our texts answer a call the person just made (a confirmation), which is generally allowed. **Don't** use these numbers for marketing blasts.
   - Twilio automatically handles replies like **STOP**.
   - **Trial accounts** can only text numbers you've verified in Twilio, and every message starts with "Sent from your Twilio trial account". Upgrade (add a payment method) before the pilot.
5. To send real texts, set `MOCK_SMS=false` in `.env.local` and restart `npm run dev`. Make the demo school's **Admin phone** (Settings page) your own mobile so you receive the texts.

### ☐ Step 8: Put the code on GitHub

1. On <https://github.com> → **New repository** → name `driving-school-assistant` → **Private** → **Create** (don't add a README).
2. In PowerShell (replace YOUR-USERNAME):

```powershell
git remote add origin https://github.com/YOUR-USERNAME/driving-school-assistant.git
```

```powershell
git push -u origin main
```

`.env.local` is in `.gitignore`, so your keys stay on your computer.

### ☐ Step 9: Deploy to Vercel

1. <https://vercel.com> → sign in with GitHub → **Add New… → Project** → **Import** `driving-school-assistant`. Don't click **Deploy** yet.
2. On the same screen, open **Environment Variables** and add **every** variable from `.env.example` with real values:
   - `MOCK_SMS` = `false` (or `true` while you're still testing without Twilio)
   - `APP_URL` = your Vercel URL, like `https://driving-school-assistant.vercel.app` (you can edit this after the first deploy and redeploy)
   - `CRON_SECRET` = a long random string. To make one in PowerShell:

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | % {[char]$_})
```

3. Click **Deploy**. When it's done, open the URL and log in.
4. Back in Supabase **Authentication → URL Configuration**: set **Site URL** to your Vercel URL and add `https://YOUR-APP.vercel.app/auth/callback` to **Redirect URLs**.
5. `vercel.json` sets the server region to **Montréal (`yul1`)** so the app runs in Canada. If Vercel rejects the region on your plan, delete the `"regions"` line and redeploy.

### ☐ Step 10: Create the Retell AI agent

1. Sign up at <https://www.retellai.com> → open the dashboard.
2. **API Keys** (in Settings): find the key with the **webhook** badge. Copy it into `RETELL_WEBHOOK_SECRET`, and also copy an API key into `RETELL_API_KEY`, in both `.env.local` **and** Vercel. Redeploy Vercel after changing variables (**Deployments → ⋯ → Redeploy**).
3. In your app: **Settings** → fill in your school info → **Save settings** → click **Copy AI agent prompt**.
4. In Retell: **Agents → Create an agent → Single Prompt** agent. Paste the prompt into the prompt box. Choose a voice and set the language to English. A Canadian or neutral voice works well.
5. In the agent, open **Post-Call Analysis** and add each field from the bottom of your app's Settings page. **The names must match exactly**:

| Name | Type | Description (paste it in) |
|---|---|---|
| `name` | Text | The caller's full name. Leave blank if they didn't give it. |
| `phone` | Text | The best callback phone number the caller gave, if different from the number they called from. Otherwise leave blank. |
| `licence_level` | Selector (options: `G1`, `G2`, `G`, `none`, `unknown`) | The student's current Ontario licence… |
| `package_interest` | Text | The package or service the caller is interested in… |
| `preferred_times` | Text | Preferred lesson days and times… |
| `pickup_area` | Text | Where the student wants to be picked up… |
| `questions_asked` | Text | A short list of the questions the caller asked… |
| `needs_owner` | Boolean | True if the call is a complaint, refund request, accident, or anything unusual… |

   (If your Retell version names the types differently, use: Text → "string/text", Selector → "enum", Boolean → "boolean".)

6. **Webhook URL**: in the agent's settings (or the account-wide **Webhooks** page) set it to:
   `https://YOUR-APP.vercel.app/api/retell-webhook`
   Retell can't reach `localhost`, so use the Vercel URL.
7. **Phone number**: **Phone Numbers → Buy a number**. Pick a Toronto-area code if one is offered. Set the **inbound agent** to your new agent.
   - If Retell can't offer a Canadian number, buy one in Twilio and connect it to Retell with Retell's **Import number / custom telephony (SIP trunk)** guide.
8. In your app's **Settings**, set **AI phone number** to that number and **Save**. **This is how calls are matched to your school.** If it's wrong, calls won't be saved.
9. Quick test: call the AI number from your mobile and have a short conversation. About 30–60 seconds after hanging up you should get the admin text, and the lead appears on the dashboard.

### ☐ Step 11: Set up call forwarding and test it

The school's own phone must forward calls it can't answer to the **AI phone number**.

- **Mobile phones (Rogers, Bell, Telus, Fido, Koodo, Freedom…)** usually accept these dial codes. Dial each, then press Call:
  - Forward when busy: `**67*1AINUMBER#`
  - Forward when not answered: `**61*1AINUMBER#`
  - Forward when unreachable/off: `**62*1AINUMBER#`
  - (Example AI number 416-555-0100 → `**61*14165550100#`.) Some carriers use different codes or charge for forwarding, so check with yours.
- **Office landline or VoIP (RingCentral, Ooma, Vonage, etc.)**: look for "conditional call forwarding" / "forward on no answer" in the provider's web portal, or call their support.
- **After hours**: most VoIP systems let you schedule "after hours: forward all calls."

**Test from your own phone:** call the school number, let it ring out, and confirm the AI answers, mentions recording, and collects details. After you hang up, check that you got the admin text, the caller confirmation, and the new lead on the dashboard.

---

## 3. How to test each part (and what "working" looks like)

| Part | How to test | Working looks like |
|---|---|---|
| Build | `npm run build` | Ends with a route list, no red errors |
| Lint | `npm run lint` | No output after the command line |
| Login protection | Open `/dashboard` while logged out | You're sent to `/login` |
| Login | Log in with the Step 5 user | Leads list for Demo Driving School |
| New user | Create a second user without linking them | They see "Create your school" and, after submitting, the Settings page |
| Privacy (RLS) | Log in as that second user | They do **not** see the demo school's leads |
| Webhook (local) | `npm run test:webhook` | `Saved new call` in the dev terminal + two MOCK SMS boxes + new lead on dashboard |
| No duplicates | `npm run test:webhook -- --repeat` | Second delivery logs `Already had call`; no extra lead or texts |
| Needs owner | `npm run test:webhook -- --owner` | "⚠️ Needs owner" in admin text; red Owner tag; different caller confirmation |
| Signature check | With `RETELL_WEBHOOK_SECRET` set, the script signs automatically. Sending with a wrong key (change it temporarily) | Correct key → HTTP 204; wrong/missing → HTTP 401 |
| Webhook (live) | `npm run test:webhook -- --url https://YOUR-APP.vercel.app` (needs `RETELL_WEBHOOK_SECRET` in `.env.local`) | HTTP 204 and lead in the live dashboard |
| Lead details | Tap a lead | Details, summary, recording player, transcript; status buttons change the badge |
| Settings | Change a price → Save | "Saved ✓"; a bad phone like `555-12` shows an error |
| Agent prompt | Click "Copy AI agent prompt", paste in Notepad | Prompt includes your hours, packages and FAQs |
| Stats | Open Stats | This week vs last week numbers (demo data has leads in both) |
| Weekly report | Set a real `CRON_SECRET` in `.env.local` and restart, then: `curl.exe -H "Authorization: Bearer YOUR_CRON_SECRET" "http://localhost:3000/api/cron/weekly-report?force=1"` | JSON with `"sent": true` and a MOCK SMS box: "Last week your assistant answered X calls…" |
| Cron security | Same command without the header | `{"error":"Unauthorized"}` |
| Real call | Call the AI number | Texts arrive within ~1 minute after hanging up |

**What I actually ran before handing this over (with placeholder keys):** `npm run build` ✅, `npm run lint` ✅; dev server in mock mode with `npm run test:webhook --repeat` → lead parsed correctly, both texts printed, repeat delivery ignored ✅; `--owner` call → "⚠️ Needs owner" text ✅; signed request with the right key → 204, wrong key / unsigned → 401 ✅; cron without/with wrong secret → 401, right secret → skipped unless Monday 9 a.m. ✅; `/dashboard` logged-out → redirect to `/login` ✅. The SQL migration + seed were run in a real Postgres engine (PGlite) with a stand-in `auth` schema: tables, triggers, seed (twice), RLS isolation between two users, status-only updates and `create_school()` all worked ✅. The settings form and generated prompt were checked visually at phone size ✅.

**Not yet verified (they need your real keys):** saving to a real Supabase project, the leads/lead-detail/stats pages with real data, real Twilio sending, and a real Retell call.

---

## 4. Decisions I made, limitations, and what's still mocked

### Decisions
- **Next.js 16**: in this version "middleware" is called **proxy** (`proxy.ts`). I turned off the new "Cache Components" mode because every dashboard page is per-user, and this keeps the code simpler.
- **Webhook signature**: Retell signs webhooks with your **API key that has the webhook badge** (there's no separate "secret"). `RETELL_WEBHOOK_SECRET` holds that key. If it's blank, `RETELL_API_KEY` is used. The check is skipped **only** when `MOCK_SMS=true`, no key is set, **and** it's not running in production.
- **Dry run**: if Supabase keys are still placeholders, the webhook parses the call and prints the texts it would send using the demo school's details, but saves nothing.
- **Fast replies**: the call and lead are saved first, then the webhook replies (Retell retries if it doesn't hear back in 10 s). Texts are sent right **after** the reply. If saving fails, the webhook returns 500 so Retell retries, which is safe because saving can't create duplicates.
- **Never double-texting**: I added `admin_notified_at` and `caller_notified_at` columns to `leads`. A text is only sent if that column is still empty. If a text fails, the column is cleared again.
- **Every analyzed call creates a lead**, even if the caller gave no details (you can mark it "Not interested"). If no phone was given, the caller's number is used.
- **Caller confirmation**: normal calls get "We'll reach out shortly to book your lesson." Complaints and other owner calls get "We got your message and someone from our team will call you back shortly," because a refund request shouldn't be told "book your lesson".
- **Admin text** includes a link to the lead in the dashboard when it fits in 320 characters (the "⚠️ Needs owner" line is never cut off). Names are shortened to "Priya S."
- **Security rules**: dashboard users can only change a lead's **status**. Calls are read-only. Schools are created through a database function, `create_school()`, that also makes you the owner.
- **Data model additions**: besides CLAUDE.md's columns, I added `updated_at` to `schools` and `school_info`, and the two "notified" columns to `leads`. Each call has at most one lead.
- **Stats**: weeks run Monday–Sunday in Toronto time. "Booked" = leads created that week that are now marked Booked. Estimated revenue = booked × the **average of all package prices** (so cheap hourly lessons pull the average down, which makes it a rough, conservative estimate).
- **Weekly report timing**: Vercel cron only uses UTC, and Toronto is UTC−5 in winter and UTC−4 in summer. So `vercel.json` runs at **13:00 and 14:00 UTC every Monday**, and the code only sends during the run that lands at **9 a.m. Toronto**. On Vercel's free plan, a cron may fire any time within that hour.
- **Server region**: `vercel.json` asks for Montréal (`yul1`).

### Known limitations
- **Data in Canada, partly**: Supabase (Canada Central) and Vercel (Montréal) keep the database and app in Canada. **Retell and Twilio process calls and texts in the US**, and the call recording stays on Retell's servers (the dashboard links to it). Mention this in your privacy notice, and check Retell's data-retention settings.
- No automatic deletion of old calls/recordings yet (PIPEDA says keep data only as long as needed).
- If a user belongs to several schools, the dashboard shows the first one. There's no school switcher yet.
- The leads list shows the latest 200 leads (no paging).
- Calls from Retell's "test in browser" button have no phone number, so they can't be matched to a school and aren't saved. Test with a real phone call or `npm run test:webhook`.
- Some carriers change caller ID when forwarding. If so, the "caller" number will be the school's own number. See Troubleshooting.
- There are no automated tests yet. Checks were done by hand (see section 3).

### Still mocked
- **Texts** when `MOCK_SMS=true`: they're printed in the terminal (or the Vercel logs) instead of being sent.
- **Saving** when Supabase isn't set up (dry run, described above).
- The test script's **recording URL** is a sample MP3, not a real call.

---

## 5. Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| Login page says "Supabase isn't connected yet" | `.env.local` still has placeholders. Fill in Step 4, then **stop and restart** `npm run dev` (Ctrl+C, then run it again). |
| "Invalid login credentials" | Wrong password, or the user isn't confirmed. Recreate it with **Auto Confirm User** ticked. |
| "permission denied for table …" in the terminal, or "Couldn't load your school" | The permissions file wasn't run. Run `supabase/migrations/20261121000001_explicit_grants.sql` in the SQL Editor (Step 2.4), then reload. |
| Logged in but see "Create your school" | Your login isn't linked. Run the SQL from Step 5 with the exact email you log in with. |
| Red "hydration mismatch" error in the browser mentioning `data-gr-ext-installed` or `fdprocessedid` | A browser extension (Grammarly, a password manager or form filler) changed the page. It's harmless and only shows during development. Test in a private/InPrivate window to avoid it. |
| Webhook returns 401 | The signing key doesn't match. Use the Retell key with the **webhook** badge in `RETELL_WEBHOOK_SECRET` (Vercel too), then redeploy. |
| Dev terminal says "No school has ai_phone_number = +1…" | The AI phone number in **Settings** doesn't match the number Retell answered on. Fix it in Settings. |
| Dev terminal says "DRY RUN" | `SUPABASE_SERVICE_ROLE_KEY` or the URL is missing or a placeholder. |
| Lead saved but no texts | `MOCK_SMS=true` (check the logs for MOCK SMS boxes), or Twilio isn't set up (look for `[sms] Failed`), or the school has no **Admin phone**. On a Twilio trial, the receiving number must be verified. |
| Twilio error 21608 / 21614 | Trial account sending to an unverified number / not a mobile number. |
| Texts arrive with "Sent from your Twilio trial account" | Upgrade the Twilio account. |
| Real calls don't create leads | Check: Retell webhook URL is your **Vercel** URL (not localhost), the agent has the **Post-Call Analysis** fields, and Vercel → **Logs** shows `call_analyzed`. The webhook only acts on `call_analyzed`, which arrives ~30–60 s after the call. |
| Fields like licence or package are empty | The Post-Call Analysis field **names** in Retell must match exactly (`licence_level`, not `license_level`). |
| The "caller" texts go to the school's own phone | The carrier replaced the caller ID when forwarding. Ask the phone provider to "pass through original caller ID" on forwarded calls. |
| Weekly report never arrives | `CRON_SECRET` must be set in Vercel. Cron only runs on the **production** deployment. Check Vercel → **Settings → Cron Jobs**. Test with `?force=1` (section 3). |
| `npm run build` fails after changes | Read the first red error. It names the file and line. |
| Port 3000 already in use | Another `npm run dev` is still running. Close that window, or run `npx next dev -p 3001`. |

---

## 6. Suggested next features after the pilot

1. **Callback reminders**: text the admin again if a lead is still "New" after 2 hours.
2. **Notes on a lead** (e.g. "left voicemail") and a "who called back" field.
3. **Data retention**: auto-delete transcripts and recordings after N days (PIPEDA), and a "delete this caller's data" button.
4. **Download recordings to Canadian storage** (Supabase Storage) so they don't depend on Retell links.
5. **Multi-school switcher** for owners with several locations, and inviting extra admins by email.
6. **Live "open now" awareness**: pass the current Toronto time to Retell as a dynamic variable so the agent knows if the office is open.
7. **French and Punjabi/Hindi agents** for Ontario's multilingual callers.
8. **Spam/robocall filter**: skip texts for very short calls with no details.
9. **Weekly report email/PDF** with a chart and the list of booked students.
10. **Automated tests** for the webhook, text wording and week math, run on every GitHub push.
11. Later (currently out of scope): calendar booking links, payments.
