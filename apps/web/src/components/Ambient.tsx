import { useEffect, useRef } from 'react';
import { useApp } from '../state';

/**
 * Living gradient across the top of the screen: soft blurred blobs that drift
 * and morph, fading out by ~20% of the viewport. Colour mood comes from CSS
 * (`:has()` on the guard card's data attributes); this component only adjusts
 * speed and pauses while the tab is hidden. Only transform/opacity animate.
 */
export function Ambient({ variant = 'app' }: { variant?: 'app' | 'landing' }) {
  const { state } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const active = state.chat.some((c) => c.type === 'guard' && c.run.stage !== 'done');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // updatePlaybackRate keeps the current position, so speeding up never jumps.
    for (const a of el.getAnimations({ subtree: true })) a.updatePlaybackRate(active ? 1.6 : 1);
  }, [active]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => el.toggleAttribute('data-paused', document.visibilityState === 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pageshow', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pageshow', sync);
    };
  }, []);

  return (
    <div ref={ref} className="ambient" data-variant={variant} aria-hidden="true">
      <span className="ambient-blob" data-hue="blue" />
      <span className="ambient-blob" data-hue="purple" />
      <span className="ambient-blob" data-hue="rose" />
      <span className="ambient-blob" data-hue="teal" />
    </div>
  );
}
