import { useEffect, useState, ChangeEvent } from 'react'; // Added useState, ChangeEvent
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, UploadCloud, XCircle, Loader2 } from 'lucide-react'; // Added icons

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
// Import only the final schema for validation before submit
import { insertMileageLogSchema } from '@shared/schema';
import type { MileageLog } from '@shared/schema';

// Define the form schema explicitly for the fields used in the form
const formSchema = z.object({
    tripDate: z.date({ required_error: "Trip date is required." }),
    // Use preprocess for optional number conversion from input
    startOdometer: z.preprocess(
        (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
        z.number({ invalid_type_error: "Start odometer must be a number." })
         .positive('Start odometer must be positive')
         .optional() // Make optional initially, required check happens in final validation
    ),
    endOdometer: z.preprocess(
        (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
        z.number({ invalid_type_error: "End odometer must be a number." })
         .positive('End odometer must be positive')
         .optional() // Make optional initially
    ),
    purpose: z.string().optional(),
    tripId: z.number().int().positive().optional().nullable(),
    // Image URLs are handled via state but included here for form state tracking
    startImageUrl: z.string().url().nullable().optional(),
    endImageUrl: z.string().url().nullable().optional(),
}).refine(data => {
    // Refinement only applies if both values are present and valid numbers
    if (typeof data.startOdometer === 'number' && typeof data.endOdometer === 'number') {
        return data.endOdometer > data.startOdometer;
    }
    return true; // Pass validation if one or both are missing/invalid (handled by individual field validation)
}, {
    message: "End odometer reading must be greater than start odometer reading",
    path: ["endOdometer"], // Apply error to endOdometer field
});

type FormData = z.infer<typeof formSchema>;

// Define the expected API response structure for image upload
interface ImageUploadResponse {
    success: boolean;
    imageUrl: string;
    reading?: number;
    error?: string;
}


interface AddEditMileageLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  mileageLog?: MileageLog | null;
  tripId?: number | null;
}

export default function AddEditMileageLogModal({ isOpen, onClose, mileageLog, tripId }: AddEditMileageLogModalProps) {
  const { toast } = useToast();
  const isEditing = !!mileageLog;

  // State for image handling
  const [startImageFile, setStartImageFile] = useState<File | null>(null);
  const [endImageFile, setEndImageFile] = useState<File | null>(null);
  const [startImageUrl, setStartImageUrl] = useState<string | null>(null); // Initialize in useEffect
  const [endImageUrl, setEndImageUrl] = useState<string | null>(null);   // Initialize in useEffect
  const [startImageLoading, setStartImageLoading] = useState(false);
  const [endImageLoading, setEndImageLoading] = useState(false);
  const [startImageError, setStartImageError] = useState<string | null>(null);
  const [endImageError, setEndImageError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema), // Use the explicitly defined formSchema
    // Default values are set in useEffect based on props
  });

  // Reset form and image states when mileageLog data changes or modal opens/closes
  useEffect(() => {
    if (isOpen) {
        const initialStartUrl = mileageLog?.startImageUrl ?? null;
        const initialEndUrl = mileageLog?.endImageUrl ?? null;

        form.reset({
            tripId: mileageLog?.tripId ?? tripId ?? null,
            tripDate: mileageLog?.tripDate ? new Date(mileageLog.tripDate) : new Date(),
            startOdometer: mileageLog ? parseFloat(mileageLog.startOdometer) : undefined,
            endOdometer: mileageLog ? parseFloat(mileageLog.endOdometer) : undefined,
            purpose: mileageLog?.purpose ?? '',
            startImageUrl: initialStartUrl,
            endImageUrl: initialEndUrl,
        });
        setStartImageUrl(initialStartUrl);
        setEndImageUrl(initialEndUrl);

        // Reset file inputs and errors regardless
        setStartImageFile(null);
        setEndImageFile(null);
        setStartImageLoading(false);
        setEndImageLoading(false);
        setStartImageError(null);
        setEndImageError(null);
    }
  }, [mileageLog, tripId, form, isOpen]); // Add isOpen dependency


  // Function to handle image upload and OCR
  const handleImageUpload = async (file: File, type: 'start' | 'end') => {
    if (!file) return;

    const setLoading = type === 'start' ? setStartImageLoading : setEndImageLoading;
    const setError = type === 'start' ? setStartImageError : setEndImageError;
    const setFile = type === 'start' ? setStartImageFile : setEndImageFile;
    const setUrl = type === 'start' ? setStartImageUrl : setEndImageUrl;
    const odometerField = type === 'start' ? 'startOdometer' : 'endOdometer';
    const imageUrlField = type === 'start' ? 'startImageUrl' : 'endImageUrl';

    setLoading(true);
    setError(null);
    setFile(file); // Keep the file object for potential preview or re-upload

    const formData = new FormData();
    formData.append('odometerImage', file);

    try {
      // apiRequest returns a Response object, we need to parse its JSON body
      const rawResponse = await apiRequest('POST', '/api/mileage-logs/upload-odometer-image', formData);

      if (!rawResponse.ok) {
          // Attempt to parse error message from response body
          let errorData: { error?: string } = {};
          try {
              errorData = await rawResponse.json();
          } catch (parseError) {
              // Ignore if parsing fails, use status text
          }
          throw new Error(errorData.error || rawResponse.statusText || "Image upload failed");
      }

      const response: ImageUploadResponse = await rawResponse.json(); // Parse JSON body

      if (response.success) {
        setUrl(response.imageUrl);
        form.setValue(imageUrlField, response.imageUrl); // Update form state

        if (response.reading !== undefined) {
          form.setValue(odometerField, response.reading); // Update form state
          toast({ title: "OCR Success", description: `Odometer reading set to ${response.reading}.` });
        } else {
          toast({ title: "Image Uploaded", description: "Image uploaded, but OCR couldn't extract reading." });
        }
      } else {
        // Handle cases where API returns success: false in the JSON body
        throw new Error(response.error || "Image upload failed");
      }
    } catch (error) {
      console.error(`Failed to upload/process ${type} odometer image:`, error);
      const errorMsg = error instanceof Error ? error.message : "An unknown error occurred.";
      setError(errorMsg);
      setUrl(null); // Clear URL on error
      form.setValue(imageUrlField, null); // Clear form state URL
      toast({
        title: `Upload Failed (${type})`,
        description: errorMsg,
        variant: 'destructive',
      });
      setFile(null); // Clear the file state on error
    } finally {
      setLoading(false);
    }
  };

  // Handle file input change
  const onFileChange = (event: ChangeEvent<HTMLInputElement>, type: 'start' | 'end') => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file, type);
    }
    // Reset the input value to allow re-uploading the same file if needed
    event.target.value = '';
  };

  // Clear image selection/upload
  const clearImage = (type: 'start' | 'end') => {
      const imageUrlField = type === 'start' ? 'startImageUrl' : 'endImageUrl';
      const setFile = type === 'start' ? setStartImageFile : setEndImageFile;
      const setUrl = type === 'start' ? setStartImageUrl : setEndImageUrl;
      const setError = type === 'start' ? setStartImageError : setEndImageError;

      setFile(null);
      setUrl(null);
      setError(null);
      form.setValue(imageUrlField, null);
      // Optionally clear the odometer reading too? Or let user keep it?
      // const odometerField = type === 'start' ? 'startOdometer' : 'endOdometer';
      // form.setValue(odometerField, undefined);
  };


  const onSubmit = async (values: FormData) => {
    // 'values' now directly corresponds to our formSchema definition
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `/api/mileage-logs/${mileageLog?.id}` : '/api/mileage-logs';

    // Determine entry method based on whether images were uploaded (using state URLs)
    const entryMethod = startImageUrl || endImageUrl ? 'ocr' : 'manual';

    // Construct the data payload using form values and state image URLs
    // Ensure all fields required by the *final* insertMileageLogSchema are present
    const dataToSend = {
        tripId: values.tripId,
        tripDate: values.tripDate,
        startOdometer: values.startOdometer, // Already number from form schema
        endOdometer: values.endOdometer,   // Already number from form schema
        purpose: values.purpose,
        startImageUrl: startImageUrl, // Use state variable for final URL
        endImageUrl: endImageUrl,   // Use state variable for final URL
        entryMethod: entryMethod,
        // calculatedDistance will be handled by the backend or final schema if needed
    };

    // Final validation check before submitting using the original, refined schema from shared
     const validationResult = insertMileageLogSchema.safeParse(dataToSend);
     if (!validationResult.success) {
         console.error("Final validation failed:", validationResult.error.flatten());
         toast({
             title: "Validation Error",
             // Provide a more specific error message if possible
             description: validationResult.error.errors[0]?.message || "Please check the form fields for errors.",
             variant: "destructive",
         });
         // Optionally focus on the first error field
         const firstErrorPath = validationResult.error.errors[0]?.path[0];
         // Check if the field exists in our form before trying to focus
         if (firstErrorPath && typeof firstErrorPath === 'string' && Object.keys(form.getValues()).includes(firstErrorPath)) {
             form.setFocus(firstErrorPath as keyof FormData);
         } else if (validationResult.error.errors[0]?.path.includes('endOdometer')) {
             // Specific focus for refinement error
             form.setFocus('endOdometer');
         }
         return; // Stop submission
     }


    try {
      // Use the validated data from safeParse which includes all fields
      await apiRequest(method, url, validationResult.data);
      toast({
        title: `Mileage log ${isEditing ? 'updated' : 'added'}`,
        description: `Successfully ${isEditing ? 'updated' : 'added'} the mileage log.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mileage-logs'] });
      onClose();
      // Form reset is handled by useEffect on isOpen change
    } catch (error) {
      console.error("Failed to save mileage log:", error);
      toast({
        title: `Failed to ${isEditing ? 'update' : 'add'} mileage log`,
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: 'destructive',
      });
    }
  };

  // Handle modal state change for controlled component
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      // Reset is handled by useEffect on isOpen change
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]"> {/* Increased width slightly */}
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Mileage Log' : 'Add New Mileage Log'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details of your mileage log.' : 'Enter the details for your new mileage log. Upload odometer images for automatic reading.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            {/* Trip Date */}
            <FormField
              control={form.control}
              name="tripDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Trip Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Odometer Readings and Image Uploads */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Odometer Section */}
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="startOdometer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Odometer</FormLabel>
                      <FormControl>
                        {/* Ensure value passed to Input is string or number, handle undefined */}
                        <Input type="number" step="0.1" placeholder="e.g., 12345.6"
                               value={field.value ?? ''}
                               onChange={event => field.onChange(event.target.value === '' ? undefined : +event.target.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel htmlFor="startOdometerImage" className="text-sm font-medium">Start Odometer Image</FormLabel>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="relative" disabled={startImageLoading}>
                      {startImageLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                      Upload Start
                      <Input
                        id="startOdometerImage"
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => onFileChange(e, 'start')}
                        disabled={startImageLoading}
                      />
                    </Button>
                    {startImageUrl && !startImageLoading && (
                        <div className="flex items-center gap-1">
                            <a href={startImageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate max-w-[100px]" title={startImageUrl}>
                                View Image
                            </a>
                            <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-red-500 hover:bg-red-100" onClick={() => clearImage('start')}>
                                <XCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                  </div>
                  {startImageError && <p className="text-sm font-medium text-destructive">{startImageError}</p>}
                  {/* Display the startImageUrl from form state for debugging/confirmation */}
                  <FormField
                      control={form.control}
                      name="startImageUrl"
                      render={({ field }) => (
                          field.value ? <p className="text-xs text-muted-foreground mt-1">URL: {field.value.substring(0, 30)}...</p> : null
                      )}
                    />
                </FormItem>
              </div>

              {/* End Odometer Section */}
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="endOdometer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Odometer</FormLabel>
                      <FormControl>
                         {/* Ensure value passed to Input is string or number, handle undefined */}
                        <Input type="number" step="0.1" placeholder="e.g., 12400.2"
                               value={field.value ?? ''}
                               onChange={event => field.onChange(event.target.value === '' ? undefined : +event.target.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormItem>
                  <FormLabel htmlFor="endOdometerImage" className="text-sm font-medium">End Odometer Image</FormLabel>
                   <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="relative" disabled={endImageLoading}>
                       {endImageLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                      Upload End
                      <Input
                        id="endOdometerImage"
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => onFileChange(e, 'end')}
                        disabled={endImageLoading}
                      />
                    </Button>
                     {endImageUrl && !endImageLoading && (
                         <div className="flex items-center gap-1">
                            <a href={endImageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate max-w-[100px]" title={endImageUrl}>
                                View Image
                            </a>
                             <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-red-500 hover:bg-red-100" onClick={() => clearImage('end')}>
                                <XCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                  </div>
                  {endImageError && <p className="text-sm font-medium text-destructive">{endImageError}</p>}
                   {/* Display the endImageUrl from form state for debugging/confirmation */}
                   <FormField
                      control={form.control}
                      name="endImageUrl"
                      render={({ field }) => (
                          field.value ? <p className="text-xs text-muted-foreground mt-1">URL: {field.value.substring(0, 30)}...</p> : null
                      )}
                    />
                </FormItem>
              </div>
            </div>

            {/* Purpose */}
            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Client meeting, Site visit" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Hidden Trip ID if provided */}
            {/* <FormField control={form.control} name="tripId" render={({ field }) => <Input type="hidden" {...field} />} /> */}


            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting || startImageLoading || endImageLoading}>
                {(form.formState.isSubmitting || startImageLoading || endImageLoading) ? 'Saving...' : (isEditing ? 'Update Log' : 'Add Log')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}