-- Pulse-as-a-client + ride-along (piggyback) shoots.
-- Pulse is a first-class client so we can plan our own BTS / brand content the
-- same way as customer accounts. Shoots can piggyback on a host shoot — meaning
-- the field crew captures both during the same outing (same time / location).
-- Idempotent — safe to re-run.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Pulse Community Agency as a client
-- ───────────────────────────────────────────────────────────────────────────
insert into clients (slug, name, color)
values ('pulse', 'Pulse Community Agency', '#27452b')
on conflict (slug) do update
  set name = excluded.name,
      color = excluded.color;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Piggyback relationship on shoots
-- A shoot with piggyback_on_shoot_id set is captured AT the host shoot.
-- The field crew sees both required-capture lists during a single outing.
-- ───────────────────────────────────────────────────────────────────────────
alter table shoots
  add column if not exists piggyback_on_shoot_id uuid references shoots(id) on delete set null;

create index if not exists shoots_piggyback_idx on shoots (piggyback_on_shoot_id);

-- Sanity: a shoot can't piggyback on itself.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shoots_no_self_piggyback'
  ) then
    alter table shoots
      add constraint shoots_no_self_piggyback
      check (piggyback_on_shoot_id is null or piggyback_on_shoot_id <> id);
  end if;
end $$;
