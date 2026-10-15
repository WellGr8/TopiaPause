import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { t } from './copy';

const lines = JSON.parse(readFileSync(resolve(__dirname, '../../../demo/voice/voice-lines.json'), 'utf8')) as {
  scenes: Record<string, Record<string, Record<'th' | 'en', { manifestText?: string; display: string }>>>;
};

describe('injection voice text', () => {
  it.each(['th', 'en'] as const)('%s copy matches the pregen manifest key, so the clip plays', (lang) => {
    const inj = lines.scenes.injection!;
    expect(t(lang, 'injVoice')).toBe(inj.pause![lang].manifestText);
    expect(t(lang, 'injVoiceNoCounter')).toBe(inj.warning![lang].display);
  });
});
