import { useQuery } from '@tanstack/react-query';
import MileageLogTable from '@/components/mileage-log-table';
import type { MileageLog } from '@shared/schema';
import AnimatedPage from '@/components/animated-page'; // Import AnimatedPage

async function fetchMileageLogs(): Promise<MileageLog[]> {
  const res = await fetch('/api/mileage-logs', { credentials: 'include' });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch mileage logs: ${errorText}`);
  }
  return res.json();
}

export default function MileageLogsPage() {
  const { data: logs, isLoading, error } = useQuery<MileageLog[]>({
    queryKey: ['/api/mileage-logs'], // Unique query key
    queryFn: fetchMileageLogs,
  });

  return (
    <AnimatedPage> {/* Wrap content with AnimatedPage */}
      <div className="container mx-auto p-4 md:p-6">
        <h1 className="text-2xl font-semibold mb-4">Mileage Logs</h1>

        {error && (
          <div className="text-red-500 bg-red-100 border border-red-400 rounded p-3 mb-4">
            Error fetching mileage logs: {error.message}
          </div>
        )}

        <MileageLogTable logs={logs || []} isLoading={isLoading} />
      </div>
    </AnimatedPage>
  );
}