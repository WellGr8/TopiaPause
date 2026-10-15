import type { SceneId } from '@topiapause/shared';

/** Landing is `/`. The app is `/app`, `/app/activity`, and `/app/rules`. `?tab=` is accepted too. */
export type AppScreen = 'chat' | 'activity' | 'rules';
export type AppView = 'landing' | AppScreen;

const SCREENS = new Set<string>(['chat', 'activity', 'rules']);
const SCENES = new Set<string>(['subscription', 'stay', 'crypto']);

export interface ParsedRoute {
  view: AppView;
  /** Present only on the chat URL, so a refresh of rules does not replay a scene. */
  scene?: SceneId;
}

export function parseRoute(pathname: string, search = ''): ParsedRoute {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const sceneRaw = query.get('scene') ?? '';
  const scene = SCENES.has(sceneRaw) ? (sceneRaw as SceneId) : undefined;
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'app') return { view: 'landing' };
  const fromPath = parts[1] ?? '';
  const fromTab = query.get('tab') ?? '';
  const screen: AppScreen = SCREENS.has(fromPath) ? (fromPath as AppScreen) : SCREENS.has(fromTab) ? (fromTab as AppScreen) : 'chat';
  return { view: screen, scene: screen === 'chat' ? scene : undefined };
}

export function hrefFor(view: AppView, scene?: SceneId): string {
  if (view === 'landing') return '/';
  if (view !== 'chat') return `/app/${view}`;
  return scene ? `/app?scene=${scene}` : '/app';
}

export function currentHref(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/** Primary click only. Modified clicks keep the browser's open-in-new-tab behaviour. */
export function isPlainClick(e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number }): boolean {
  return !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0;
}
