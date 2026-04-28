-- Production Hub upgrade: post status pipeline + per-shoot capture items + asset URL on posts.
-- Idempotent — safe to re-run.

-- ───────────────────────────────────────────────────────────────────────────
-- Post status pipeline:  planned → captured → edited → approved → scheduled → posted
-- We keep the legacy 'ready' value alive (still mapped, never written by new UI).
-- ───────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'captured' and enumtypid = 'post_status'::regtype) then
    alter type post_status add value 'captured' before 'ready';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'edited' and enumtypid = 'post_status'::regtype) then
    alter type post_status add value 'edited' before 'ready';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'approved' and enumtypid = 'post_status'::regtype) then
    alter type post_status add value 'approved' before 'scheduled';
  end if;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Asset URL on each post (link to final deliverable in Drive / DAM / NAS).
-- ───────────────────────────────────────────────────────────────────────────
alter table posts
  add column if not exists asset_url text;

-- ───────────────────────────────────────────────────────────────────────────
-- Capture items: line-by-line checklist per shoot.
-- Required items are seeded from the shoot template's required_capture_list.
-- Extras (is_required = false) are added on site for pivots / bonus content.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists capture_items (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null references shoots(id) on delete cascade,
  label text not null,
  is_required boolean not null default true,
  is_captured boolean not null default false,
  captured_at timestamptz,
  linked_post_id uuid references posts(id) on delete set null,
  notes text,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists capture_items_shoot_idx on capture_items (shoot_id, sort_index);
create index if not exists capture_items_post_idx on capture_items (linked_post_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_capture_items_updated') then
    create trigger trg_capture_items_updated
      before update on capture_items
      for each row execute function set_updated_at();
  end if;
end $$;
