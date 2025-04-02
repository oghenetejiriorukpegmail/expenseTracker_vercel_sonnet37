import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useModalStore, useSettingsStore } from "@/lib/store";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ReceiptUpload from "@/components/upload/receipt-upload";
import { Loader2 } from "lucide-react";
import { format } from 'date-fns';
import type { Expense } from "@shared/schema"; // Import Expense type

// Schema generation logic (copied from add-expense-modal, could be refactored)
const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(19|20)\d{2}$/;
const createExpenseSchema = (template: string) => {
  const baseSchema = {
    date: z.string()
      .min(1, { message: "Date is required" })
      .regex(dateRegex, { message: "Date must be in MM/DD/YYYY format" }),
    cost: z.string().min(1, { message: "Amount is required" })
      .refine((val) => !isNaN(parseFloat(val)), { message: "Amount must be a number" })
      .refine((val) => parseFloat(val) > 0, { message: "Amount must be greater than 0" }),
    tripName: z.string().min(1, { message: "Trip is required" }),
    comments: z.string().optional(),
  };

  if (template === 'travel') {
    return z.object({
      ...baseSchema,
      type: z.string().min(1, { message: "Expense type is required" }),
      description: z.string().min(1, { message: "Description/Purpose is required" }),
      vendor: z.string().min(1, { message: "Vendor name is required" }),
      location: z.string().min(1, { message: "Location is required" }),
    });
  } else {
    return z.object({
      ...baseSchema,
      type: z.string().min(1, { message: "Expense type is required" }),
      vendor: z.string().min(1, { message: "Vendor name is required" }),
      location: z.string().min(1, { message: "Location is required" }),
      // Description is part of the base schema now, handled below
    });
  }
};

export default function EditExpenseModal() {
  const { ocrTemplate } = useSettingsStore(); // Get template setting
  const { editExpenseOpen: open, editingExpense, toggleEditExpense } = useModalStore();
  const expenseSchema = createExpenseSchema(ocrTemplate); // Generate schema based on template
  type EditExpenseFormData = z.infer<typeof expenseSchema>;

  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [currentReceiptUrl, setCurrentReceiptUrl] = useState<string | null>(null);

  const form = useForm<EditExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { // Set defaults matching the schema structure
      type: "",
      date: "", 
      vendor: "",
      location: "",
      cost: "",
      tripName: "",
      comments: "",
      // description removed
    },
  });

  // Populate form when modal opens with editingExpense data
  useEffect(() => {
    if (open && editingExpense) {
      // Format date correctly for the input field (MM/DD/YYYY)
      const formattedDate = editingExpense.date ? format(new Date(editingExpense.date), 'MM/dd/yyyy') : '';
      
      form.reset({
        type: editingExpense.type || "",
        date: formattedDate,
        vendor: editingExpense.vendor || "",
        location: editingExpense.location || "",
        cost: String(editingExpense.cost) || "", // Convert cost to string
        tripName: editingExpense.tripName || "",
        comments: editingExpense.comments || "",
        // Description might be in comments for travel, handle appropriately if needed
        // For simplicity, we might just edit comments directly
        // description removed from reset
      });
      // Set the current receipt URL for display/keeping track
      setCurrentReceiptUrl(editingExpense.receiptPath ? `/uploads/${editingExpense.receiptPath}` : null);
      setReceiptFile(null); // Clear any previously selected new file
    } else if (!open) {
      form.reset(); // Clear form on close
      setCurrentReceiptUrl(null);
      setReceiptFile(null);
    }
  }, [open, editingExpense, form]);

  const onSubmit = async (values: EditExpenseFormData) => {
    if (!editingExpense) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      
      // Append all form values
      Object.entries(values).forEach(([key, value]) => {
         // Handle potential null/undefined for optional fields like comments/description
         if (value !== undefined && value !== null) {
             formData.append(key, String(value));
         }
      });
      formData.set('cost', parseFloat(values.cost).toString()); // Ensure cost is string number

      // Append new receipt file if selected
      if (receiptFile) {
        formData.append('receipt', receiptFile);
      } 
      // We don't explicitly handle removing the receipt here, 
      // the backend PUT /api/expenses/:id logic would need adjustment for that.
      // Currently, if no new file is sent, the backend keeps the old path.

      const response = await apiRequest("PUT", `/api/expenses/${editingExpense.id}`, formData); // Ensure correct arguments

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to update expense");
      }

      toggleEditExpense(); // Close modal on success
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] }); // Refetch expenses list
      toast({
        title: "Expense Updated",
        description: "Expense details have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error Updating Expense",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    toggleEditExpense();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
          <DialogDescription>
            Update the details for this expense.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
             {/* Template indicator - Reuse logic from AddExpenseModal */}
             <div className={`p-3 rounded-md border mb-2 ${ocrTemplate === 'travel' ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'}`}>
               <p className={`text-sm font-medium ${ocrTemplate === 'travel' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                 {ocrTemplate === 'travel' ?
                   'Editing Travel Expense' :
                   'Editing General Expense'}
               </p>
             </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Render fields based on template */}
              {ocrTemplate === 'travel' ? (
                <>
                  {/* Trip Name (Text Input) */}
                  <FormField control={form.control} name="tripName" render={({ field }) => (
                      <FormItem className="col-span-2"> <FormLabel>Trip <span className="text-red-500">*</span></FormLabel> <FormControl><Input placeholder="Enter trip name" {...field} /></FormControl> <FormMessage /> </FormItem>
                  )}/>
                  {/* Description (Conditionally Rendered) */}
                  {ocrTemplate === 'travel' && (
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Description/Purpose <span className="text-red-500">*</span></FormLabel>
                          <FormControl><Textarea placeholder="Describe the purpose..." className="min-h-[80px]" {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                    )}/>
                  )}
                  {/* Date */}
                  <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem> <FormLabel>Date <span className="text-red-500">*</span></FormLabel> <FormControl><Input placeholder="MM/DD/YYYY" {...field} /></FormControl> <FormMessage /> </FormItem>
                  )}/>
                  {/* Cost */}
                  <FormField control={form.control} name="cost" render={({ field }) => (
                      <FormItem> <FormLabel>Amount <span className="text-red-500">*</span></FormLabel> <FormControl><div className="relative"><span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400">$</span><Input type="number" step="0.01" className="pl-7" placeholder="0.00" {...field} /></div></FormControl> <FormMessage /> </FormItem>
                  )}/>
                   {/* Type */}
                   <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem> <FormLabel>Expense Type <span className="text-red-500">*</span></FormLabel> <FormControl><Input placeholder="e.g., Food, Transportation" {...field} /></FormControl> <FormMessage /> </FormItem>
                  )}/>
                   {/* Vendor */}
                   <FormField control={form.control} name="vendor" render={({ field }) => (
                      <FormItem> <FormLabel>Vendor <span className="text-red-500">*</span></FormLabel> <FormControl><Input placeholder="Vendor name" {...field} /></FormControl> <FormMessage /> </FormItem>
                  )}/>
                   {/* Location */}
                   <FormField control={form.control} name="location" render={({ field }) => (
                      <FormItem> <FormLabel>Location <span className="text-red-500">*</span></FormLabel> <FormControl><Input placeholder="City, Country" {...field} /></FormControl> <FormMessage /> </FormItem>
                  )}/>
                </>
              ) : (
                 <>
                  {/* Trip Name (Text Input) */}
                  <FormField control={form.control} name="tripName" render={({ field }) => (
                      <FormItem className="col-span-2"> <FormLabel>Trip <span className="text-red-500">*</span></FormLabel> <FormControl><Input placeholder="Enter trip name" {...field} /></FormControl> <FormMessage /> </FormItem>
                  )}/>
                   {/* Type */}
                   <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem> <FormLabel>Expense Type <span className="text-red-500">*</span></FormLabel> <FormControl><Input placeholder="e.g., Food, Transportation" {...field} /></FormControl> <FormMessage /> </FormItem>
                  )}/>
                   {/* Vendor */}
                   <FormField control={form.control} name="vendor" render={({ field }) => (
                      <FormItem> <FormLabel>Vendor <span className="text-red-500">*</span></FormLabel> <FormControl><Input placeholder="Vendor name" {...field} /></FormControl> <FormMessage /> </FormItem>
                  )}/>
                   {/* Location */}
                   <FormField control={form.control} name="location" render={({ field }) => (
                      <FormItem> <FormLabel>Location <span className="text-red-500">*</span></FormLabel> <FormControl><Input placeholder="City, Country" {...field} /></FormControl> <FormMessage /> </FormItem>
                  )}/>
                   {/* Date */}
                  <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem> <FormLabel>Date <span className="text-red-500">*</span></FormLabel> <FormControl><Input placeholder="MM/DD/YYYY" {...field} /></FormControl> <FormMessage /> </FormItem>
                  )}/>
                  {/* Cost */}
                  <FormField control={form.control} name="cost" render={({ field }) => (
                      <FormItem> <FormLabel>Amount <span className="text-red-500">*</span></FormLabel> <FormControl><div className="relative"><span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400">$</span><Input type="number" step="0.01" className="pl-7" placeholder="0.00" {...field} /></div></FormControl> <FormMessage /> </FormItem>
                  )}/>
                 </>
              )}
            </div>

            {/* Comments field - always show for editing */}
            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional details..."
                      className="min-h-[80px]"
                      {...field}
                      value={field.value ?? ''} // Handle null
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <FormLabel>Receipt</FormLabel>
              <ReceiptUpload
                onFileSelect={(file) => setReceiptFile(file)}
                selectedFile={receiptFile}
                currentReceiptUrl={currentReceiptUrl} // Pass current URL to display
              />
              <FormDescription>Upload a new receipt to replace the existing one (if any).</FormDescription>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}