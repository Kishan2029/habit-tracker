import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import DailyAnalytics from './DailyAnalytics';
import MonthlyAnalytics from './MonthlyAnalytics';
import YearlyAnalytics from './YearlyAnalytics';
import InsightsView from './InsightsView';
import ExportButton from './ExportButton';
import { useIsTouchDevice } from '../../hooks/useIsTouchDevice';

const TABS = [
  { key: 'daily', label: 'Daily' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'insights', label: 'Insights' },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('monthly');
  const isTouch = useIsTouchDevice();

  const shiftTab = (delta) => {
    const idx = TABS.findIndex((t) => t.key === activeTab);
    const next = idx + delta;
    if (next < 0 || next >= TABS.length) return;
    setActiveTab(TABS[next].key);
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => shiftTab(1),
    onSwipedRight: () => shiftTab(-1),
    trackTouch: isTouch,
    trackMouse: false,
    delta: 60,
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <ExportButton />
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="transition-opacity duration-200 touch-pan-y" {...swipeHandlers}>
        {activeTab === 'daily' && <DailyAnalytics />}
        {activeTab === 'monthly' && <MonthlyAnalytics />}
        {activeTab === 'yearly' && <YearlyAnalytics />}
        {activeTab === 'insights' && <InsightsView />}
      </div>
    </div>
  );
}
