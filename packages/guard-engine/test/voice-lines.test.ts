import { DEFAULT_POLICY, SCENE_ORDER, SCENES, sceneIntent, type Lang } from '@topiapause/shared';
import { describe, expect, it } from 'vitest';
import voiceLines from '../../../demo/voice/voice-lines.json';
import { evaluate } from '../src';

interface Line {
  manifestText?: string;
  display: string;
  spoken: string;
  tagged: string;
  clip_key: string;
  file: string;
}
const lines = voiceLines as unknown as { scenes: Record<string, Record<string, Record<Lang, Line>>> };
const LANGS: Lang[] = ['th', 'en'];

// Pre-generated clips only play when their manifest text equals the engine's voiceText,
// so a drifting catalog or template must fail here instead of silently muting the demo.
describe('demo/voice/voice-lines.json', () => {
  for (const scene of SCENE_ORDER) {
    for (const lang of LANGS) {
      it(`${scene}/${lang}: pause.manifestText equals the engine voiceText under DEFAULT_POLICY`, () => {
        const preset = SCENES[scene];
        const userText = preset.userText[lang];
        const v = evaluate({ intent: sceneIntent(scene, userText, lang), proposal: preset.buildProposal(), policy: DEFAULT_POLICY });
        expect(v.decision).toBe('pause');
        expect(v.voiceText.clipId).toBe(`${scene}-pause`);
        expect(lines.scenes[scene]?.pause?.[lang]?.manifestText).toBe(v.voiceText[lang]);
      });
    }
  }

  it('every line has spoken text and a clip key that matches its file name', () => {
    for (const [scene, byLine] of Object.entries(lines.scenes)) {
      for (const [line, byLang] of Object.entries(byLine)) {
        for (const lang of LANGS) {
          const l = byLang[lang];
          expect(l.spoken.length).toBeGreaterThan(0);
          expect(l.clip_key).toBe(`${scene}-${lang}-${line}`);
          expect(l.file).toBe(`${l.clip_key}.mp3`);
        }
      }
    }
  });
});
