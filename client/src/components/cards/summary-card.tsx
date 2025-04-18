interface SummaryCardProps {
  title: string;
  value: string;
  icon: string;
  color: 'primary' | 'secondary' | 'accent' | 'error';
}

export default function SummaryCard({ title, value, icon, color }: SummaryCardProps) {
  const colorMap = {
    primary: {
      bg: 'bg-primary/10', // Use primary color with opacity
      text: 'text-primary',
    },
    secondary: {
      bg: 'bg-secondary/10', // Use secondary color with opacity
      text: 'text-secondary-foreground', // Use secondary-foreground for text
    },
    accent: {
      bg: 'bg-accent/10', // Use accent color with opacity
      text: 'text-accent-foreground', // Use accent-foreground for text
    },
    error: {
      bg: 'bg-destructive/10', // Use destructive color with opacity
      text: 'text-destructive',
    },
  };

  return (
    <div className="bg-card text-card-foreground p-4 rounded-lg shadow-sm border"> {/* Use semantic colors for card */}
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${colorMap[color].bg} ${colorMap[color].text} mr-4`}>
          <i className={`${icon} text-xl`}></i>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p> {/* Use muted-foreground for title */}
          <h3 className="text-2xl font-bold">{value}</h3>
        </div>
      </div>
    </div>
  );
}
