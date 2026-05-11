'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { q, qOne, tx } from '../db';
import { LEAD_HEATS, LEAD_STAGES, TOUCH_KINDS, type LeadStage } from './types';
import { promoteLeadToClient, socialClientUrl } from './social-bridge';
import { resolveNotification, upsertNotification } from './notifications';

const optionalString = z.preprocess(
  v => (v === '' ? null : v),
  z.string().nullable()
);

const optionalCents = z.preprocess(v => {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return Math.round(v);
  if (typeof v === 'string') {
    const cleaned = v.replace(/[$,\s]/g, '');
    const n = parseFloat(cleaned);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  }
  return null;
}, z.number().int().nullable());

const optionalDate = z.preprocess(
  v => (v === '' || v === null || v === undefined ? null : v),
  z.string().nullable()
);

const optionalUuid = z.preprocess(
  v => (v === '' || v === null || v === undefined ? null : v),
  z.string().uuid().nullable()
);

const optionalHeat = z.preprocess(
  v => (v === '' || v === null || v === undefined ? null : v),
  z.enum(LEAD_HEATS as [(typeof LEAD_HEATS)[number], ...typeof LEAD_HEATS]).nullable()
);

/**
 * Form values for the multi-select `services_interested` field — FormData
 * gives us either an array (multiple <select> values) or a single string when
 * one option is chosen. We normalize to a clean string[].
 */
function readServiceLines(formData: FormData): string[] {
  const all = formData.getAll('services_interested');
  return all
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(v => v.length > 0);
}

/**
 * `tags` is captured as a single comma-separated string in the form for UX
 * (tags get added casually as you type). Server splits + trims + dedupes.
 */
function readTags(formData: FormData): string[] {
  const raw = formData.get('tags');
  if (typeof raw !== 'string') return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length <= 32)
    )
  );
}

const LeadProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  company: optionalString,
  email: optionalString,
  phone: optionalString,
  source_id: optionalUuid,
  value_cents: optionalCents,
  expected_close_date: optionalDate,
  owner_person_id: optionalUuid,
  // Business profile
  industry: optionalString,
  business_type: optionalString,
  city: optionalString,
  region: optionalString,
  website_url: optionalString,
  instagram_handle: optionalString,
  facebook_url: optionalString,
  google_business_url: optionalString,
  // Stakeholders
  decision_maker_name: optionalString,
  decision_maker_title: optionalString,
  // Opportunity
  services_interested: z.array(z.string().max(64)).default([]),
  budget_signal: optionalString,
  timeline: optionalString,
  heat: optionalHeat,
  // Discovery
  pain_points: optionalString,
  current_solution: optionalString,
  goals: optionalString,
  referrer: optionalString,
  // Flexible
  tags: z.array(z.string().max(32)).default([]),
  // Free-form
  notes: optionalString,
});

function readLeadProfile(formData: FormData) {
  return LeadProfileSchema.parse({
    name: formData.get('name'),
    company: formData.get('company'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    source_id: formData.get('source_id'),
    value_cents: formData.get('value'),
    expected_close_date: formData.get('expected_close_date'),
    owner_person_id: formData.get('owner_person_id'),
    industry: formData.get('industry'),
    business_type: formData.get('business_type'),
    city: formData.get('city'),
    region: formData.get('region'),
    website_url: formData.get('website_url'),
    instagram_handle: formData.get('instagram_handle'),
    facebook_url: formData.get('facebook_url'),
    google_business_url: formData.get('google_business_url'),
    decision_maker_name: formData.get('decision_maker_name'),
    decision_maker_title: formData.get('decision_maker_title'),
    services_interested: readServiceLines(formData),
    budget_signal: formData.get('budget_signal'),
    timeline: formData.get('timeline'),
    heat: formData.get('heat'),
    pain_points: formData.get('pain_points'),
    current_solution: formData.get('current_solution'),
    goals: formData.get('goals'),
    referrer: formData.get('referrer'),
    tags: readTags(formData),
    notes: formData.get('notes'),
  });
}

export async function createLead(formData: FormData) {
  const p = readLeadProfile(formData);
  const inserted = await qOne<{ id: string }>(
    `insert into crm.leads (
       name, company, email, phone, source_id, value_cents,
       expected_close_date, owner_person_id,
       industry, business_type, city, region,
       website_url, instagram_handle, facebook_url, google_business_url,
       decision_maker_name, decision_maker_title,
       services_interested, budget_signal, timeline, heat,
       pain_points, current_solution, goals, referrer,
       tags, notes
     )
     values (
       $1, $2, $3, $4, $5, $6,
       $7, $8,
       $9, $10, $11, $12,
       $13, $14, $15, $16,
       $17, $18,
       $19, $20, $21, $22::crm.lead_heat,
       $23, $24, $25, $26,
       $27, $28
     )
     returning id`,
    [
      p.name, p.company, p.email, p.phone, p.source_id, p.value_cents,
      p.expected_close_date, p.owner_person_id,
      p.industry, p.business_type, p.city, p.region,
      p.website_url, p.instagram_handle, p.facebook_url, p.google_business_url,
      p.decision_maker_name, p.decision_maker_title,
      p.services_interested, p.budget_signal, p.timeline, p.heat,
      p.pain_points, p.current_solution, p.goals, p.referrer,
      p.tags, p.notes,
    ]
  );
  if (!inserted) throw new Error('Failed to create lead');
  await q(
    `insert into crm.events (lead_id, from_stage, to_stage, note)
     values ($1, null, 'new', 'Created')`,
    [inserted.id]
  );
  revalidatePath('/crm');
  redirect(`/crm/leads/${inserted.id}`);
}

const QuickLeadSchema = z.object({
  name: z.string().min(1).max(200),
  company: optionalString,
  source_id: optionalUuid,
});

export async function createQuickLead(formData: FormData) {
  const parsed = QuickLeadSchema.parse({
    name: formData.get('name'),
    company: formData.get('company'),
    source_id: formData.get('source_id'),
  });
  const inserted = await qOne<{ id: string }>(
    `insert into crm.leads (name, company, source_id)
     values ($1, $2, $3)
     returning id`,
    [parsed.name, parsed.company, parsed.source_id]
  );
  if (!inserted) throw new Error('Failed to create lead');
  await q(
    `insert into crm.events (lead_id, from_stage, to_stage, note)
     values ($1, null, 'new', 'Created')`,
    [inserted.id]
  );
  revalidatePath('/crm');
}

/**
 * Full-profile update. Reuses the new-lead schema + reader so the edit form
 * and the create form stay structurally identical.
 *
 * Behavior: every column in the profile is overwritten with the parsed value
 * (including nulls and empty arrays). The edit form submits the full state of
 * the record, not a diff, so this is intentional — the form IS the truth.
 *
 * `notes` is handled here too, even though the detail page has its own
 * inline NotesForm. Both submit through `updateLead` (the edit page) or
 * through the dedicated notes mutation (still wired).
 */
export async function updateLead(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  const p = readLeadProfile(formData);
  await q(
    `update crm.leads set
        name = $2,
        company = $3,
        email = $4,
        phone = $5,
        source_id = $6,
        value_cents = $7,
        expected_close_date = $8,
        owner_person_id = $9,
        industry = $10,
        business_type = $11,
        city = $12,
        region = $13,
        website_url = $14,
        instagram_handle = $15,
        facebook_url = $16,
        google_business_url = $17,
        decision_maker_name = $18,
        decision_maker_title = $19,
        services_interested = $20,
        budget_signal = $21,
        timeline = $22,
        heat = $23::crm.lead_heat,
        pain_points = $24,
        current_solution = $25,
        goals = $26,
        referrer = $27,
        tags = $28,
        notes = $29
      where id = $1`,
    [
      id,
      p.name, p.company, p.email, p.phone, p.source_id, p.value_cents,
      p.expected_close_date, p.owner_person_id,
      p.industry, p.business_type, p.city, p.region,
      p.website_url, p.instagram_handle, p.facebook_url, p.google_business_url,
      p.decision_maker_name, p.decision_maker_title,
      p.services_interested, p.budget_signal, p.timeline, p.heat,
      p.pain_points, p.current_solution, p.goals, p.referrer,
      p.tags, p.notes,
    ]
  );
  revalidatePath(`/crm/leads/${id}`);
  revalidatePath('/crm');
  redirect(`/crm/leads/${id}`);
}

/**
 * Lightweight notes-only patch — used by the detail page's inline NotesForm
 * so users can update notes without going through the full edit form.
 */
export async function updateLeadNotes(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  const notes = optionalString.parse(formData.get('notes'));
  await q(`update crm.leads set notes = $1 where id = $2`, [notes, id]);
  revalidatePath(`/crm/leads/${id}`);
}

/**
 * Mini-patch: deal value only. The detail page exposes an inline editor
 * for this because it's the single most-edited field on a lead.
 */
export async function updateLeadValue(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  const valueCents = optionalCents.parse(formData.get('value'));
  await q(`update crm.leads set value_cents = $1 where id = $2`, [valueCents, id]);
  revalidatePath(`/crm/leads/${id}`);
  revalidatePath('/crm');
}

/**
 * Mini-patch: heat (cold/warm/hot). One-click change from the detail page.
 */
export async function updateLeadHeat(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  const heat = optionalHeat.parse(formData.get('heat'));
  await q(
    `update crm.leads set heat = $1::crm.lead_heat where id = $2`,
    [heat, id]
  );
  revalidatePath(`/crm/leads/${id}`);
  revalidatePath('/crm');
}

/**
 * Mini-patch: owner (the Pulse-side person who owns the deal).
 */
export async function updateLeadOwner(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  const ownerId = optionalUuid.parse(formData.get('owner_person_id'));
  await q(
    `update crm.leads set owner_person_id = $1 where id = $2`,
    [ownerId, id]
  );
  revalidatePath(`/crm/leads/${id}`);
  revalidatePath('/crm');
}

export async function moveLeadStage(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  const toStage = z.enum(LEAD_STAGES as [LeadStage, ...LeadStage[]]).parse(formData.get('to_stage'));
  const lostReasonId = optionalUuid.parse(formData.get('lost_reason_id') ?? null);
  const note = optionalString.parse(formData.get('note') ?? null);

  if (toStage === 'lost' && !lostReasonId) {
    throw new Error('A lost reason is required when moving a lead to "lost".');
  }

  const lead = await qOne<{ stage: LeadStage }>(
    `select stage::text as stage from crm.leads where id = $1`,
    [id]
  );
  if (!lead) throw new Error('Lead not found');

  await tx(async c => {
    await c.query(
      `update crm.leads
          set stage = $1::crm.lead_stage,
              lost_reason_id = case when $1 = 'lost' then $2 else null end
        where id = $3`,
      [toStage, lostReasonId, id]
    );
    await c.query(
      `insert into crm.events (lead_id, from_stage, to_stage, note)
       values ($1, $2::crm.lead_stage, $3::crm.lead_stage, $4)`,
      [id, lead.stage, toStage, note]
    );
  });

  // Resolve any stalled-lead bell when the lead moves out of an active state.
  if (toStage === 'won' || toStage === 'lost') {
    await resolveNotification(`crm-stalled-${id}`);
  }

  revalidatePath(`/crm/leads/${id}`);
  revalidatePath('/crm');
}

const TouchSchema = z.object({
  lead_id: z.string().uuid(),
  kind: z.enum(TOUCH_KINDS as [(typeof TOUCH_KINDS)[number], ...typeof TOUCH_KINDS]),
  summary: optionalString,
  follow_up_at: optionalDate,
  person_id: optionalUuid,
});

export async function logTouch(formData: FormData) {
  const parsed = TouchSchema.parse({
    lead_id: formData.get('lead_id'),
    kind: formData.get('kind'),
    summary: formData.get('summary'),
    follow_up_at: formData.get('follow_up_at'),
    person_id: formData.get('person_id'),
  });
  await q(
    `insert into crm.touches (lead_id, kind, summary, follow_up_at, person_id)
     values ($1, $2::crm.touch_kind, $3, $4::timestamptz, $5)`,
    [parsed.lead_id, parsed.kind, parsed.summary, parsed.follow_up_at, parsed.person_id]
  );
  // Touching a lead clears any outstanding stalled-lead notification.
  await resolveNotification(`crm-stalled-${parsed.lead_id}`);
  revalidatePath(`/crm/leads/${parsed.lead_id}`);
  revalidatePath('/crm/inbox');
  revalidatePath('/crm');
}

export async function archiveLead(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  await q(`update crm.leads set archived = true where id = $1`, [id]);
  await resolveNotification(`crm-stalled-${id}`);
  revalidatePath('/crm');
  redirect('/crm');
}

export async function promoteLead(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  const lead = await qOne<{
    name: string;
    company: string | null;
    client_id: string | null;
    stage: LeadStage;
    value_cents: number | null;
    notes: string | null;
  }>(
    `select name, company, client_id, stage::text as stage,
            value_cents, notes
       from crm.leads where id = $1`,
    [id]
  );
  if (!lead) throw new Error('Lead not found');
  if (lead.client_id) {
    revalidatePath(`/crm/leads/${id}`);
    return;
  }
  // Pass the lead's value + notes into the cascade so it can pick a tier
  // and stamp the brief with provenance. The cascade also writes its own
  // welcome notification (`onboarding:<slug>:welcome`) so we no longer need
  // to upsert one here.
  const promoted = await promoteLeadToClient(lead.name, lead.company, {
    valueCents: lead.value_cents,
    notes: lead.notes,
  });
  if (!promoted) {
    throw new Error('Could not create client — is the social tool reachable?');
  }
  await q(`update crm.leads set client_id = $1 where id = $2`, [promoted.id, id]);
  // Keep the legacy CRM-promoted notification too, so the social bell shows
  // the link back into the CRM lead. The cascade's notification covers the
  // strategy team's "new client" surface; this one is for traceability.
  await upsertNotification({
    dedup_key: `crm-promoted-${promoted.id}`,
    title: `New client onboarded: ${promoted.name}`,
    detail: 'Promoted from a CRM lead. Set strategy + cadence next.',
    link_url: socialClientUrl(promoted.slug),
    severity: 'info',
    related_client_id: promoted.id,
  });
  revalidatePath(`/crm/leads/${id}`);
  revalidatePath('/crm');
}

// ─── Sources / Lost reasons CRUD ───────────────────────────────────────────

const TaxonomySchema = z.object({
  label: z.string().min(1).max(80),
  sort_index: z.coerce.number().int().default(50),
});

export async function createSource(formData: FormData) {
  const parsed = TaxonomySchema.parse({
    label: formData.get('label'),
    sort_index: formData.get('sort_index') || 50,
  });
  const slug = parsed.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  await q(
    `insert into crm.sources (slug, label, sort_index)
     values ($1, $2, $3)
     on conflict (slug) do update set label = excluded.label, sort_index = excluded.sort_index, archived = false`,
    [slug, parsed.label, parsed.sort_index]
  );
  revalidatePath('/crm/settings/sources');
}

export async function archiveSource(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  await q(`update crm.sources set archived = true where id = $1`, [id]);
  revalidatePath('/crm/settings/sources');
}

export async function unarchiveSource(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  await q(`update crm.sources set archived = false where id = $1`, [id]);
  revalidatePath('/crm/settings/sources');
}

export async function createLostReason(formData: FormData) {
  const parsed = TaxonomySchema.parse({
    label: formData.get('label'),
    sort_index: formData.get('sort_index') || 50,
  });
  const slug = parsed.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  await q(
    `insert into crm.lost_reasons (slug, label, sort_index)
     values ($1, $2, $3)
     on conflict (slug) do update set label = excluded.label, sort_index = excluded.sort_index, archived = false`,
    [slug, parsed.label, parsed.sort_index]
  );
  revalidatePath('/crm/settings/lost-reasons');
}

export async function archiveLostReason(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  await q(`update crm.lost_reasons set archived = true where id = $1`, [id]);
  revalidatePath('/crm/settings/lost-reasons');
}

export async function unarchiveLostReason(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  await q(`update crm.lost_reasons set archived = false where id = $1`, [id]);
  revalidatePath('/crm/settings/lost-reasons');
}
