import { useState, useEffect, useRef } from 'react';
import { getInsights } from '../../api/logApi';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import LoadingSpinner from '../ui/LoadingSpinner';

const WINDOW_DAYS = 60;

function HabitPill({ habit }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
      style={{ backgroundColor: `${habit.color}20`, color: habit.color }}
    >
      <span>{habit.icon}</span>
      <span className="truncate max-w-[10rem]">{habit.name}</span>
    </span>
  );
}

function InsightCard({ insight }) {
  const positive = insight.liftPp >= 0;
  const rateGiven = Math.round(insight.rateGivenDone * 100);
  const rateMissed = Math.round(insight.rateGivenMissed * 100);
  const accent = positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const sign = positive ? '+' : '';

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <HabitPill habit={insight.from} />
        <span className="text-gray-400 dark:text-gray-500" aria-hidden="true">→</span>
        <HabitPill habit={insight.to} />
        <span className={`ml-auto text-lg font-bold ${accent}`}>
          {sign}{insight.liftPp}pp
        </span>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        When you complete <strong>{insight.from.name}</strong>, you also complete{' '}
        <strong>{insight.to.name}</strong>{' '}
        <strong className={accent}>{rateGiven}%</strong> of the time —{' '}
        vs <strong>{rateMissed}%</strong> on days you don't.
      </p>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Based on {insight.overlapDays} days where both habits were scheduled
        ({insight.fromDoneCount} with {insight.from.name} completed,{' '}
        {insight.fromMissedCount} without).
      </p>
    </Card>
  );
}

function Section({ title, subtitle, insights }) {
  if (insights.length === 0) return null;
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>
      <div className="space-y-2">
        {insights.map((insight, idx) => (
          <InsightCard key={`${insight.from._id}-${insight.to._id}-${idx}`} insight={insight} />
        ))}
      </div>
    </div>
  );
}

export default function InsightsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const fetchId = ++fetchIdRef.current;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: res } = await getInsights(WINDOW_DAYS);
        if (fetchId !== fetchIdRef.current) return;
        setData(res.data);
      } catch {
        if (fetchId !== fetchIdRef.current) return;
        setData(null);
      } finally {
        if (fetchId === fetchIdRef.current) setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner />;

  if (!data) {
    return (
      <EmptyState
        icon="📉"
        title="Couldn't load insights"
        description="Try again in a moment."
      />
    );
  }

  if (data.reason === 'need_more_habits') {
    return (
      <EmptyState
        icon="🌱"
        title="Add a couple more habits"
        description="Insights compare pairs of habits — you'll see patterns here once you're tracking at least two."
      />
    );
  }

  if (data.insights.length === 0) {
    return (
      <EmptyState
        icon="🔍"
        title="Not enough signal yet"
        description={`Insights appear when two habits have at least ${data.guards.minOverlapDays} shared scheduled days, ${data.guards.minCompletedDays} in each group, and a difference of ${data.guards.minLiftPp} percentage points. Keep logging and check back in a few days.`}
      />
    );
  }

  const boosters = data.insights.filter((i) => i.liftPp > 0);
  const tradeoffs = data.insights.filter((i) => i.liftPp < 0);

  return (
    <div className="space-y-6">
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Based on the last {data.windowDays} days.
        Showing pairs with at least {data.guards.minLiftPp}pp difference in completion rate.
      </div>

      <Section
        title="Boosters"
        subtitle="When you complete the first habit, you're more likely to complete the second."
        insights={boosters}
      />

      <Section
        title="Trade-offs"
        subtitle="When you complete the first habit, the second tends to slip — worth a look."
        insights={tradeoffs}
      />
    </div>
  );
}
