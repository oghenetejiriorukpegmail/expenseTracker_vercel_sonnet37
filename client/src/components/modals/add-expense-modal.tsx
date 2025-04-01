import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useModalStore, useSettingsStore } from "@/lib/store"; // Import useSettingsStore
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
// Select components removed as Trip field is now an Input
import ReceiptUpload from "@/components/upload/receipt-upload";
import { Loader2 } from "lucide-react";
import { format, parse } from 'date-fns'; // Import parse for date handling
import type { Trip } from "@shared/schema"; // Import Trip type

// Regex for mm/dd/yyyy format validation
const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(19|20)\d{2}$/;

// Create a function to generate the schema based on the template
const createExpenseSchema = (template: string) => {
  // Common fields for all templates
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

  // Template-specific fields
  if (template === 'travel') {
    return z.object({
      ...baseSchema,
      // For travel template, type, vendor, and location are now required
      type: z.string().min(1, { message: "Expense type is required" }),
      // Description is required for travel template
      description: z.string().min(1, { message: "Description/Purpose is required" }),
      // Vendor and location are now required for travel expenses
      vendor: z.string().min(1, { message: "Vendor name is required" }),
      location: z.string().min(1, { message: "Location is required" }),
    });
  } else {
    // General template (default)
    return z.object({
      ...baseSchema,
      // Type is required for general expenses
      type: z.string().min(1, { message: "Expense type is required" }),
      // Vendor and location are required for general expenses
      vendor: z.string().min(1, { message: "Vendor name is required" }),
      location: z.string().min(1, { message: "Location is required" }),
      // Description is not used in general template
    });
  }
};

export default function AddExpenseModal() {
  const { ocrMethod, ocrTemplate } = useSettingsStore(); // Get settings from store
  const { addExpenseOpen: open, toggleAddExpense, defaultTripName } = useModalStore(); // Get toggleAddExpense directly
  const setOpen = toggleAddExpense; // Keep alias for button clicks if needed, but use toggleAddExpense for onOpenChange
  
  // Create the schema based on the current template
  const expenseSchema = createExpenseSchema(ocrTemplate);
  const { toast } = useToast();

  // Removed useQuery for fetching trips as it's no longer a dropdown

  // Use type assertion to handle the dynamic schema
  const form = useForm<any>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      type: "",
      date: format(new Date(), 'MM/dd/yyyy'), // Default date to MM/DD/YYYY format
      vendor: "",
      location: "",
      cost: "",
      tripName: "",
      comments: "",
      description: "", // Add description field for travel template
    },
  });

  // Reset form when modal opens or template changes
  useEffect(() => {
    if (open) {
      // Create default values based on template
      const defaultValues = {
        type: "",
        date: format(new Date(), 'MM/dd/yyyy'), // Reset date to MM/DD/YYYY format
        vendor: "",
        location: "",
        cost: "",
        // Use defaultTripName if available, otherwise empty string
        tripName: defaultTripName || "",
        comments: "",
        description: "", // For travel template
      };
      
      form.reset(defaultValues);
    }
  }, [open, form, ocrTemplate, defaultTripName]); // Removed trips dependency

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);

  // Process receipt with OCR when a file is selected
  useEffect(() => {
    async function processReceipt() {
      if (!receiptFile) {
        setOcrResult(null);
        return;
      }

      setIsProcessingReceipt(true);

      try {
        const formData = new FormData();
        formData.append('receipt', receiptFile);
        formData.append('method', ocrMethod); // Use the OCR method from settings
        formData.append('template', ocrTemplate); // Add the OCR template from settings

        const response = await fetch('/api/ocr/process', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to process receipt' }));
          throw new Error(errorData.error || 'Failed to process receipt');
        }

        const result = await response.json();
        console.log('OCR processing result:', result);
        setOcrResult(result);

        if (result.success && result.formData) {
          console.log('Attempting to auto-fill with:', result.formData);

          // Date Field (Handle mm/dd/yyyy)
          if (result.formData.date) {
            let dateToSet = result.formData.date;
            try {
              const genericParsedDate = new Date(result.formData.date);
              if (!isNaN(genericParsedDate.getTime())) {
                 dateToSet = format(genericParsedDate, 'MM/dd/yyyy');
              } else {
                 console.warn(`Could not parse date: ${result.formData.date}. Checking format...`);
                 if (!dateRegex.test(dateToSet)) {
                     console.warn(`Raw date ${dateToSet} does not match MM/DD/YYYY format. Clearing field.`);
                     dateToSet = '';
                 }
              }
            } catch (e) {
              console.error(`Error processing date ${result.formData.date}:`, e);
              if (!dateRegex.test(dateToSet)) {
                 console.warn(`Raw date ${dateToSet} does not match MM/DD/YYYY format after error. Clearing field.`);
                 dateToSet = '';
              }
            }
            console.log(`Setting date field to: ${dateToSet}`);
            form.setValue('date', dateToSet);
          }

          // Cost Field (common to all templates)
          if (result.formData.cost !== undefined && result.formData.cost !== null) {
             form.setValue('cost', String(result.formData.cost));
          } else if (result.formData.total !== undefined && result.formData.total !== null) {
             // Some OCR results use 'total' instead of 'cost'
             form.setValue('cost', String(result.formData.total));
          }

          // Template-specific field handling
          if (ocrTemplate === 'travel') {
            // For travel template, prioritize description/purpose
            if (result.formData.description) {
              form.setValue('description', String(result.formData.description));
            }
            
            // Type is optional but set if available
            if (result.formData.type) {
              form.setValue('type', String(result.formData.type));
            }
            
            // Vendor and location are optional but set if available
            if (result.formData.vendor) {
              form.setValue('vendor', String(result.formData.vendor));
            }
            
            if (result.formData.location) {
              form.setValue('location', String(result.formData.location));
            }
          } else {
            // For general template
            // Vendor Field
            if (result.formData.vendor) {
              form.setValue('vendor', String(result.formData.vendor));
            }

            // Location Field
            if (result.formData.location) {
              form.setValue('location', String(result.formData.location));
            }

            // Type Field (Simple text)
            if (result.formData.type) {
              form.setValue('type', String(result.formData.type));
            }

            // Comments Field (Items)
            if (result.formData.items && Array.isArray(result.formData.items) && result.formData.items.length > 0) {
              const itemsText = result.formData.items
                .map((item: any) => `${item.name || item.description || 'Item'}: ${item.price ?? ''}`)
                .join('\n');
              if (!form.getValues('comments')) {
                form.setValue('comments', itemsText);
              }
            }
          }

          toast({
            title: "Receipt Processed",
            description: "Form fields have been auto-filled.",
          });

          form.trigger();
        } else if (result.error) {
             toast({
                title: "Receipt Processing Info",
                description: result.error,
                variant: "destructive",
             });
        } else {
          toast({
            title: "Receipt Processing Partial",
            description: "Some fields could not be extracted. Please fill them manually.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error processing receipt:', error);
        toast({
          title: "Receipt Processing Failed",
          description: error instanceof Error ? error.message : "Failed to process receipt",
          variant: "destructive",
        });
      } finally {
        setIsProcessingReceipt(false);
      }
    }

    if (receiptFile) {
      processReceipt();
    }
  }, [receiptFile, form, toast]);

  const onSubmit = async (values: z.infer<typeof expenseSchema>) => {
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.set('cost', parseFloat(values.cost).toString());
      if (receiptFile) {
        formData.append('receipt', receiptFile);
      }

      const response = await fetch('/api/expenses', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to add expense');
      }

      setOpen();
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: "Expense added",
        description: "Expense has been added successfully",
      });
      form.reset();
      setReceiptFile(null);
    } catch (error) {
      toast({
        title: "Error adding expense",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpenState) => { if (!newOpenState && open) { toggleAddExpense(); } }}> {/* Call toggleAddExpense directly */}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add New Expense</DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new expense
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Template indicator */}
            <div className={`p-3 rounded-md border mb-2 ${ocrTemplate === 'travel' ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'}`}>
              <p className={`text-sm font-medium ${ocrTemplate === 'travel' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                {ocrTemplate === 'travel' ?
                  'Travel Expense Template - Optimized for business trips and travel expenses' :
                  'General Receipt Template - For standard receipts and expenses'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Template-specific fields */}
              {ocrTemplate === 'travel' ? (
                // Travel template fields
                <>
                  {/* Trip field (now text input) */}
                  <FormField
                    control={form.control}
                    name="tripName"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="font-medium">Trip <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Enter trip name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Description field (required for travel) */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="font-medium">Description/Purpose <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the purpose of this expense (e.g., Client meeting, Conference attendance)"
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Provide a clear business purpose for this travel expense
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Date and Cost fields in one row */}
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="col-span-2"> {/* className moved to FormItem */}
                        <FormLabel className="font-medium">Date <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="MM/DD/YYYY" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium">Amount <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400">$</span>
                            <Input type="number" step="0.01" className="pl-7" placeholder="0.00" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Type field (optional for travel) */}
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium">Expense Type <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Food, Transportation" {...field} />
                        </FormControl>
                        {/* Removed description as it's now required */}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Vendor field (optional for travel) */}
                  <FormField
                    control={form.control}
                    name="vendor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium">Vendor <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Vendor name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Location field (optional for travel) */}
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium">Location <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="City, Country" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                // General template fields
                <>
                  {/* Type field (required for general) */}
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expense Type</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Food, Transportation" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Vendor field (required for general) */}
                  <FormField
                    control={form.control}
                    name="vendor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor</FormLabel>
                        <FormControl>
                          <Input placeholder="Vendor name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Location field (required for general) */}
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="City, Country" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>

            {/* Comments field - only show for general template or if travel template and not using description */}
            {ocrTemplate !== 'travel' && (
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div>
              <FormLabel>Receipt</FormLabel>
              <div className="relative">
                {isProcessingReceipt && (
                  <div className="absolute inset-0 bg-black/40 rounded-md z-10 flex items-center justify-center">
                    <div className="bg-background p-3 rounded-md flex flex-col items-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                      <p className="text-sm">Processing receipt with AI...</p>
                    </div>
                  </div>
                )}
                <ReceiptUpload
                  onFileSelect={(file) => setReceiptFile(file)}
                  selectedFile={receiptFile}
                />
              </div>
              {ocrResult && ocrResult.success && (
                <div className="mt-2 text-sm text-green-600 dark:text-green-400">
                  Receipt processed successfully. Form fields have been auto-filled.
                </div>
              )}
              {ocrResult && !ocrResult.success && (
                <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {ocrResult.error || "Failed to extract all data from the receipt. Please fill in the missing fields manually."}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => toggleAddExpense()} // Use toggleAddExpense directly for cancel button
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Expense"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
