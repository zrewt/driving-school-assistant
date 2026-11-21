-- =====================================================================
-- Demo data: one school ("Demo Driving School") with packages, FAQs,
-- and 5 sample calls + leads in different statuses.
--
-- Safe to run more than once: it deletes and re-creates the demo school.
-- All phone numbers use the fictional 555-01xx range.
-- Timestamps are relative to now() so the Stats page always has data.
-- =====================================================================

-- Fixed id so you can link your login to it (see SETUP_REPORT.md)
-- Demo school id: 11111111-1111-4111-8111-111111111111

delete from public.schools where id = '11111111-1111-4111-8111-111111111111';

insert into public.schools (id, name, ai_phone_number, admin_phone, owner_phone, timezone, business_hours)
values (
  '11111111-1111-4111-8111-111111111111',
  'Demo Driving School',
  '+14165550100',   -- the AI number (calls to this number belong to this school)
  '+14165550111',   -- admin (gets lead texts)
  '+14165550112',   -- owner (gets weekly report)
  'America/Toronto',
  '{
    "mon": {"closed": false, "open": "09:00", "close": "19:00"},
    "tue": {"closed": false, "open": "09:00", "close": "19:00"},
    "wed": {"closed": false, "open": "09:00", "close": "19:00"},
    "thu": {"closed": false, "open": "09:00", "close": "19:00"},
    "fri": {"closed": false, "open": "09:00", "close": "18:00"},
    "sat": {"closed": false, "open": "10:00", "close": "16:00"},
    "sun": {"closed": true,  "open": "10:00", "close": "16:00"}
  }'::jsonb
);

insert into public.school_info (school_id, packages, faqs, extra_notes)
values (
  '11111111-1111-4111-8111-111111111111',
  '[
    {"name": "BDE Full Course - Package 1", "price": 745,
     "details": "MTO-approved Beginner Driver Education: 20 hours in-class (online or Brampton classroom), 10 hours in-car, 10 hours home study. Certificate filed with MTO."},
    {"name": "BDE Full Course - Package 2", "price": 995,
     "details": "Everything in Package 1, plus car rental for the G2 road test and a 1-hour warm-up lesson right before the test."},
    {"name": "BDE Premium - Package 3", "price": 1075,
     "details": "Everything in Package 2, plus 3 extra in-car lessons (highway and parking practice)."},
    {"name": "Single In-Car Lesson (60 min)", "price": 60,
     "details": "One-on-one lesson with a licensed instructor. Pickup and drop-off included in our service area."},
    {"name": "5-Lesson Bundle", "price": 275,
     "details": "Five 60-minute in-car lessons. Great for G2 test prep or nervous drivers."},
    {"name": "G2 Road Test Car Rental + Warm-Up", "price": 175,
     "details": "Use our dual-brake car for your G2 road test, with a 1-hour warm-up lesson before the test."},
    {"name": "G Road Test Car Rental + Warm-Up", "price": 195,
     "details": "Use our car for your full G road test (includes highway), with a 1-hour warm-up lesson."}
  ]'::jsonb,
  '[
    {"question": "Do I need my G1 before starting the course?",
     "answer": "You need a valid G1 licence to start the in-car lessons. You can start the in-class part before you get your G1."},
    {"question": "How old do I have to be?",
     "answer": "You must be at least 16 years old to get your G1 and take our course."},
    {"question": "Does the BDE course get me an insurance discount?",
     "answer": "Yes. Most insurance companies give a discount once you finish an MTO-approved BDE course. Check with your insurer for the exact amount."},
    {"question": "Can I take my G2 road test sooner with BDE?",
     "answer": "Yes. With a BDE certificate you can take the G2 road test after 8 months with your G1, instead of 12 months."},
    {"question": "Do you pick up students?",
     "answer": "Yes, free pickup and drop-off from home, school or work anywhere in Brampton, Bramalea and north Mississauga."},
    {"question": "Do you offer payment plans?",
     "answer": "Yes, BDE packages can be split into 2 or 3 payments. The office can set it up when they call you back."},
    {"question": "Are the lessons in other languages?",
     "answer": "We have instructors who speak English, Punjabi, Hindi and Urdu. Ask for a preference when booking."},
    {"question": "What is your cancellation policy?",
     "answer": "Please give at least 24 hours notice to cancel or move a lesson, or the lesson may be charged."}
  ]'::jsonb,
  'Office is at 123 Main St N, Brampton. Road tests are usually booked at the Brampton DriveTest centre. Weekend lessons fill up fast.'
);

-- ---------------------------------------------------------------------
-- 5 sample calls and their leads
-- ---------------------------------------------------------------------
with new_calls as (
  insert into public.calls
    (school_id, retell_call_id, from_number, to_number, started_at, duration_seconds, transcript, recording_url, summary, created_at)
  values
    ('11111111-1111-4111-8111-111111111111', 'demo_call_001', '+14165550123', '+14165550100',
     now() - interval '3 hours', 142,
     E'Agent: Hi, thanks for calling Demo Driving School! I''m the school''s assistant. Just so you know, this call may be recorded. How can I help?\nUser: Hi, I just got my G1 and I want to sign up for the full course.\nAgent: Congratulations on your G1! We have three BDE packages. Package 2 is $995 plus HST and includes the car for your G2 road test. Can I get your name?\nUser: Priya Sharma.\nAgent: Thanks Priya. What days and times work best for lessons?\nUser: Weekday evenings. I live near Bramalea City Centre.\nUser: Do you have payment plans?\nAgent: Yes, packages can be split into 2 or 3 payments. Someone from the school will call you back shortly to book.\nUser: Great, thanks!',
     null,
     'Priya just got her G1 and wants the BDE Full Course Package 2. Prefers weekday evenings, lives near Bramalea City Centre. Asked about payment plans.',
     now() - interval '3 hours'),

    ('11111111-1111-4111-8111-111111111111', 'demo_call_002', '+16475550145', '+14165550100',
     now() - interval '1 day 2 hours', 96,
     E'Agent: Hi, thanks for calling Demo Driving School! This call may be recorded. How can I help?\nUser: I have my G2 test next Friday and need a car.\nAgent: We can help with that. Our G2 road test car rental with a warm-up lesson is $175 plus HST. What''s your name?\nUser: Marcus Lee.\nAgent: Thanks Marcus. Someone will call you back shortly to confirm.',
     null,
     'Marcus has his G2 road test next Friday and needs a car rental with a warm-up lesson.',
     now() - interval '1 day 2 hours'),

    ('11111111-1111-4111-8111-111111111111', 'demo_call_003', '+19055550167', '+14165550100',
     now() - interval '2 days 5 hours', 188,
     E'Agent: Hi, thanks for calling Demo Driving School! This call may be recorded. How can I help?\nUser: My daughter had a lesson yesterday and the instructor was 40 minutes late. I want a refund for that lesson.\nAgent: I''m sorry to hear that. I''ll pass this to the owner right away. Can I get your name and best number?\nUser: Angela Russo, this number is fine.\nAgent: Thank you Angela. The owner will call you back.',
     null,
     'Angela Russo is upset that her daughter''s instructor was 40 minutes late and is asking for a refund for that lesson. Needs the owner.',
     now() - interval '2 days 5 hours'),

    ('11111111-1111-4111-8111-111111111111', 'demo_call_004', '+14375550189', '+14165550100',
     now() - interval '8 days', 121,
     E'Agent: Hi, thanks for calling Demo Driving School! This call may be recorded. How can I help?\nUser: How much is a 5-lesson bundle?\nAgent: Our 5-lesson bundle is $275 plus HST. What licence do you have right now?\nUser: G2. I want to practise for my G test. I''m Daniel Okafor.\nAgent: Thanks Daniel. What times work for you?\nUser: Saturday mornings, near Sheridan College Davis campus.\nAgent: Perfect, someone will call you back to book.',
     null,
     'Daniel has his G2 and wants the 5-lesson bundle to prepare for his G test. Saturday mornings, pickup near Sheridan College Davis campus.',
     now() - interval '8 days'),

    ('11111111-1111-4111-8111-111111111111', 'demo_call_005', '+12895550110', '+14165550100',
     now() - interval '9 days 4 hours', 64,
     E'Agent: Hi, thanks for calling Demo Driving School! This call may be recorded. How can I help?\nUser: Just checking prices for the full course for my son.\nAgent: Our BDE packages start at $745 plus HST. Can I get your name?\nUser: Kevin. I''m just shopping around for now.\nAgent: No problem Kevin. Someone can call you back with more details.',
     null,
     'Kevin was price shopping for a BDE course for his son. Not ready to book.',
     now() - interval '9 days 4 hours')
  returning id, retell_call_id, from_number, created_at
)
insert into public.leads
  (school_id, call_id, name, phone, licence_level, package_interest, preferred_times, pickup_area, questions_asked, needs_owner, status, created_at)
select
  '11111111-1111-4111-8111-111111111111',
  c.id, l.name, c.from_number, l.licence_level, l.package_interest, l.preferred_times, l.pickup_area, l.questions_asked, l.needs_owner, l.status, c.created_at
from new_calls c
join (values
  ('demo_call_001', 'Priya Sharma',  'G1',      'BDE Full Course - Package 2',        'Weekday evenings',   'Bramalea City Centre',  'Asked about payment plans',          false, 'new'),
  ('demo_call_002', 'Marcus Lee',    'G2',      'G2 Road Test Car Rental + Warm-Up',  'Before next Friday', 'Downtown Brampton',     'Asked if warm-up is included',       false, 'called_back'),
  ('demo_call_003', 'Angela Russo',  'unknown', null,                                 null,                 null,                    'Wants refund for a late lesson',     true,  'new'),
  ('demo_call_004', 'Daniel Okafor', 'G2',      '5-Lesson Bundle',                    'Saturday mornings',  'Sheridan College Davis','Asked about highway practice',       false, 'booked'),
  ('demo_call_005', 'Kevin',         'none',    'BDE Full Course - Package 1',        null,                 null,                    'Asked for the cheapest BDE price',   false, 'not_interested')
) as l(retell_call_id, name, licence_level, package_interest, preferred_times, pickup_area, questions_asked, needs_owner, status)
  on l.retell_call_id = c.retell_call_id;
