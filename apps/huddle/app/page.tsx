import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarDays,
  Cpu,
  GitBranch,
  Mic,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Users,
} from 'lucide-react';
import {
  getBrandLane,
  getCapacityLane,
  getCodeLane,
  getContentLane,
  getMoneyLane,
  getPerformanceLane,
} from '@/lib/queries';
import { formatCents, formatMoneyFull, timeAgo } from '@/lib/format';

export default async function HuddlePage() {
  const [money, content, code, brand, perf, capacity] = await Promise.all([
    getMoneyLane(),
    getContentLane(),
    getCodeLane(),
    getBrandLane(),
    getPerformanceLane(),
    getCapacityLane(),
  ]);

  const stalledOrFailing =
    money.stalled_count > 0 ||
    code.failing_deploys_24h > 0 ||
    code.dirty_repos > 3 ||
    money.follow_ups_today > 0;

  return (
    <div className="flex flex-col gap-10">
      <Hero
        money={money}
        content={content}
        code={code}
        brand={brand}
        perf={perf}
      />

      {stalledOrFailing && (
        <section className="flex flex-col gap-3">
          <span className="eyebrow">Today, in one line</span>
          <div className="rounded-md border border-amber-mid/40 bg-cream/40 p-4">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-charcoal/85">
              {money.follow_ups_today > 0 && (
                <li>
                  <strong className="font-mono tabular-nums text-amber-deep">
                    {money.follow_ups_today}
                  </strong>{' '}
                  follow-up{money.follow_ups_today === 1 ? '' : 's'} due
                </li>
              )}
              {money.stalled_count > 0 && (
                <li>
                  <strong className="font-mono tabular-nums text-bad">
                    {money.stalled_count}
                  </strong>{' '}
                  stalled lead{money.stalled_count === 1 ? '' : 's'}
                </li>
              )}
              {code.failing_deploys_24h > 0 && (
                <li>
                  <strong className="font-mono tabular-nums text-bad">
                    {code.failing_deploys_24h}
                  </strong>{' '}
                  failing deploy{code.failing_deploys_24h === 1 ? '' : 's'} in 24h
                </li>
              )}
              {code.dirty_repos > 0 && (
                <li>
                  <strong className="font-mono tabular-nums text-amber-deep">
                    {code.dirty_repos}
                  </strong>{' '}
                  dirty repo{code.dirty_repos === 1 ? '' : 's'}
                </li>
              )}
              {content.unbundled_posts > 0 && (
                <li>
                  <strong className="font-mono tabular-nums">{content.unbundled_posts}</strong>{' '}
                  unbundled post{content.unbundled_posts === 1 ? '' : 's'}
                </li>
              )}
            </ul>
          </div>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <MoneyLaneCard money={money} />
        <ContentLaneCard content={content} />
        <CodeLaneCard code={code} />
        <BrandLaneCard brand={brand} />
        <PerformanceLaneCard perf={perf} />
        <PeopleLaneCard rows={capacity} />
      </section>

      <Suite />
    </div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────

function Hero({
  money,
  content,
  code,
  brand,
  perf,
}: {
  money: Awaited<ReturnType<typeof getMoneyLane>>;
  content: Awaited<ReturnType<typeof getContentLane>>;
  code: Awaited<ReturnType<typeof getCodeLane>>;
  brand: Awaited<ReturnType<typeof getBrandLane>>;
  perf: Awaited<ReturnType<typeof getPerformanceLane>>;
}) {
  return (
    <section className="grain relative overflow-hidden rounded-lg border border-green-deep/10 bg-green-deep px-8 py-10 text-cream shadow-card">
      <span aria-hidden className="watermark cream pointer-events-none absolute -bottom-6 right-4 text-[160px] leading-none">
        HUDDLE
      </span>
      <span className="eyebrow cream">The agency, in one screen</span>
      <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-display tracking-display sm:text-5xl">
        Pulse <span className="italic-amber">huddle</span>.
        <span className="mt-1 block font-normal text-cream/75 text-2xl sm:text-3xl">
          Money, content, code, brand, and performance — read together.
        </span>
      </h1>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Pipeline value" value={formatMoneyFull(money.in_pipeline_cents)} accent="amber" />
        <Stat label="Posts due 7d" value={String(content.posts_due_7d)} />
        <Stat label="Open tasks" value={String(code.open_tasks)} />
        <Stat label="LLM runs 7d" value={String(brand.runs_7d)} hint={formatCents(brand.cost_cents_7d)} />
        <Stat label="Recs to review" value={String(perf.recommendations_open)} accent="amber" />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'amber';
}) {
  return (
    <div className="rounded-md border border-cream/10 bg-cream/5 px-4 py-3">
      <div className="text-[10px] uppercase tracking-eyebrow text-cream/55">{label}</div>
      <div
        className={`font-display text-2xl font-bold tabular-nums ${
          accent === 'amber' ? 'italic-amber' : 'text-cream-lt'
        }`}
      >
        {value}
      </div>
      {hint && <div className="font-mono text-[10px] text-cream/55 tabular-nums">{hint}</div>}
    </div>
  );
}

// ─── Lanes ───────────────────────────────────────────────────────────────

function LaneCard({
  eyebrow,
  title,
  icon,
  href,
  children,
  hrefLabel = 'Open',
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-md border border-cream-dk/60 bg-white p-5 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-amber-deep">
            {icon}
            <span className="text-[10px] font-semibold uppercase tracking-eyebrow">
              {eyebrow}
            </span>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-display text-green-deep">
            {title}
          </h2>
        </div>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[11px] uppercase tracking-eyebrow text-charcoal/55 hover:text-amber-deep"
          >
            {hrefLabel} <ArrowRight size={11} className="inline" />
          </a>
        )}
      </header>
      {children}
    </article>
  );
}

function MoneyLaneCard({ money }: { money: Awaited<ReturnType<typeof getMoneyLane>> }) {
  return (
    <LaneCard
      eyebrow="Money"
      title="Pipeline"
      icon={<Briefcase size={14} />}
      href={process.env.NEXT_PUBLIC_CRM_URL}
      hrefLabel="Open CRM"
    >
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Mini label="New 7d" value={String(money.new_this_week)} />
        <Mini label="In pipeline" value={formatMoneyFull(money.in_pipeline_cents)} />
        <Mini label="Won MTD" value={formatMoneyFull(money.won_mtd_cents)} />
      </div>
      {money.hot_leads.length > 0 ? (
        <ul className="flex flex-col gap-2 text-sm">
          {money.hot_leads.map(l => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-2 rounded-md bg-cream/35 px-3 py-2"
            >
              <span className="min-w-0 truncate">
                <span className="font-semibold text-green-deep">{l.name}</span>
                {l.company && (
                  <span className="text-charcoal/55"> · {l.company}</span>
                )}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-amber-deep">
                {formatMoneyFull(l.value_cents ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No hot deals — go fill the funnel.</Empty>
      )}
    </LaneCard>
  );
}

function ContentLaneCard({ content }: { content: Awaited<ReturnType<typeof getContentLane>> }) {
  return (
    <LaneCard
      eyebrow="Content"
      title="On the wire"
      icon={<CalendarDays size={14} />}
      href={process.env.NEXT_PUBLIC_SOCIAL_URL}
      hrefLabel="Open Social"
    >
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Mini label="Unbundled" value={String(content.unbundled_posts)} />
        <Mini label="Shoots 7d" value={String(content.shoots_next_7d)} />
        <Mini label="Posts 7d" value={String(content.posts_due_7d)} />
      </div>
      {content.notifications.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {content.notifications.slice(0, 5).map(n => (
            <li key={n.id} className="flex items-start gap-2 rounded-md bg-cream/35 px-3 py-2">
              <span
                className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                  n.severity === 'bad'
                    ? 'bg-bad'
                    : n.severity === 'warn'
                    ? 'bg-amber-mid'
                    : 'bg-green-mid'
                }`}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-charcoal/85">{n.title}</span>
              <span className="shrink-0 text-[10px] text-charcoal/45">
                {timeAgo(n.created_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No active notifications. Inbox is clean.</Empty>
      )}
    </LaneCard>
  );
}

function CodeLaneCard({ code }: { code: Awaited<ReturnType<typeof getCodeLane>> }) {
  return (
    <LaneCard
      eyebrow="Code"
      title="Builds &amp; tasks"
      icon={<GitBranch size={14} />}
      href={process.env.NEXT_PUBLIC_DEV_URL}
      hrefLabel="Open Dev"
    >
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Mini label="Dirty repos" value={String(code.dirty_repos)} />
        <Mini label="Failed 24h" value={String(code.failing_deploys_24h)} />
        <Mini label="Open tasks" value={String(code.open_tasks)} />
      </div>
      {code.urgent_tasks.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {code.urgent_tasks.map(t => (
            <li
              key={t.id}
              className="flex items-start gap-2 rounded-md bg-cream/35 px-3 py-2"
            >
              <span className="mt-0.5 inline-block rounded-full bg-bad/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-eyebrow text-bad">
                {t.priority}
              </span>
              <span className="min-w-0 flex-1 text-charcoal/85">
                {t.title}
                {t.project_name && (
                  <span className="text-charcoal/45"> · {t.project_name}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No high-priority tasks. Quiet on the wire.</Empty>
      )}
    </LaneCard>
  );
}

function BrandLaneCard({ brand }: { brand: Awaited<ReturnType<typeof getBrandLane>> }) {
  return (
    <LaneCard
      eyebrow="Brand"
      title="LLM gateway"
      icon={<Mic size={14} />}
      href={process.env.NEXT_PUBLIC_VOICE_URL}
      hrefLabel="Open Voice"
    >
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Mini label="Runs 7d" value={String(brand.runs_7d)} />
        <Mini label="Cost 7d" value={formatCents(brand.cost_cents_7d)} />
        <Mini label="Stale briefs" value={String(brand.stale_brief_clients)} />
      </div>
      {brand.recent_runs.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {brand.recent_runs.map(r => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-md bg-cream/35 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-charcoal/85">
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                  {r.calling_app}
                </span>{' '}
                · {r.template_name ?? r.template_slug ?? 'custom'}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-charcoal/55 tabular-nums">
                {r.status === 'stub' ? 'stub' : formatCents(r.cost_cents ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No LLM runs yet — gateway is idle.</Empty>
      )}
    </LaneCard>
  );
}

function PerformanceLaneCard({ perf }: { perf: Awaited<ReturnType<typeof getPerformanceLane>> }) {
  return (
    <LaneCard
      eyebrow="Performance"
      title="What changed"
      icon={<TrendingDown size={14} />}
      href={process.env.NEXT_PUBLIC_ANALYTICS_URL}
      hrefLabel="Open Analytics"
    >
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Mini label="Insights 7d" value={String(perf.insights_7d)} />
        <Mini label="Posts 7d" value={String(perf.posts_ingested_7d)} />
        <Mini label="Recs open" value={String(perf.recommendations_open)} />
      </div>
      {perf.recent_insight ? (
        <div className="rounded-md bg-cream/35 px-3 py-2 text-sm">
          <div className="text-[10px] uppercase tracking-eyebrow text-amber-deep">
            Latest insight · {perf.recent_insight.client_name ?? 'agency'}
          </div>
          <p className="mt-1 line-clamp-3 text-charcoal/85">
            {perf.recent_insight.body_md.replace(/[#*`]/g, '').trim().slice(0, 220)}…
          </p>
          <div className="mt-1 text-[10px] text-charcoal/45">
            {timeAgo(perf.recent_insight.generated_at)}
          </div>
        </div>
      ) : (
        <Empty>No AI insights yet. Connect analytics to start.</Empty>
      )}
    </LaneCard>
  );
}

function PeopleLaneCard({ rows }: { rows: Awaited<ReturnType<typeof getCapacityLane>> }) {
  const max = Math.max(1, ...rows.map(r => r.total));
  return (
    <LaneCard eyebrow="People" title="Capacity" icon={<Users size={14} />}>
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map(r => {
            const pct = (r.total / max) * 100;
            return (
              <li key={r.person_id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-charcoal/85">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: r.color }}
                      aria-hidden
                    />
                    <span className="font-semibold">{r.name}</span>
                  </span>
                  <span className="font-mono text-xs tabular-nums">
                    {r.total} <span className="text-charcoal/45">open</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-cream/50">
                  <div
                    className="h-full bg-green-mid"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-eyebrow text-charcoal/45">
                  <span>Leads {r.open_leads}</span>
                  <span>Posts {r.open_posts}</span>
                  <span>Shoots {r.open_shoots}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No people on the team yet, or nothing assigned.</Empty>
      )}
    </LaneCard>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-cream/35 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-eyebrow text-charcoal/55">
        {label}
      </div>
      <div className="font-mono text-base font-semibold tabular-nums text-green-deep">
        {value}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-md border border-dashed border-cream-dk/60 bg-cream/20 px-3 py-4 text-center text-xs text-charcoal/55">
      <Sparkles size={14} className="mb-1 text-amber-deep" />
      {children}
    </div>
  );
}

// ─── Suite footer ─────────────────────────────────────────────────────────

function Suite() {
  const apps = [
    { key: 'social', envVar: 'NEXT_PUBLIC_SOCIAL_URL', label: 'Pulse Social', tagline: 'Content production', icon: <CalendarDays size={14} /> },
    { key: 'crm', envVar: 'NEXT_PUBLIC_CRM_URL', label: 'Pulse CRM', tagline: 'Pipeline & follow-ups', icon: <Briefcase size={14} /> },
    { key: 'voice', envVar: 'NEXT_PUBLIC_VOICE_URL', label: 'Pulse Voice', tagline: 'Brand voice + LLM gateway', icon: <Mic size={14} /> },
    { key: 'analytics', envVar: 'NEXT_PUBLIC_ANALYTICS_URL', label: 'Pulse Analytics', tagline: 'Performance + AI advisor', icon: <TrendingDown size={14} /> },
    { key: 'dev', envVar: 'NEXT_PUBLIC_DEV_URL', label: 'Pulse Dev', tagline: 'Software ops & monitor', icon: <Cpu size={14} /> },
  ];
  return (
    <section className="flex flex-col gap-4">
      <span className="eyebrow">Open in another tool</span>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {apps.map(a => {
          const url = (process.env[a.envVar] ?? '').replace(/\/$/, '');
          return (
            <li key={a.key}>
              {url ? (
                <Link
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col gap-1 rounded-md border border-cream-dk/60 bg-white p-3 shadow-sm hover:border-amber-mid/60 hover:shadow-card"
                >
                  <span className="flex items-center gap-1.5 text-amber-deep">
                    {a.icon}
                    <span className="font-display text-sm font-bold text-green-deep">
                      {a.label}
                    </span>
                  </span>
                  <span className="text-[11px] text-charcoal/55">{a.tagline}</span>
                </Link>
              ) : (
                <div className="flex flex-col gap-1 rounded-md border border-dashed border-cream-dk/60 bg-cream/30 p-3 text-charcoal/45">
                  <span className="flex items-center gap-1.5">
                    {a.icon}
                    <span className="font-display text-sm font-bold">{a.label}</span>
                  </span>
                  <span className="text-[11px]">URL not configured.</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-charcoal/45">
        <ShieldCheck size={11} className="mr-1 inline" />
        Read-only. The huddle does not write anywhere — it just shows what
        the other tools already know.
      </p>
    </section>
  );
}
