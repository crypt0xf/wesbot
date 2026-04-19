import type { SlashCommand } from '../../../types';

import ban from './ban';
import kick from './kick';
import purge from './purge';
import timeout from './timeout';
import unban from './unban';
import untimeout from './untimeout';
import unwarn from './unwarn';
import warn from './warn';
import warns from './warns';

export const moderationCommands: readonly SlashCommand[] = [
  warn,
  unwarn,
  warns,
  kick,
  ban,
  unban,
  timeout,
  untimeout,
  purge,
];
