import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import { useModalStore } from "@/lib/store";
import { format } from "date-fns";
import type { Trip, Expense } from "@shared/schema"; // Import types
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import SummaryCard from "@/components/cards/summary-card";
import ExpenseChart from "@/components/charts/expense-chart";
import ExpenseTrendChart from "@/components/charts/expense-trend-chart";
import TripCard from "@/components/cards/trip-card";
import AddExpenseModal from "@/components/modals/add-expense-modal";
import AddTripModal from "@/components/modals/add-trip-modal";
import ReceiptViewerModal from "@/components/modals/receipt-viewer-modal";
import AnimatedPage from "@/components/animated-page"; // Import the wrapper

export default function DashboardPage() {
  const { toggleAddTrip } = useModalStore();

  // Fetch expenses and type the data
  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  // Fetch trips and type the data
  const { data: trips, isLoading: tripsLoading } = useQuery<Trip[]>({
    queryKey: ["/api/trips"],
  });

  // Calculate totals
  const totals = {
    trips: trips?.length || 0,
    expenses: expenses?.length || 0,
    // Ensure cost is treated as number for reduction
    spent: expenses ? expenses.reduce((sum: number, expense: Expense) => sum + (typeof expense.cost === 'number' ? expense.cost : parseFloat(expense.cost)), 0).toFixed(2) : "0.00",
    receipts: expenses ? expenses.filter((expense: Expense) => expense.receiptPath).length : 0
  };

  // Get recent expenses and trips (ensure data exists before slicing)
  const recentExpenses = expenses ? expenses.slice(0, 4) : [];
  const recentTrips = trips ? trips.slice(0, 3) : [];
  
  // Prepare data for charts
  const expensesByCategory = expenses
    ? expenses.reduce((acc: Record<string, number>, expense: Expense) => {
        // Ensure cost is treated as number
        const cost = typeof expense.cost === 'number' ? expense.cost : parseFloat(expense.cost);
        acc[expense.type] = (acc[expense.type] || 0) + cost;
        return acc;
      }, {})
    : {};
    
  // Generate trend data
  const trendDataMap = expenses
    ? expenses.reduce((acc: Record<string, number>, expense: Expense) => {
        const month = format(new Date(expense.date), 'MMM');
        // Ensure cost is treated as number
        const cost = typeof expense.cost === 'number' ? expense.cost : parseFloat(expense.cost);
        acc[month] = (acc[month] || 0) + cost;
        return acc;
      }, {})
    : {};
    
  const trendData = {
    labels: Object.keys(trendDataMap),
    data: Object.values(trendDataMap)
  };

  const isLoading = expensesLoading || tripsLoading;

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <Sidebar />
      
      {/* Main Content */}
      {/* Wrap main content area with AnimatedPage */}
      <AnimatedPage className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Removed the extra <main> tag, AnimatedPage acts as the main container now */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
          <h1 className="text-2xl font-bold mb-2 md:mb-0">Dashboard</h1>

          <div className="flex flex-wrap gap-2">
            {/* Use primary button styling */}
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={toggleAddTrip}>
              <PlusIcon className="h-4 w-4 mr-2" /> Add Trip
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            title="Total Trips"
            value={totals.trips.toString()}
            icon="ri-suitcase-line"
            color="primary"
          />

          <SummaryCard
            title="Total Expenses"
            value={totals.expenses.toString()}
            icon="ri-receipt-line"
            color="secondary"
          />

          <SummaryCard
            title="Total Spent"
            value={`$${totals.spent}`}
            icon="ri-money-dollar-circle-line"
            color="error"
          />

          <SummaryCard
            title="Receipts Processed"
            value={totals.receipts.toString()}
            icon="ri-file-list-3-line"
            color="accent"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1">
            <ExpenseChart expenseData={expensesByCategory} isLoading={isLoading} />
          </div>

          <div className="col-span-2">
            <ExpenseTrendChart trendData={trendData} isLoading={isLoading} />
          </div>
        </div>

        {/* Recent Expenses and Trips */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Recent Expenses */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Recent Expenses</h3>
              <Button variant="link" className="text-primary hover:underline text-sm font-medium p-0" asChild>
                <a href="/expenses">View All</a>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-3 px-2 text-xs uppercase text-gray-500 dark:text-gray-400 font-medium">Date</th>
                    <th className="text-left py-3 px-2 text-xs uppercase text-gray-500 dark:text-gray-400 font-medium">Vendor</th>
                    <th className="text-left py-3 px-2 text-xs uppercase text-gray-500 dark:text-gray-400 font-medium">Trip</th>
                    <th className="text-right py-3 px-2 text-xs uppercase text-gray-500 dark:text-gray-400 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-gray-500 dark:text-gray-400">
                        Loading recent expenses...
                      </td>
                    </tr>
                  ) : recentExpenses.length > 0 ? (
                    recentExpenses.map((expense: Expense) => ( // Add Expense type
                      <tr key={expense.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-3 px-2 whitespace-nowrap">
                          {format(new Date(expense.date), 'MMM d, yyyy')}
                        </td>
                        <td className="py-3 px-2 whitespace-nowrap">
                          {expense.vendor}
                        </td>
                        <td className="py-3 px-2 whitespace-nowrap">
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-primary text-xs rounded-full">
                            {expense.tripName}
                          </span>
                        </td>
                        <td className="py-3 px-2 whitespace-nowrap text-right font-medium">
                          ${expense.cost.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-gray-500 dark:text-gray-400">
                        No expenses added yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Trips */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Recent Trips</h3>
              <Button variant="link" className="text-primary hover:underline text-sm font-medium p-0" asChild>
                <a href="/trips">View All</a>
              </Button>
            </div>

            <div className="space-y-4">
              {isLoading ? (
                <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                  Loading recent trips...
                </div>
              ) : recentTrips.length > 0 ? (
                recentTrips.map((trip: Trip) => ( // Add Trip type
                  <TripCard key={trip.id} trip={trip} />
                ))
              ) : (
                <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                  No trips added yet
                </div>
              )}
            </div>
          </div>
        </div>
      </AnimatedPage>
      
      {/* Modals */}
      <AddExpenseModal />
      <AddTripModal />
      <ReceiptViewerModal />
    </div>
  );
}
