import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import { useModalStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { PlusIcon, Loader2 } from "lucide-react";
import TripCard from "@/components/cards/trip-card";
import AddTripModal from "@/components/modals/add-trip-modal";
import AddExpenseModal from "@/components/modals/add-expense-modal";
import ReceiptViewerModal from "@/components/modals/receipt-viewer-modal";

export default function TripsPage() {
  const { toggleAddTrip } = useModalStore();
  
  // Fetch trips
  const { data: trips, isLoading } = useQuery({
    queryKey: ["/api/trips"],
  });

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <Sidebar />
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
          <h1 className="text-2xl font-bold mb-2 md:mb-0">Trips</h1>
          
          <Button className="bg-secondary hover:bg-emerald-600" onClick={toggleAddTrip}>
            <PlusIcon className="h-4 w-4 mr-2" /> Add Trip
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {trips?.length > 0 ? (
              trips.map((trip: any) => (
                <TripCard key={trip.id} trip={trip} />
              ))
            ) : (
              <div className="col-span-full text-center p-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                <div className="text-gray-500 dark:text-gray-400 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <h3 className="text-lg font-medium mb-1">No trips yet</h3>
                  <p className="max-w-sm mx-auto mb-5">
                    Create your first trip to start tracking expenses. You can organize expenses by trips for better management.
                  </p>
                  <Button className="bg-secondary hover:bg-emerald-600" onClick={toggleAddTrip}>
                    <PlusIcon className="h-4 w-4 mr-2" /> Create Your First Trip
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* Modals */}
      <AddTripModal />
      <AddExpenseModal />
      <ReceiptViewerModal />
    </div>
  );
}
