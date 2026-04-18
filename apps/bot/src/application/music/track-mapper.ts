import type { AudioSource, Track } from '@wesbot/shared';
import type { Track as LavalinkTrack } from 'shoukaku';

const SOURCE_MAP: Record<string, AudioSource> = {
  youtube: 'youtube',
  ytsearch: 'youtube',
  youtubemusic: 'youtube_music',
  ytmsearch: 'youtube_music',
  soundcloud: 'soundcloud',
  scsearch: 'soundcloud',
  spotify: 'spotify',
  spsearch: 'spotify',
  applemusic: 'apple_music',
  amsearch: 'apple_music',
  deezer: 'deezer',
  dzsearch: 'deezer',
  bandcamp: 'bandcamp',
  twitch: 'twitch',
  http: 'http',
  local: 'local',
};

function mapSource(sourceName: string): AudioSource {
  return SOURCE_MAP[sourceName.toLowerCase()] ?? 'unknown';
}

/**
 * Convert a Lavalink-emitted Track into our shared domain Track. We use the
 * encoded payload as the identity string so replays stay round-trippable, and
 * tolerate missing URIs by falling back to a data-URI-style identifier.
 */
export function fromLavalinkTrack(raw: LavalinkTrack, requesterId: string | null): Track {
  const info = raw.info;
  return {
    identifier: info.identifier,
    title: info.title || 'Unknown title',
    author: info.author || 'Unknown artist',
    duration: Math.max(0, info.length),
    isStream: info.isStream,
    uri: info.uri ?? `lavalink://${info.identifier}`,
    artworkUrl: info.artworkUrl ?? null,
    isrc: info.isrc ?? null,
    source: mapSource(info.sourceName),
    requesterId,
    encoded: raw.encoded,
  };
}
