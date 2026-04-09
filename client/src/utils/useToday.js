import { useState, useEffect } from 'react';
import { getLocalDateString } from './dateUtils';

/**
 * Returns today's YYYY-MM-DD string, automatically updating at midnight.
 */
export function useToday() {
  const [today, setToday] = useState(() => getLocalDateString());

  useEffect(() => {
    // Calculate ms until next local midnight
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = midnight - now;

    const timer = setTimeout(() => {
      setToday(getLocalDateString());
    }, msUntilMidnight + 500); // small buffer to ensure we're past midnight

    return () => clearTimeout(timer);
  }, [today]); // re-schedule whenever today changes

  return today;
}
