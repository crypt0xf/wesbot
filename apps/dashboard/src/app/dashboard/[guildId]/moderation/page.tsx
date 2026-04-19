import type { Metadata } from 'next';

import { ModerationClient } from './moderation-client';

export const metadata: Metadata = { title: 'Moderação' };

export default async function ModerationPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <ModerationClient guildId={guildId} />;
}
