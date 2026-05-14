import { useSwipeable } from 'react-swipeable';
import { useIsTouchDevice } from '../../hooks/useIsTouchDevice';

export default function SwipeToToggleRow({ isCompleted, onComplete, onUndo, disabled = false, children }) {
  const isTouch = useIsTouchDevice();
  const enabled = isTouch && !disabled;

  const handlers = useSwipeable({
    onSwipedRight: () => {
      if (!enabled) return;
      if (!isCompleted) onComplete?.();
    },
    onSwipedLeft: () => {
      if (!enabled) return;
      if (isCompleted) onUndo?.();
    },
    trackTouch: enabled,
    trackMouse: false,
    delta: 50,
    preventScrollOnSwipe: false,
  });

  if (!enabled) return children;

  return <div {...handlers}>{children}</div>;
}
