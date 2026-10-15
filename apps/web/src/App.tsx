import { Aurora } from './components/Aurora';
import { ActivityScreen } from './components/ActivityScreen';
import { ChatScreen } from './components/ChatScreen';
import { Header } from './components/Header';
import { BottomNav, Sidebar } from './components/Nav';
import { Onboarding } from './components/Onboarding';
import { ReceiptScreen } from './components/ReceiptScreen';
import { RulesScreen } from './components/RulesScreen';
import { t } from './copy';
import { FlowProvider } from './lib/flow';
import { moodOf, useApp } from './state';

export function App() {
  const { state } = useApp();
  const mood = moodOf(state);

  if (!state.onboarded) {
    return (
      <>
        <Aurora mood="idle" />
        <Onboarding />
      </>
    );
  }

  return (
    <FlowProvider>
      <Aurora mood={mood} />
      <div className="relative z-10 flex h-full">
        <Sidebar />
        <div className="flex h-full min-w-0 flex-1 flex-col lg:py-3 lg:pr-3">
          {state.screen === 'chat' ? (
            <Header variant="chat" />
          ) : (
            <Header variant="brand" title={t(state.lang, state.screen === 'activity' ? 'activity' : state.screen === 'receipt' ? 'receipt' : 'rulesTitle')} />
          )}
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {state.screen === 'chat' && <ChatScreen />}
            {state.screen === 'activity' && <ActivityScreen />}
            {state.screen === 'rules' && <RulesScreen />}
            {state.screen === 'receipt' && <ReceiptScreen />}
          </main>
          <BottomNav />
        </div>
      </div>
    </FlowProvider>
  );
}
