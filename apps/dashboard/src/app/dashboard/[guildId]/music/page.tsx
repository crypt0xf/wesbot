import type { Metadata } from 'next';

import { MusicClient } from './music-client';

export const metadata: Metadata = { title: 'Música' };

interface MusicPageProps {
  params: Promise<{ guildId: string }>;
}

export default async function MusicPage({ params }: MusicPageProps) {
  const { guildId } = await params;
  return <MusicClient guildId={guildId} />;
}
