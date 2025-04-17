import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import TripsPage from "@/pages/trips-page";
import ExpensesPage from "@/pages/expenses-page";
import SettingsPage from "@/pages/settings-page";
import ProfilePage from "@/pages/profile-page"; // Import ProfilePage
import MileageLogsPage from "@/pages/mileage-logs-page"; // Import MileageLogsPage
import EditTripModal from "@/components/modals/edit-trip-modal"; // Import EditTripModal
import EditExpenseModal from "@/components/modals/edit-expense-modal"; // Import EditExpenseModal
import BatchUploadModal from "@/components/modals/batch-upload-modal"; // Import BatchUploadModal
import AddEditMileageLogModal from "@/components/modals/add-edit-mileage-log-modal"; // Import Mileage Log Modal
import { useModalStore } from "./lib/store"; // Import modal store

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/trips" component={TripsPage} />
      <ProtectedRoute path="/expenses" component={ExpensesPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/profile" component={ProfilePage} /> {/* Add Profile route */}
      <ProtectedRoute path="/mileage-logs" component={MileageLogsPage} /> {/* Add Mileage Logs route */}
      {/* Duplicate route removed */}
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Get modal state and toggle function from store
  const {
    addEditMileageLogOpen,
    editingMileageLog,
    mileageLogTripId,
    toggleAddEditMileageLog,
  } = useModalStore();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
        {/* Add EditTripModal alongside other modals */}
        <EditTripModal />
        <EditExpenseModal />
        <BatchUploadModal /> {/* Render BatchUploadModal */}
        {/* Render Mileage Log Modal conditionally */}
        <AddEditMileageLogModal
          isOpen={addEditMileageLogOpen}
          onClose={() => toggleAddEditMileageLog()} // Close modal using toggle function
          mileageLog={editingMileageLog}
          tripId={mileageLogTripId}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
