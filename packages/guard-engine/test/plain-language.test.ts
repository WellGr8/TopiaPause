import { DEFAULT_POLICY, SCENE_ORDER, SCENES, buildWhyAnswer, findingDetail, findingTitle, sceneIntent, type Lang, type RuleId } from '@topiapause/shared';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../src';

const BANNED = /พอร์ต|เพดาน|\bagent\b|approval|\bscope\b|คนแก่|ผู้สูงอายุ|elderly|senior/i;
const LANGS: Lang[] = ['th', 'en'];
const RULES: RuleId[] = [
  'SUB_COMMITMENT',
  'SUB_OVER_CAP',
  'STAY_FLEXIBILITY',
  'STAY_HIDDEN_TOTAL',
  'APPROVAL_SCOPE',
  'APPROVAL_EXPIRY',
  'CONC_CAP',
  'INSUFFICIENT_BALANCE',
  'INVALID_INPUT',
  'LOW_CONFIDENCE',
  'UNLOCK_SOON',
  'AGENT_FOLLOWED_UNTRUSTED',
  'FX_UNAVAILABLE',
  'USER_PAYMENT_LIMIT',
  'USER_BLOCK_ANNUAL',
];

describe('reason templates stay in everyday words', () => {
  it('titles do not use the banned words', () => {
    for (const id of RULES) {
      for (const lang of LANGS) expect(findingTitle(id, lang), `${id}/${lang}`).not.toMatch(BANNED);
    }
  });

  it('scene explanations, why-lines, finding text, and the crypto voice line stay plain', () => {
    for (const scene of SCENE_ORDER) {
      for (const lang of LANGS) {
        const preset = SCENES[scene];
        const v = evaluate({ intent: sceneIntent(scene, preset.userText[lang], lang), proposal: preset.buildProposal(), policy: DEFAULT_POLICY, lang });
        expect(v.explanation[lang], `${scene} explanation ${lang}`).not.toMatch(BANNED);
        expect(buildWhyAnswer(v, lang), `${scene} why ${lang}`).not.toMatch(BANNED);
        for (const finding of v.findings) {
          expect(findingDetail(finding, lang), `${scene} ${finding.ruleId} ${lang}`).not.toMatch(BANNED);
        }
        if (scene === 'crypto') expect(v.voiceText[lang], `crypto voice ${lang}`).not.toMatch(BANNED);
      }
    }
  });
});
