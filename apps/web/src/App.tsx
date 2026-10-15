import { ActivityScreen } from './components/ActivityScreen';
import { Ambient } from './components/Ambient';
import { ChatScreen } from './components/ChatScreen';
import { Header } from './components/Header';
import { BottomNav, Sidebar } from './components/Nav';
import { Onboarding } from './components/Onboarding';
import { RulesScreen } from './components/RulesScreen';
import { FlowProvider } from './lib/flow';
import { useApp } from './state';

export function App() {
  const { state } = useApp();

  if (state.showLanding) return <Onboarding />;

  const chat = state.screen === 'chat';
  return (
    <FlowProvider>
      <Ambient />
      <div className={chat ? 'relative z-10 flex h-[var(--vv-height,100dvh)] overflow-hidden' : 'relative z-10 flex min-h-dvh'}>
        <Sidebar />
        <div className={chat ? 'flex h-full min-w-0 flex-1 flex-col' : 'flex min-w-0 flex-1 flex-col'}>
          <Header />
          <main className={chat ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'flex flex-1 flex-col'}>
            {chat && <ChatScreen />}
            {state.screen === 'activity' && <ActivityScreen />}
            {state.screen === 'rules' && <RulesScreen />}
          </main>
          <BottomNav />
        </div>
      </div>
    </FlowProvider>
  );
}
