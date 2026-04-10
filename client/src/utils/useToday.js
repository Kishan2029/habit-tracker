import { useState, useEffect } from 'react';
import { getLocalDateString } from './dateUtils';

/**
 * Returns today's YYYY-MM-DD string, automatically updating at midnight.
 */
export function useToday() {
  const [today, setToday] = useState(() => getLocalDateString());

  // Re-check date when the tab regains focus (handles sleep/background throttling)
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible') {
        const now = getLocalDateString();
        if (now !== today) setToday(now);
      }
    };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, [today]);

  // Belt-and-suspenders: also schedule a timeout for midnight
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = midnight - now;

    const timer = setTimeout(() => {
      setToday(getLocalDateString());
    }, msUntilMidnight + 500);

    return () => clearTimeout(timer);
  }, [today]);

  return today;
}
