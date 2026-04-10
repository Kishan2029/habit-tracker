import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CompletionChart({ monthlyStats = [] }) {
  const data = MONTH_NAMES.map((month, index) => {
    const stat = monthlyStats.find((s) => s._id.month === index + 1);
    const rate = stat && stat.totalLogs > 0
      ? Math.round((stat.completedLogs / stat.totalLogs) * 100)
      : 0;
    return { month, completionRate: rate };
  });

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: 'none',
            borderRadius: '8px',
            color: '#f3f4f6',
          }}
          formatter={(value) => [`${value}%`, 'Completion Rate']}
        />
        <Bar dataKey="completionRate" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
