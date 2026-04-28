'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { q, qOne, tx } from './db';
import { LEAD_STAGES, TOUCH_KINDS, type LeadStage } from './types';
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

const NewLeadSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  company: optionalString,
  email: optionalString,
  phone: optionalString,
  source_id: optionalUuid,
  value_cents: optionalCents,
  expected_close_date: optionalDate,
  owner_person_id: optionalUuid,
  notes: optionalString,
});

export async function createLead(formData: FormData) {
  const parsed = NewLeadSchema.parse({
    name: formData.get('name'),
    company: formData.get('company'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    source_id: formData.get('source_id'),
    value_cents: formData.get('value'),
    expected_close_date: formData.get('expected_close_date'),
    owner_person_id: formData.get('owner_person_id'),
    notes: formData.get('notes'),
  });
  const inserted = await qOne<{ id: string }>(
    `insert into crm.leads (name, company, email, phone, source_id, value_cents,
                            expected_close_date, owner_person_id, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id`,
    [
      parsed.name,
      parsed.company,
      parsed.email,
      parsed.phone,
      parsed.source_id,
      parsed.value_cents,
      parsed.expected_close_date,
      parsed.owner_person_id,
      parsed.notes,
    ]
  );
  if (!inserted) throw new Error('Failed to create lead');
  await q(
    `insert into crm.events (lead_id, from_stage, to_stage, note)
     values ($1, null, 'new', 'Created')`,
    [inserted.id]
  );
  revalidatePath('/');
  redirect(`/leads/${inserted.id}`);
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
  revalidatePath('/');
}

const UpdateLeadSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  company: optionalString.optional(),
  email: optionalString.optional(),
  phone: optionalString.optional(),
  source_id: optionalUuid.optional(),
  value_cents: optionalCents.optional(),
  expected_close_date: optionalDate.optional(),
  owner_person_id: optionalUuid.optional(),
  notes: optionalString.optional(),
});

export async function updateLead(formData: FormData) {
  const parsed = UpdateLeadSchema.parse({
    id: formData.get('id'),
    name: formData.get('name') ?? undefined,
    company: formData.get('company') ?? undefined,
    email: formData.get('email') ?? undefined,
    phone: formData.get('phone') ?? undefined,
    source_id: formData.get('source_id') ?? undefined,
    value_cents: formData.get('value') ?? undefined,
    expected_close_date: formData.get('expected_close_date') ?? undefined,
    owner_person_id: formData.get('owner_person_id') ?? undefined,
    notes: formData.get('notes') ?? undefined,
  });
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(parsed)) {
    if (k === 'id') continue;
    if (v === undefined) continue;
    sets.push(`${k} = $${i++}`);
    params.push(v);
  }
  if (sets.length === 0) return;
  params.push(parsed.id);
  await q(`update crm.leads set ${sets.join(', ')} where id = $${i}`, params);
  revalidatePath(`/leads/${parsed.id}`);
  revalidatePath('/');
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

  revalidatePath(`/leads/${id}`);
  revalidatePath('/');
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
  revalidatePath(`/leads/${parsed.lead_id}`);
  revalidatePath('/inbox');
  revalidatePath('/');
}

export async function archiveLead(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  await q(`update crm.leads set archived = true where id = $1`, [id]);
  await resolveNotification(`crm-stalled-${id}`);
  revalidatePath('/');
  redirect('/');
}

export async function promoteLead(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  const lead = await qOne<{ name: string; company: string | null; client_id: string | null; stage: LeadStage }>(
    `select name, company, client_id, stage::text as stage
       from crm.leads where id = $1`,
    [id]
  );
  if (!lead) throw new Error('Lead not found');
  if (lead.client_id) {
    revalidatePath(`/leads/${id}`);
    return;
  }
  const promoted = await promoteLeadToClient(lead.name, lead.company);
  if (!promoted) {
    throw new Error('Could not create client — is the social tool reachable?');
  }
  await q(`update crm.leads set client_id = $1 where id = $2`, [promoted.id, id]);
  // Make the social tool aware via notification bell.
  await upsertNotification({
    dedup_key: `crm-promoted-${promoted.id}`,
    title: `New client onboarded: ${promoted.name}`,
    detail: 'Promoted from a CRM lead. Set strategy + cadence next.',
    link_url: socialClientUrl(promoted.slug),
    severity: 'info',
    related_client_id: promoted.id,
  });
  revalidatePath(`/leads/${id}`);
  revalidatePath('/');
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
  revalidatePath('/settings/sources');
}

export async function archiveSource(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  await q(`update crm.sources set archived = true where id = $1`, [id]);
  revalidatePath('/settings/sources');
}

export async function unarchiveSource(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  await q(`update crm.sources set archived = false where id = $1`, [id]);
  revalidatePath('/settings/sources');
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
  revalidatePath('/settings/lost-reasons');
}

export async function archiveLostReason(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  await q(`update crm.lost_reasons set archived = true where id = $1`, [id]);
  revalidatePath('/settings/lost-reasons');
}

export async function unarchiveLostReason(formData: FormData) {
  const id = z.string().uuid().parse(formData.get('id'));
  await q(`update crm.lost_reasons set archived = false where id = $1`, [id]);
  revalidatePath('/settings/lost-reasons');
}
