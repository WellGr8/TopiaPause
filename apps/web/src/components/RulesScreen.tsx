import { t } from '../copy';
import { useApp } from '../state';
import { RuleRow, RulesEditor } from './RulesEditor';
import { Card, TextButton, Toggle } from './ui';

export function RulesScreen() {
  const { state, dispatch } = useApp();
  const { lang } = state;
  return (
    <div className="mx-auto w-full max-w-xl space-y-8 px-4 pb-8 pt-6">
      <Card>
        <RulesEditor policy={state.policy} lang={lang} extended onChange={(policy) => dispatch({ type: 'policy', policy })} />
      </Card>

      <section aria-labelledby="display">
        <h2 id="display" className="mb-2 px-1 text-sm text-muted">
          {t(lang, 'display')}
        </h2>
        <Card>
          <ul>
            <RuleRow title={t(lang, 'language')}>
              <div className="flex rounded-control border border-line p-0.5" role="group" aria-label={t(lang, 'language')}>
                {(['th', 'en'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={lang === l}
                    onClick={() => dispatch({ type: 'lang', lang: l })}
                    className={`h-10 min-w-14 rounded-control px-3 text-sm font-medium ${lang === l ? 'bg-ink text-canvas' : 'text-muted'}`}
                  >
                    {l === 'th' ? 'ไทย' : 'EN'}
                  </button>
                ))}
              </div>
            </RuleRow>
            <RuleRow title={t(lang, 'darkMode')}>
              <Toggle label={t(lang, 'darkMode')} checked={state.theme === 'dark'} onChange={(v) => dispatch({ type: 'theme', theme: v ? 'dark' : 'light' })} />
            </RuleRow>
          </ul>
        </Card>
      </section>

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted">{t(lang, 'mockNote')}</p>
        <TextButton onClick={() => dispatch({ type: 'reset' })}>{t(lang, 'resetDemo')}</TextButton>
      </div>
    </div>
  );
}
