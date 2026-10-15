import { useEffect, useRef } from 'react';
import { useApp } from '../state';

/**
 * Living gradient behind the app: soft blurred blobs anchored at the top and
 * near the composer. Colour mood comes from CSS (`:has()` on the guard card's
 * data attributes); this component only adjusts speed and pauses when hidden.
 * Only transform/opacity animate, so it stays on the compositor.
 */
export function Ambient({ variant = 'app' }: { variant?: 'app' | 'onboarding' }) {
  const { state } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const active = state.chat.some((c) => c.type === 'guard' && c.run.stage !== 'done');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // updatePlaybackRate keeps the current position, so speeding up never jumps.
    for (const a of el.getAnimations({ subtree: true })) a.updatePlaybackRate(active ? 1.7 : 1);
  }, [active]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => el.toggleAttribute('data-paused', document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return (
    <div ref={ref} className="ambient" data-variant={variant} aria-hidden="true">
      <div className="ambient-zone ambient-top">
        <span className="ambient-blob" data-hue="blue" />
        <span className="ambient-blob" data-hue="purple" />
        <span className="ambient-blob" data-hue="rose" />
        <span className="ambient-blob" data-hue="teal" />
      </div>
      <div className="ambient-zone ambient-bottom">
        <span className="ambient-blob" data-hue="purple" />
        <span className="ambient-blob" data-hue="blue" />
        <span className="ambient-blob" data-hue="rose" />
        <span className="ambient-blob" data-hue="teal" />
      </div>
    </div>
  );
}
