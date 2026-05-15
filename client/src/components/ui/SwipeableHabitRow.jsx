import { useEffect, useRef, useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { useIsTouchDevice } from '../../hooks/useIsTouchDevice';

const REVEAL_WIDTH = 140;

export default function SwipeableHabitRow({ onEdit, onDelete, disabled = false, children }) {
  const isTouch = useIsTouchDevice();
  const [revealed, setRevealed] = useState(false);
  const wrapperRef = useRef(null);

  const enabled = isTouch && !disabled;

  const handlers = useSwipeable({
    onSwipedLeft: () => enabled && setRevealed(true),
    onSwipedRight: () => enabled && setRevealed(false),
    trackTouch: enabled,
    trackMouse: false,
    delta: 80,
    preventScrollOnSwipe: false,
  });

  useEffect(() => {
    if (!revealed) return;
    const onEscape = (e) => { if (e.key === 'Escape') setRevealed(false); };
    const onDocPointer = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setRevealed(false);
      }
    };
    document.addEventListener('keydown', onEscape);
    document.addEventListener('pointerdown', onDocPointer, true);
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.removeEventListener('pointerdown', onDocPointer, true);
    };
  }, [revealed]);

  const refCallback = (el) => {
    wrapperRef.current = el;
    handlers.ref(el);
  };

  if (!enabled) {
    return children;
  }

  return (
    <div className="relative overflow-hidden rounded-xl" {...handlers} ref={refCallback}>
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: REVEAL_WIDTH }}
        aria-hidden={!revealed}
      >
        <button
          type="button"
          onClick={() => { setRevealed(false); onEdit?.(); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-gray-500 text-white text-xs font-medium focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        <button
          type="button"
          onClick={() => { setRevealed(false); onDelete?.(); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-red-500 text-white text-xs font-medium focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
      </div>

      <div
        className="relative transition-transform duration-200 ease-out"
        style={{ transform: revealed ? `translateX(-${REVEAL_WIDTH}px)` : 'translateX(0)' }}
      >
        {children}
      </div>
    </div>
  );
}
