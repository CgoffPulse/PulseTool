import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { qOne } from '@/lib/db';
import { createBrief } from '@/lib/voice/actions';
import {
  getLatestBriefForClient,
  listBriefVersionsForClient,
} from '@/lib/voice/queries';
import { formatDateTime } from '@/lib/voice/format';

interface Props {
  params: Promise<{ clientId: string }>;
}

interface ClientLite {
  id: string;
  name: string;
  slug: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BriefEditorPage({ params }: Props) {
  const { clientId } = await params;
  const isGlobal = clientId === 'global' || !UUID_RE.test(clientId);

  let client: ClientLite | null = null;
  if (!isGlobal) {
    try {
      client = await qOne<ClientLite>(
        `select id, name, slug from clients where id = $1`,
        [clientId]
      );
    } catch {
      client = null;
    }
  }

  const effectiveClientId = isGlobal ? null : client?.id ?? null;
  const [brief, versions] = await Promise.all([
    effectiveClientId
      ? getLatestBriefForClient(effectiveClientId)
      : qOne(
          `select b.id, b.client_id, b.version, b.body_md, b.do_list, b.dont_list,
                  b.sample_copy, b.updated_by_person_id, b.created_at, b.updated_at,
                  null::text as client_name, null::text as client_slug
             from voice.brand_briefs b
            where b.client_id is null
            order by b.version desc
            limit 1`
        ),
    effectiveClientId
      ? listBriefVersionsForClient(effectiveClientId)
      : Promise.resolve([]),
  ]);

  const title = isGlobal
    ? 'Global voice'
    : client?.name ?? 'Client not found';

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/voice/briefs"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-eyebrow text-charcoal/60 hover:text-amber-deep"
      >
        <ChevronLeft size={14} /> Brand briefs
      </Link>

      <header className="grain relative overflow-hidden rounded-lg border border-green-deep/10 bg-green-deep px-8 py-8 text-cream shadow-card">
        <span
          aria-hidden
          className="watermark cream pointer-events-none absolute -top-6 right-4 text-[140px] leading-none"
        >
          {title.slice(0, 3).toUpperCase()}
        </span>
        <span className="eyebrow cream">
          {isGlobal ? 'Global voice' : 'Brand brief'}
        </span>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-display sm:text-4xl">
          {title}
        </h1>
        {brief && (
          <div className="mt-3 text-sm text-cream/70">
            On <span className="italic-amber">v{brief.version}</span> ·
            updated{' '}
            <span className="italic-amber">
              {formatDateTime(brief.updated_at)}
            </span>
          </div>
        )}
        {!isGlobal && !client && (
          <p className="mt-3 max-w-xl text-sm text-cream/70">
            No client found with that id. You can still write a brief and
            we&apos;ll save it as global. To edit a client brief, navigate from{' '}
            <Link href="/voice/briefs" className="underline">
              the briefs index
            </Link>
            .
          </p>
        )}
      </header>

      <form
        action={createBrief}
        className="flex flex-col gap-5 rounded-md border border-cream-dk/60 bg-white p-6 shadow-sm"
      >
        <input
          type="hidden"
          name="client_id"
          value={effectiveClientId ?? ''}
        />

        <Field label="Body (markdown)" hint="Voice, audience, vibe, signal phrases.">
          <textarea
            name="body_md"
            rows={12}
            defaultValue={brief?.body_md ?? ''}
            className="input font-mono text-xs"
            placeholder="Voice: warm, editorial, confident. Speak in active sentences..."
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Do list" hint="Comma-separated.">
            <textarea
              name="do_list"
              rows={4}
              defaultValue={(brief?.do_list ?? []).join(', ')}
              className="input font-mono text-xs"
              placeholder="lead with a concrete fact, name our team by first name"
            />
          </Field>
          <Field label="Don't list" hint="Comma-separated.">
            <textarea
              name="dont_list"
              rows={4}
              defaultValue={(brief?.dont_list ?? []).join(', ')}
              className="input font-mono text-xs"
              placeholder='unlock, elevate, transform, "we are passionate about"'
            />
          </Field>
        </div>
        <Field label="Sample copy" hint="A real piece in the voice. Optional.">
          <textarea
            name="sample_copy"
            rows={6}
            defaultValue={brief?.sample_copy ?? ''}
            className="input font-mono text-xs"
          />
        </Field>

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-charcoal/55">
            Saving creates v{(brief?.version ?? 0) + 1}. Older versions are
            preserved.
          </p>
          <div className="flex items-center gap-2">
            <Link href="/voice/briefs" className="btn-ghost">
              Cancel
            </Link>
            <button type="submit" className="btn-primary">
              Save new version
            </button>
          </div>
        </div>
      </form>

      {versions.length > 1 && (
        <section className="flex flex-col gap-3">
          <span className="eyebrow">Version history</span>
          <ul className="overflow-hidden rounded-md border border-cream-dk/60 bg-white shadow-sm">
            {versions.map(v => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 border-b border-cream-dk/30 px-4 py-3 text-sm last:border-b-0"
              >
                <span className="font-mono text-xs text-charcoal/65">
                  v{v.version}
                </span>
                <span className="flex-1 truncate text-xs text-charcoal/65">
                  {v.body_md.trim().slice(0, 200)}
                </span>
                <span className="text-[10px] uppercase tracking-eyebrow text-charcoal/45">
                  {formatDateTime(v.updated_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-green-deep">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-charcoal/55">{hint}</span>}
    </label>
  );
}
