import { notFound } from 'next/navigation';
import { getClientBySlug } from '@/lib/queries';

export default async function ClientLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();
  return <>{children}</>;
}
