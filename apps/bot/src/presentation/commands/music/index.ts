import type { SlashCommand } from '../../../types';

import loop from './loop';
import nowplaying from './nowplaying';
import pause from './pause';
import play from './play';
import queue from './queue';
import resume from './resume';
import seek from './seek';
import skip from './skip';
import stop from './stop';
import volume from './volume';

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
];
