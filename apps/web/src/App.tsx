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

  if (!state.onboarded) return <Onboarding />;

  return (
    <FlowProvider>
      <Ambient />
      <div className="relative z-10 flex h-full">
        <Sidebar />
        <div className="flex h-full min-w-0 flex-1 flex-col">
          <Header />
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
