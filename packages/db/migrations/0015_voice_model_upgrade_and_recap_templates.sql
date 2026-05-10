-- 0015_voice_model_upgrade_and_recap_templates.sql
-- Bumps default model on every existing voice.prompt_templates row from
-- claude-sonnet-4-5-20250929 → claude-sonnet-4-6, and seeds the recap +
-- follow-up + onboarding templates that the new digest, follow-up, and
-- onboarding crons consume. Idempotent via on conflict (slug) do nothing.

update voice.prompt_templates
   set default_model = 'claude-sonnet-4-6'
 where default_model = 'claude-sonnet-4-5-20250929';

-- ============================================================================
-- Seed templates — internal digests, client recap, follow-ups, onboarding.
-- ============================================================================

insert into voice.prompt_templates (slug, name, description, applies_to, system_md, user_md_template, default_model, version, archived)
values
(
  'digest.weekly_internal',
  'Weekly internal team digest',
  'Monday-morning agency digest summarizing what shipped, what is open, what is blocked, and what is worth noting.',
  'internal',
  'You are a precise, calm chronicler of the agency week. Surface wins, open work, and blockers from the activity log without editorializing. Match the team voice: warm, declarative, never hype-y. Eyebrow headers are caps. No emoji.',
  'Activity log (last 7 days):\n{{activity_log_md}}\n\nWrite a Monday-morning team digest in 4 sections: WHAT SHIPPED · OPEN WORK · BLOCKERS · WORTH NOTING. Use eyebrow headers in caps. 200 words max.',
  'claude-sonnet-4-6',
  1,
  false
),
(
  'digest.monthly_client_recap',
  'Monthly client recap email',
  'Per-client monthly recap email drafted from the activity log + brand brief. Christian approves and sends.',
  'client',
  'You are a clear, brand-true ambassador of Pulse Community Agency to the client. Reference the brand brief. Warmth without sycophancy. Specific over generic. No emoji, no exclamation marks, no "elevate" / "unlock" / "transform".',
  'Brand brief:\n{{brand_brief}}\n\nThis month''s content + performance:\n{{activity_log_md}}\n\nDraft a monthly recap email to the client. Sections: this month at a glance · what landed · what''s queued · one thing to think about. 250 words max. Sign off as the team.',
  'claude-sonnet-4-6',
  1,
  false
),
(
  'followup.shoot_post',
  'Post-shoot 24h follow-up note',
  'Brief, warm, action-oriented post-shoot follow-up sent ~24 hours after the shoot.',
  'client',
  'You write brief, warm, action-oriented post-shoot follow-up notes for a content agency. 4 sentences max. No subject line. Specific reference to what we captured.',
  'Shoot context:\n{{shoot_summary_md}}\n\nClient:\n{{client_name}}\n\nDraft a 4-sentence follow-up note 24 hours after the shoot. Confirm what we captured, ask for any feedback on the day, mention next checkpoint.',
  'claude-sonnet-4-6',
  1,
  false
),
(
  'followup.retainer_renewal',
  'Retainer renewal check-in (T-30)',
  'Renewal-window check-in note 30 days before contract renewal. No pressure, surfaces any change considerations.',
  'client',
  'You write retainer renewal check-in notes for a creative agency 30 days before a contract renews. Calm, no pressure, surfaces any change considerations. 5 sentences max. No subject line.',
  'Client:\n{{client_name}}\n\nMonths in retainer:\n{{months_in}}\n\nDraft a renewal-window check-in (T-30 days). Confirm contract continuation, surface any contract change considerations, no pressure. 5 sentences max.',
  'claude-sonnet-4-6',
  1,
  false
),
(
  'followup.approval_chase',
  'Approval chase note',
  '3-sentence chase note for an artifact awaiting client approval. Friendly, gives them an out.',
  'client',
  'You write friendly, low-pressure chase notes for client approvals at a content agency. 3 sentences. Friendly, gives them an out (request changes is fine), notes the publish window.',
  'Artifact awaiting approval:\n{{artifact_summary_md}}\n\nWaiting since:\n{{waiting_since}}\n\nDraft a 3-sentence chase note. Friendly, gives them an out (request changes is fine), notes the publish window.',
  'claude-sonnet-4-6',
  1,
  false
),
(
  'onboarding.welcome_internal',
  'Internal welcome notification (new client onboarded)',
  'Internal-team announcement bulletin when a new client is onboarded. 4 bullets covering tier, service lines, and the first 7 days of work.',
  'internal',
  'You write internal team announcements for a creative agency. Crisp, declarative, 4 bullets. No greeting, no sign-off. The audience is the internal team only.',
  'New client onboarded:\n{{client_name}} ({{client_tier}})\nService lines: {{service_lines}}\n\nDraft a 4-bullet welcome notification for the internal team announcing the new client and the first 7 days of work.',
  'claude-sonnet-4-6',
  1,
  false
)
on conflict (slug) do nothing;
