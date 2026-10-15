import { Aurora } from './components/Aurora';
import { ActivityScreen } from './components/ActivityScreen';
import { ChatScreen } from './components/ChatScreen';
import { Header } from './components/Header';
import { BottomNav, Sidebar } from './components/Nav';
import { Onboarding } from './components/Onboarding';
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
            <Header variant="brand" title={state.screen === 'activity' ? t(state.lang, 'activity') : t(state.lang, 'rulesTitle')} />
          )}
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {state.screen === 'chat' && <ChatScreen />}
            {state.screen === 'activity' && <ActivityScreen />}
            {state.screen === 'rules' && <RulesScreen />}
          </main>
          <BottomNav />
        </div>
      </div>
    </FlowProvider>
  );
}
