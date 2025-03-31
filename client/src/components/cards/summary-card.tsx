interface SummaryCardProps {
  title: string;
  value: string;
  icon: string;
  color: 'primary' | 'secondary' | 'accent' | 'error';
}

export default function SummaryCard({ title, value, icon, color }: SummaryCardProps) {
  const colorMap = {
    primary: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-primary',
    },
    secondary: {
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-secondary',
    },
    accent: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-500',
    },
    error: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-500',
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${colorMap[color].bg} ${colorMap[color].text} mr-4`}>
          <i className={`${icon} text-xl`}></i>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <h3 className="text-2xl font-bold">{value}</h3>
        </div>
      </div>
    </div>
  );
}
