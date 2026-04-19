import type { SlashCommand } from '../../../types';

import autoplay from './autoplay';
import filter from './filter';
import loop from './loop';
import lyrics from './lyrics';
import nowplaying from './nowplaying';
import pause from './pause';
import play from './play';
import playlist from './playlist';
import queue from './queue';
import resume from './resume';
import seek from './seek';
import skip from './skip';
import stop from './stop';
import volume from './volume';
import voteskip from './voteskip';

export const musicCommands: readonly SlashCommand[] = [
  play,
  pause,
  resume,
  skip,
  stop,
  seek,
  volume,
  queue,
  loop,
  nowplaying,
  voteskip,
  filter,
  autoplay,
  playlist,
  lyrics,
];
