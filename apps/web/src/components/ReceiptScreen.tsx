import { ArrowLeft } from 'lucide-react';
import { t } from '../copy';
import { useApp } from '../state';
import { ReceiptCard } from './ReceiptCard';
import { Button, Glass } from './ui';

export function ReceiptScreen() {
  const { state, dispatch } = useApp();
  const { lang } = state;
  const entry = state.activity.find((a) => a.receipt && a.receipt.receiptId === state.openReceiptId);
  const back = () => dispatch({ type: 'screen', screen: 'activity' });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-6 pt-2">
      <Button variant="ghost" onClick={back}>
        <ArrowLeft size={18} aria-hidden="true" /> {t(lang, 'back')}
      </Button>
      {entry?.receipt ? (
        <ReceiptCard receipt={entry.receipt} lang={lang} />
      ) : (
        <Glass className="p-6 text-center">
          <p className="text-muted dark:text-slate-300">{t(lang, 'receiptMissing')}</p>
        </Glass>
      )}
    </div>
  );
}
