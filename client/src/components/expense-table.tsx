import { useState } from "react";
import { format } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EyeIcon, EditIcon, Trash2Icon, ArrowUpDown } from "lucide-react";
import { useModalStore } from "@/lib/store";

interface Expense {
  id: number;
  date: string;
  type: string;
  vendor: string;
  location: string;
  tripName: string;
  cost: number;
  receiptPath?: string;
}

interface ExpenseTableProps {
  expenses: Expense[];
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function ExpenseTable({ expenses, onEdit, onDelete }: ExpenseTableProps) {
  const { openReceiptViewer } = useModalStore();
  const [sortField, setSortField] = useState<keyof Expense>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  const handleSort = (field: keyof Expense) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };
  
  const sortedExpenses = [...expenses].sort((a, b) => {
    if (sortField === "cost") {
      return sortDirection === "asc" ? a.cost - b.cost : b.cost - a.cost;
    } else if (sortField === "date") {
      return sortDirection === "asc" 
        ? new Date(a.date).getTime() - new Date(b.date).getTime() 
        : new Date(b.date).getTime() - new Date(a.date).getTime();
    } else {
      const aValue = a[sortField as keyof Expense];
      const bValue = b[sortField as keyof Expense];
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      return 0;
    }
  });

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer"
              onClick={() => handleSort("date")}
            >
              <div className="flex items-center">
                Date
                {sortField === "date" && (
                  <ArrowUpDown className={`ml-1 h-3 w-3 ${sortDirection === "asc" ? "transform rotate-180" : ""}`} />
                )}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer"
              onClick={() => handleSort("type")}
            >
              <div className="flex items-center">
                Type
                {sortField === "type" && (
                  <ArrowUpDown className={`ml-1 h-3 w-3 ${sortDirection === "asc" ? "transform rotate-180" : ""}`} />
                )}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer"
              onClick={() => handleSort("vendor")}
            >
              <div className="flex items-center">
                Vendor
                {sortField === "vendor" && (
                  <ArrowUpDown className={`ml-1 h-3 w-3 ${sortDirection === "asc" ? "transform rotate-180" : ""}`} />
                )}
              </div>
            </TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Trip</TableHead>
            <TableHead 
              className="text-right cursor-pointer"
              onClick={() => handleSort("cost")}
            >
              <div className="flex items-center justify-end">
                Amount
                {sortField === "cost" && (
                  <ArrowUpDown className={`ml-1 h-3 w-3 ${sortDirection === "asc" ? "transform rotate-180" : ""}`} />
                )}
              </div>
            </TableHead>
            <TableHead className="text-center">Receipt</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedExpenses.length > 0 ? (
            sortedExpenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>{format(new Date(expense.date), "MMM d, yyyy")}</TableCell>
                <TableCell>{expense.type}</TableCell>
                <TableCell>{expense.vendor}</TableCell>
                <TableCell>{expense.location}</TableCell>
                <TableCell>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-primary text-xs rounded-full">
                    {expense.tripName}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  ${expense.cost.toFixed(2)}
                </TableCell>
                <TableCell className="text-center">
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
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-gray-500 hover:text-primary"
                      onClick={() => onEdit(expense.id)}
                    >
                      <EditIcon className="h-4 w-4" />
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-gray-500 hover:text-red-500"
                      onClick={() => onDelete(expense.id)}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-6 text-gray-500 dark:text-gray-400">
                No expenses found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
