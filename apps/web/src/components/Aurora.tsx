import type { Mood } from '../state';

export function Aurora({ mood }: { mood: Mood }) {
  return (
    <div className="aurora" data-mood={mood} aria-hidden="true">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="blob blob-4" />
    </div>
  );
}
