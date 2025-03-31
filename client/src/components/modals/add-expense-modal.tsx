import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useModalStore } from "@/lib/store";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReceiptUpload from "@/components/upload/receipt-upload";
import { Loader2 } from "lucide-react";

const expenseSchema = z.object({
  type: z.string().min(1, { message: "Expense type is required" }),
  date: z.string().min(1, { message: "Date is required" }),
  vendor: z.string().min(1, { message: "Vendor name is required" }),
  location: z.string().min(1, { message: "Location is required" }),
  cost: z.string().min(1, { message: "Amount is required" })
    .refine((val) => !isNaN(parseFloat(val)), { message: "Amount must be a number" })
    .refine((val) => parseFloat(val) > 0, { message: "Amount must be greater than 0" }),
  tripName: z.string().min(1, { message: "Trip is required" }),
  comments: z.string().optional(),
});

export default function AddExpenseModal() {
  const { addExpenseOpen: open, toggleAddExpense: setOpen } = useModalStore();
  const { toast } = useToast();
  
  // Fetch trips for select dropdown
  const { data: trips, isLoading: isLoadingTrips } = useQuery({
    queryKey: ["/api/trips"],
  });
  
  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      type: "",
      date: new Date().toISOString().split("T")[0],
      vendor: "",
      location: "",
      cost: "",
      tripName: "",
      comments: "",
    },
  });
  
  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      form.reset({
        type: "",
        date: new Date().toISOString().split("T")[0],
        vendor: "",
        location: "",
        cost: "",
        tripName: trips && trips.length > 0 ? trips[0].name : "",
        comments: "",
      });
    }
  }, [open, form, trips]);
  
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
        // Create form data for the receipt
        const formData = new FormData();
        formData.append('receipt', receiptFile);
        
        // Get OCR method from settings or use default
        // In a real app, we might get this from user settings
        formData.append('method', 'gemini'); // Using Google Gemini for OCR
        
        // Make API request to process receipt
        const response = await fetch('/api/ocr/process', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to process receipt');
        }
        
        const result = await response.json();
        console.log('OCR processing result:', result);  // Debug log
        setOcrResult(result);
        
        // Auto-fill form fields if OCR was successful and extracted data
        if (result.success && result.formData) {
          console.log('Setting form values with:', result.formData); // Debug log
          
          // Always populate fields with receipt data
          if (result.formData.date) {
            form.setValue('date', result.formData.date);
          }
          
          if (result.formData.vendor) {
            form.setValue('vendor', result.formData.vendor);
          }
          
          if (result.formData.location) {
            form.setValue('location', result.formData.location);
          }
          
          if (result.formData.cost) {
            form.setValue('cost', result.formData.cost);
          }
          
          if (result.formData.type) {
            form.setValue('type', result.formData.type.toLowerCase());
          }
          
          // If the form has comments field and it's empty, add items from receipt as comments
          if (result.formData.items && Array.isArray(result.formData.items) && result.formData.items.length > 0) {
            const itemsText = result.formData.items
              .map((item: any) => `${item.name || item.description}: ${item.price || ''}`)
              .join('\n');
            
            form.setValue('comments', itemsText);
          }
          
          toast({
            title: "Receipt Processed",
            description: "Form has been filled with data extracted from your receipt.",
          });
          
          // Trigger validation to update UI
          form.trigger();
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
      // Create FormData if there's a receipt file
      const formData = new FormData();
      
      // Add form values to FormData
      Object.entries(values).forEach(([key, value]) => {
        formData.append(key, value);
      });
      
      // Convert cost to a number
      formData.set('cost', parseFloat(values.cost).toString());
      
      // Add receipt file if exists
      if (receiptFile) {
        formData.append('receipt', receiptFile);
      }
      
      // Make API request
      const response = await fetch('/api/expenses', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to add expense');
      }
      
      // Close modal and show success toast
      setOpen();
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      
      toast({
        title: "Expense added",
        description: "Expense has been added successfully",
      });
      
      // Reset form and receipt file
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add New Expense</DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new expense
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expense Type</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="accommodation">Accommodation</SelectItem>
                        <SelectItem value="transportation">Transportation</SelectItem>
                        <SelectItem value="food">Food & Dining</SelectItem>
                        <SelectItem value="entertainment">Entertainment</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
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
              
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
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
              
              <FormField
                control={form.control}
                name="tripName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trip</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select trip" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingTrips ? (
                          <div className="p-2 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading trips...
                          </div>
                        ) : trips && trips.length > 0 ? (
                          trips.map((trip: any) => (
                            <SelectItem key={trip.id} value={trip.name}>
                              {trip.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-center text-sm">
                            No trips available. Please create a trip first.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
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
                onClick={() => setOpen()}
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
