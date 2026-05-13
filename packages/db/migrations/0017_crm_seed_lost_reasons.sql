-- 0017_crm_seed_lost_reasons.sql
-- Seeds sensible default lost reasons so the StageControl "Mark lost" picker
-- isn't empty on day one. Without these the dropdown has no options and
-- clicking Confirm-Lost is a no-op (the server requires lost_reason_id
-- whenever a lead moves to 'lost'). Idempotent on slug.

insert into crm.lost_reasons (slug, label, sort_index) values
  ('budget',        'Budget too low',           10),
  ('timing',        'Timing wrong / not now',   20),
  ('went-with',     'Went with a competitor',   30),
  ('ghosted',       'Ghosted / no response',    40),
  ('not-a-fit',     'Not a fit for Pulse',      50),
  ('decision-paused','Decision paused / stalled',60),
  ('other',         'Other',                    99)
on conflict (slug) do nothing;
