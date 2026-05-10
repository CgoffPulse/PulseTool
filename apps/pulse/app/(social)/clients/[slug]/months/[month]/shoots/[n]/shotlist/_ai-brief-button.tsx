'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AiShootBrief } from '@/components/social/ai-shoot-brief';
import { updateShoot } from '@/lib/social/actions';

export function AiBriefButton({
  shootId,
  clientSlug,
  monthSlug,
  clientId,
  frame,
  captures,
  linkedPosts,
  currentNotes,
}: {
  shootId: string;
  clientSlug: string;
  monthSlug: string;
  clientId?: string | null;
  frame: string;
  captures: string;
  linkedPosts: string;
  currentNotes: string | null;
}) {
  const router = useRouter();
  const [, start] = useTransition();

  return (
    <AiShootBrief
      frame={frame}
      captures={captures}
      linkedPosts={linkedPosts}
      clientId={clientId}
      onAccept={brief => {
        const next = currentNotes && currentNotes.trim().length > 0
          ? `${currentNotes.trim()}\n\n${brief}`
          : brief;
        start(async () => {
          await updateShoot({
            id: shootId,
            client_slug: clientSlug,
            month_slug: monthSlug,
            patch: { notes: next },
          });
          router.refresh();
        });
      }}
    />
  );
}
