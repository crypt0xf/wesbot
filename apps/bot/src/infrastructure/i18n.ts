import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '@wesbot/shared';

import enUS from '../locales/en-US.json' with { type: 'json' };
import ptBR from '../locales/pt-BR.json' with { type: 'json' };

interface Dict {
  [k: string]: string | Dict;
}

const bundles: Record<SupportedLocale, Dict> = {
  'pt-BR': ptBR,
  'en-US': enUS,
};

function lookup(dict: Dict, path: string[]): string | undefined {
  let cursor: string | Dict = dict;
  for (const segment of path) {
    if (typeof cursor !== 'object') {
      return undefined;
    }
    const next: string | Dict | undefined = cursor[segment];
    if (next === undefined) {
      return undefined;
    }
    cursor = next;
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

function stringify(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value);
    default:
      return JSON.stringify(value) ?? '';
  }
}

function interpolate(template: string, vars: Record<string, unknown> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? `{${key}}` : stringify(value);
  });
}

export class I18n {
  t(locale: SupportedLocale, key: string, vars?: Record<string, unknown>): string {
    const path = key.split('.');
    const hit = lookup(bundles[locale], path) ?? lookup(bundles[DEFAULT_LOCALE], path);
    if (hit === undefined) {
      return key;
    }
    return interpolate(hit, vars);
  }

  /**
   * Returns a discord.js-compatible localization map for every supported
   * locale except the default (which is passed to setDescription directly).
   */
  localizations(key: string): Partial<Record<SupportedLocale, string>> {
    const map: Partial<Record<SupportedLocale, string>> = {};
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === DEFAULT_LOCALE) {
        continue;
      }
      map[locale] = this.t(locale, key);
    }
    return map;
  }

  /** Normalize a Discord interaction locale to a supported one, falling back. */
  resolve(raw: string): SupportedLocale {
    return (SUPPORTED_LOCALES as readonly string[]).includes(raw)
      ? (raw as SupportedLocale)
      : DEFAULT_LOCALE;
  }
}

export const i18n = new I18n();
