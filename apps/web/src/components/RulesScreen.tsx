import { Info } from 'lucide-react';
import { t } from '../copy';
import { useApp } from '../state';
import { RulesEditor } from './RulesEditor';
import { Button } from './ui';

export function RulesScreen() {
  const { state, dispatch } = useApp();
  const { lang } = state;
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-6 pt-2">
      <div className="px-1">
        <h2 className="text-lg font-bold">{t(lang, 'rulesTitle')}</h2>
        <p className="text-sm text-muted dark:text-slate-300">{t(lang, 'rulesBody')}</p>
      </div>
      <RulesEditor policy={state.policy} lang={lang} onChange={(policy) => dispatch({ type: 'policy', policy })} />
      <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted dark:text-slate-400">
        <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> {t(lang, 'mockNote')}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => dispatch({ type: 'showOnboarding' })}>{t(lang, 'showOnboarding')}</Button>
        <Button onClick={() => dispatch({ type: 'reset' })}>{t(lang, 'resetDemo')}</Button>
      </div>
    </div>
  );
}
