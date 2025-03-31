import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Chart from "chart.js/auto";

interface ExpenseChartProps {
  expenseData: Record<string, number>;
  isLoading: boolean;
}

export default function ExpenseChart({ expenseData, isLoading }: ExpenseChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  
  useEffect(() => {
    if (isLoading || !chartRef.current) return;
    
    // Destroy previous chart instance if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    const categories = Object.keys(expenseData);
    const values = Object.values(expenseData);
    
    if (categories.length === 0) {
      return;
    }
    
    // Color scheme for the chart
    const colors = [
      '#3b82f6', // primary (blue)
      '#10b981', // secondary (green)
      '#f59e0b', // accent (amber)
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#14b8a6', // teal
      '#6366f1', // indigo
      '#f43f5e', // rose
      '#64748b', // slate
    ];
    
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;
    
    chartInstance.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: categories,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, categories.length),
          borderWidth: 1,
          borderColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#4b5563',
              padding: 15,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw as number;
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = Math.round((value / total) * 100);
                return `${label}: $${value.toFixed(2)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
    
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [expenseData, isLoading]);
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Expense Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : Object.keys(expenseData).length > 0 ? (
          <div className="h-64">
            <canvas ref={chartRef} />
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            No expense data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
