import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import { useModalStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import type { Trip, Expense } from "@shared/schema"; // Import types
import AnimatedPage from "@/components/animated-page"; // Import the wrapper
import { 
  PlusIcon, 
  Loader2, 
  ArrowUpDown, 
  Search, 
  FileSpreadsheet,
  EyeIcon,
  EditIcon,
  Trash2Icon
} from "lucide-react";
import { format } from "date-fns";
import AddExpenseModal from "@/components/modals/add-expense-modal";
import AddTripModal from "@/components/modals/add-trip-modal";
import ReceiptViewerModal from "@/components/modals/receipt-viewer-modal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ExpensesPage() {
  const { toggleAddExpense, openReceiptViewer } = useModalStore();
  const { toast } = useToast();
  const [tripFilter, setTripFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Fetch expenses and type the data
  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  // Fetch trips for filter dropdown and type the data
  const { data: trips, isLoading: tripsLoading } = useQuery<Trip[]>({
    queryKey: ["/api/trips"],
  });
  
  const handleExportExpenses = async () => {
    try {
      let url = "/api/export-expenses";
      if (tripFilter !== "all") {
        url += `?tripName=${encodeURIComponent(tripFilter)}`;
      }
      
      const response = await fetch(url, {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Failed to export expenses");
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `expenses-export-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
      
      toast({
        title: "Export successful",
        description: "Your expenses have been exported to Excel.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };
  
  const handleDeleteExpense = async (id: number) => {
    try {
      await apiRequest("DELETE", `/api/expenses/${id}`);
      
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      
      toast({
        title: "Expense deleted",
        description: "The expense has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };
  
  // Filter and sort expenses
  const filteredExpenses = expenses
    ? expenses
        .filter((expense: Expense) => { // Add Expense type
          const matchesTrip = tripFilter === "all" || expense.tripName === tripFilter;
          const matchesSearch = searchQuery === "" || 
            expense.vendor.toLowerCase().includes(searchQuery.toLowerCase()) || 
            expense.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
            expense.type.toLowerCase().includes(searchQuery.toLowerCase());
          return matchesTrip && matchesSearch;
        })
        .sort((a: Expense, b: Expense) => { // Add Expense type
          let comparison = 0;
          
          switch (sortField) {
            case "date":
              comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
              break;
            case "cost":
              comparison = a.cost - b.cost;
              break;
            case "vendor":
              comparison = a.vendor.localeCompare(b.vendor);
              break;
            case "type":
              comparison = a.type.localeCompare(b.type);
              break;
            default:
              comparison = 0;
          }
          
          return sortDirection === "asc" ? comparison : -comparison;
        })
    : [];

  const isLoading = expensesLoading || tripsLoading;

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <Sidebar />
      
      {/* Main Content */}
      <AnimatedPage className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Removed extra <main> tag */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
          <h1 className="text-2xl font-bold mb-2 md:mb-0">Expenses</h1>

          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => toggleAddExpense(tripFilter !== 'all' ? tripFilter : undefined)}
            >
              <PlusIcon className="h-4 w-4 mr-2" /> Add Expense
            </Button>

            <Button variant="outline" onClick={handleExportExpenses}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Export to Excel
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
                <Input
                  placeholder="Search expenses..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Select value={tripFilter} onValueChange={setTripFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by trip" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trips</SelectItem>
                  {trips?.map((trip: Trip) => ( // Add Trip type
                    <SelectItem key={trip.id} value={trip.name}>
                      {trip.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortField} onValueChange={setSortField}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="cost">Amount</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                    <th
                      className="text-left py-3 px-4 font-medium text-xs uppercase text-gray-500 dark:text-gray-400 cursor-pointer"
                      onClick={() => {
                        if (sortField === "date") {
                          setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                        } else {
                          setSortField("date");
                          setSortDirection("desc");
                        }
                      }}
                    >
                      <div className="flex items-center">
                        Date
                        {sortField === "date" && (
                          <ArrowUpDown className={`ml-1 h-3 w-3 ${sortDirection === "asc" ? "transform rotate-180" : ""}`} />
                        )}
                      </div>
                    </th>
                    <th
                      className="text-left py-3 px-4 font-medium text-xs uppercase text-gray-500 dark:text-gray-400 cursor-pointer"
                      onClick={() => {
                        if (sortField === "type") {
                          setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                        } else {
                          setSortField("type");
                          setSortDirection("asc");
                        }
                      }}
                    >
                      <div className="flex items-center">
                        Type
                        {sortField === "type" && (
                          <ArrowUpDown className={`ml-1 h-3 w-3 ${sortDirection === "asc" ? "transform rotate-180" : ""}`} />
                        )}
                      </div>
                    </th>
                    <th
                      className="text-left py-3 px-4 font-medium text-xs uppercase text-gray-500 dark:text-gray-400 cursor-pointer"
                      onClick={() => {
                        if (sortField === "vendor") {
                          setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                        } else {
                          setSortField("vendor");
                          setSortDirection("asc");
                        }
                      }}
                    >
                      <div className="flex items-center">
                        Vendor
                        {sortField === "vendor" && (
                          <ArrowUpDown className={`ml-1 h-3 w-3 ${sortDirection === "asc" ? "transform rotate-180" : ""}`} />
                        )}
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-xs uppercase text-gray-500 dark:text-gray-400">
                      Location
                    </th>
                    {/* Added Comments/Description Column Header */}
                    <th className="text-left py-3 px-4 font-medium text-xs uppercase text-gray-500 dark:text-gray-400">
                      Comments/Desc.
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-xs uppercase text-gray-500 dark:text-gray-400">
                      Trip
                    </th>
                    <th
                      className="text-right py-3 px-4 font-medium text-xs uppercase text-gray-500 dark:text-gray-400 cursor-pointer"
                      onClick={() => {
                        if (sortField === "cost") {
                          setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                        } else {
                          setSortField("cost");
                          setSortDirection("desc");
                        }
                      }}
                    >
                      <div className="flex items-center justify-end">
                        Amount
                        {sortField === "cost" && (
                          <ArrowUpDown className={`ml-1 h-3 w-3 ${sortDirection === "asc" ? "transform rotate-180" : ""}`} />
                        )}
                      </div>
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-xs uppercase text-gray-500 dark:text-gray-400">
                      Receipt
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-xs uppercase text-gray-500 dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length > 0 ? (
                    filteredExpenses.map((expense: Expense) => ( // Add Expense type
                      <tr key={expense.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-3 px-4">
                          {format(new Date(expense.date), "MMM d, yyyy")}
                        </td>
                        <td className="py-3 px-4">
                          {expense.type}
                        </td>
                        <td className="py-3 px-4">
                          {expense.vendor}
                        </td>
                        <td className="py-3 px-4">
                          {expense.location}
                        </td>
                        {/* Added Comments/Description Column Data */}
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={expense.comments || ''}>
                          {expense.comments || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-primary text-xs rounded-full">
                            {expense.tripName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {/* Ensure cost is number before toFixed */}
                          ${(typeof expense.cost === 'number' ? expense.cost : parseFloat(expense.cost)).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {expense.receiptPath ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-500 hover:text-blue-700"
                              onClick={() => openReceiptViewer(`/uploads/${expense.receiptPath}`)}
                            >
                              <EyeIcon className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-gray-400 text-sm">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-500 hover:text-primary"
                              onClick={() => {
                                // Edit logic would be here - would normally open modal with prefilled data
                                toast({
                                  title: "Edit feature",
                                  description: "Edit functionality would be implemented here.",
                                });
                              }}
                            >
                              <EditIcon className="h-4 w-4" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-500 hover:text-red-500"
                                >
                                  <Trash2Icon className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this expense? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-500 hover:bg-red-600"
                                    onClick={() => handleDeleteExpense(expense.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-gray-500 dark:text-gray-400"> {/* Updated colSpan */}
                        {searchQuery || tripFilter !== "all" ? (
                          <>No expenses match your search criteria</>
                        ) : (
                          <>
                            <div className="flex flex-col items-center justify-center py-4">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 10c0 5-3.5 8.5-7 11.5-3.5-3-7-6.5-7-11.5a7 7 0 1114 0z" />
                              </svg>
                              <p className="mb-4">No expenses have been added yet</p>
                              <Button
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={() => toggleAddExpense(tripFilter !== 'all' ? tripFilter : undefined)}
                              >
                                <PlusIcon className="h-4 w-4 mr-2" /> Add Your First Expense
                              </Button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </AnimatedPage>
      
      {/* Modals */}
      <AddExpenseModal />
      <AddTripModal />
      <ReceiptViewerModal />
    </div>
  );
}
