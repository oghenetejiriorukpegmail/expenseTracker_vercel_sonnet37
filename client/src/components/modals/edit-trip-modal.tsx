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
import { Loader2 } from "lucide-react";
import { insertTripSchema } from "@shared/schema"; // Use insert schema for validation

// Use the insert schema, but make fields optional for partial updates if needed,
// though for editing, we usually require name.
const editTripFormSchema = insertTripSchema.pick({ name: true, description: true }); 
type EditTripFormData = z.infer<typeof editTripFormSchema>;

export default function EditTripModal() {
  const { editTripOpen: open, editingTrip, toggleEditTrip } = useModalStore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditTripFormData>({
    resolver: zodResolver(editTripFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Populate form when modal opens with editingTrip data
  useEffect(() => {
    if (open && editingTrip) {
      form.reset({
        name: editingTrip.name,
        description: editingTrip.description || "",
      });
    } else if (!open) {
      form.reset({ name: "", description: "" }); // Clear form on close
    }
  }, [open, editingTrip, form]);

  const onSubmit = async (values: EditTripFormData) => {
    if (!editingTrip) return; // Should not happen if modal is open

    setIsSubmitting(true);
    try {
      const response = await apiRequest("PUT", `/api/trips/${editingTrip.id}`, values);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to update trip");
      }

      toggleEditTrip(); // Close modal on success
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] }); // Refetch trips list
      toast({
        title: "Trip Updated",
        description: "Trip details have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error Updating Trip",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle closing without saving
  const handleClose = () => {
    toggleEditTrip(); // Use the store function to close
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Trip</DialogTitle>
          <DialogDescription>
            Update the details for your trip.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trip Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Summer Vacation, Business Conference" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add a short description for this trip"
                      className="min-h-[60px]"
                      {...field}
                      value={field.value ?? ''} // Handle null value
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}