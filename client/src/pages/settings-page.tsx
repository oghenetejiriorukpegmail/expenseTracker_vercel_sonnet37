import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Sidebar from "@/components/sidebar";
import { useSettingsStore, OcrTemplate } from "@/lib/store"; // Import OcrTemplate type
import { apiRequest } from "@/lib/queryClient";
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  Upload, 
  CheckCircle, 
  AlertCircle
} from "lucide-react";
import AnimatedPage from "@/components/animated-page"; // Import the wrapper
// Line 43 removed

const ocrSettingsSchema = z.object({
  ocrMethod: z.string(),
  ocrApiKey: z.string().optional(),
  ocrTemplate: z.enum(['travel']), // Add template to schema, only travel allowed
});

export default function SettingsPage() {
  const { toast } = useToast();
  const { theme, ocrMethod, ocrApiKey, ocrTemplate, setOcrMethod, setOcrApiKey, setOcrTemplate, toggleTheme } = useSettingsStore(); // Get template state/setter
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"none" | "loading" | "success" | "error">("none");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [extractedData, setExtractedData] = useState<{
    date?: string | null;
    cost?: string | number | null;
    currency?: string | null;
    description?: string | null;
    // Add optional fields
    type?: string | null;
    vendor?: string | null;
    location?: string | null;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const form = useForm<z.infer<typeof ocrSettingsSchema>>({
    resolver: zodResolver(ocrSettingsSchema),
    defaultValues: {
      ocrMethod: ocrMethod || "gemini",
      ocrApiKey: ocrApiKey || "",
      ocrTemplate: ocrTemplate || "travel", // Set default template to travel
    },
  });
  
  async function onSubmit(values: z.infer<typeof ocrSettingsSchema>) {
    setIsSubmitting(true);
    try {
      // Save settings to backend
      await apiRequest("POST", "/api/update-env", {
        ocrMethod: values.ocrMethod,
        apiKey: values.ocrApiKey,
        ocrTemplate: values.ocrTemplate,
      });
      
      // Update local state
      setOcrMethod(values.ocrMethod);
      setOcrApiKey(values.ocrApiKey || null);
      setOcrTemplate(values.ocrTemplate); // Save selected template locally
      
      toast({
        title: "Settings updated",
        description: "Your settings have been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function testOcrSettings() {
    const values = form.getValues();
    setIsSubmitting(true);
    
    try {
      const response = await apiRequest("POST", "/api/test-ocr", {
        method: values.ocrMethod,
        apiKey: values.ocrApiKey,
      });
      
      const data = await response.json();
      
      toast({
        title: "OCR Test Result",
        description: data.success 
          ? "OCR configuration tested successfully!" 
          : `Test failed: ${data.message}`,
        variant: data.success ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "OCR Test Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const values = form.getValues();
    
    if (!values.ocrApiKey || values.ocrApiKey.trim() === "") {
      toast({
        title: "API Key Required",
        description: `Please enter your ${values.ocrMethod} API key first and save your settings.`,
        variant: "destructive",
      });
      return;
    }
    
    setVerificationStatus("loading");
    setVerificationMessage("Processing receipt...");
    setExtractedData({}); // Clear previous data
    
    const formData = new FormData();
    formData.append("receipt", file);
    // Append the selected template to the form data
    formData.append("template", values.ocrTemplate); // Use form value (will always be 'travel')

    try {
      const response = await fetch("/api/ocr/process", {
        method: "POST",
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Log the full response to see what we're getting
        console.log("OCR Response:", data);
        
        // Always set the data regardless of whether it seems empty
        setExtractedData(data.data || {});
        
        // Check if we got any meaningful data
        const hasData = data.data && Object.values(data.data).some(val =>
          val && (typeof val === 'string' && val.trim() !== '') ||
                (typeof val === 'number') ||
                (Array.isArray(val) && val.length > 0)
        );
        
        // Check if there's a PDF message
        if (data.pdfMessage) {
          setVerificationStatus("success");
          setVerificationMessage(data.pdfMessage);
        } else if (hasData) {
          setVerificationStatus("success");
          setVerificationMessage("Receipt processed successfully! See extracted data below.");
        } else {
          // Show partial success for OCR but no structured data
          setVerificationStatus("success");
          setVerificationMessage("Receipt was processed, but limited data was extracted. You may need to try another image or a different OCR method.");
        }
      } else {
        setVerificationStatus("error");
        setVerificationMessage(data.error || "Failed to process receipt. Check your API key and try again.");
      }
    } catch (error) {
      setVerificationStatus("error");
      setVerificationMessage(error instanceof Error ? error.message : "Failed to process receipt");
    }
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <Sidebar />
      
      {/* Main Content */}
      <AnimatedPage className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Removed extra <main> tag */}
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        <Tabs defaultValue="appearance" className="space-y-6">
          <TabsList>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="ocr">OCR Configuration</TabsTrigger>
          </TabsList>

          {/* Appearance Tab */}
          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize how the application looks and feels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-md font-medium">Dark Mode</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Toggle between light and dark theme
                      </p>
                    </div>
                    <Button variant="outline" onClick={toggleTheme}>
                      {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* OCR Configuration Tab */}
          <TabsContent value="ocr">
            <Card>
              <CardHeader>
                <CardTitle>OCR Configuration</CardTitle>
                <CardDescription>
                  Configure OCR settings for receipt processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="ocrMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OCR Method</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              // Clear API key when switching to Tesseract
                              if (value === "tesseract") {
                                form.setValue("ocrApiKey", "");
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select OCR method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {/* <SelectItem value="tesseract">Tesseract.js (Local)</SelectItem> */} {/* Removed Tesseract option */}
                              <SelectItem value="gemini">Google Gemini (Recommended)</SelectItem>
                              <SelectItem value="openai">OpenAI Vision</SelectItem>
                              <SelectItem value="claude">Anthropic Claude</SelectItem>
                              <SelectItem value="openrouter">OpenRouter</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Select the OCR method to use for extracting data from receipts.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ocrApiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Key</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter your API key"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            {`Enter your ${form.watch("ocrMethod")} API key for OCR processing.`}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Add OCR Template Selector */}
                    <FormField
                      control={form.control}
                      name="ocrTemplate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OCR Data Extraction Template</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(value: OcrTemplate) => field.onChange(value)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a template" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="travel">Travel Expenses</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose a template to guide the AI on which fields to prioritize during extraction.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex space-x-3">
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Settings"
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={testOcrSettings}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          "Test OCR"
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="flex flex-col items-start border-t pt-6 space-y-6">
                {/* Verification Upload Section */}
                <div className="w-full">
                  <h3 className="text-sm font-medium mb-2">Verify OCR Settings</h3>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md border border-dashed border-gray-300 dark:border-gray-600">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/jpg,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />

                      {verificationStatus === "none" && (
                        <>
                          <Upload className="h-8 w-8 text-gray-500" />
                          <p className="text-sm text-center text-gray-500">
                            Upload a receipt image or PDF to verify your OCR settings are working properly
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={triggerFileInput}
                            disabled={isSubmitting}
                            className="mt-2"
                          >
                            Upload Receipt for Verification
                          </Button>
                        </>
                      )}

                      {verificationStatus === "loading" && (
                        <>
                          <Loader2 className="h-8 w-8 text-primary animate-spin" />
                          <p className="text-sm text-center text-gray-500">
                            {verificationMessage}
                          </p>
                        </>
                      )}

                      {verificationStatus === "success" && (
                        <>
                          <CheckCircle className="h-8 w-8 text-green-500" />
                          <p className="text-sm text-center text-green-500 font-medium">
                            {verificationMessage}
                          </p>

                          {/* Extracted Data Table */}
                          <div className="w-full mt-4 border rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-100 dark:bg-gray-700">
                                <tr>
                                  <th className="px-4 py-2 text-left">Field</th>
                                  <th className="px-4 py-2 text-left">Value</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                <tr className="bg-white dark:bg-gray-800">
                                  <td className="px-4 py-2 font-medium">Date</td>
                                  <td className="px-4 py-2">{extractedData.date || "Not detected"}</td>
                                </tr>
                                {/* Changed Total Amount to Cost and Currency */}
                                <tr className="bg-white dark:bg-gray-800">
                                  <td className="px-4 py-2 font-medium">Cost</td>
                                  <td className="px-4 py-2">
                                    {extractedData.cost
                                      ? typeof extractedData.cost === 'number'
                                        ? extractedData.cost.toFixed(2) // Display number directly
                                        : extractedData.cost
                                      : "Not detected"}
                                  </td>
                                </tr>
                                <tr className="bg-white dark:bg-gray-800">
                                  <td className="px-4 py-2 font-medium">Currency</td>
                                  <td className="px-4 py-2">{extractedData.currency || "Not detected"}</td>
                                </tr>
                                <tr className="bg-white dark:bg-gray-800">
                                  <td className="px-4 py-2 font-medium">Description</td>
                                  <td className="px-4 py-2">{extractedData.description || "Not detected"}</td>
                                </tr>
                                {/* Add rows for optional fields */}
                                <tr className="bg-white dark:bg-gray-800">
                                  <td className="px-4 py-2 font-medium">Type</td>
                                  <td className="px-4 py-2">{extractedData.type || "Not detected"}</td>
                                </tr>
                                <tr className="bg-white dark:bg-gray-800">
                                  <td className="px-4 py-2 font-medium">Vendor</td>
                                  <td className="px-4 py-2">{extractedData.vendor || "Not detected"}</td>
                                </tr>
                                <tr className="bg-white dark:bg-gray-800">
                                  <td className="px-4 py-2 font-medium">Location</td>
                                  <td className="px-4 py-2">{extractedData.location || "Not detected"}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Removed Items table as it's not relevant for the travel template */}

                          <Button
                            type="button"
                            variant="outline"
                            onClick={triggerFileInput}
                            className="mt-4"
                          >
                            Try Another Receipt
                          </Button>
                        </>
                      )}

                      {verificationStatus === "error" && (
                        <>
                          <AlertCircle className="h-8 w-8 text-red-500" />
                          <p className="text-sm text-center text-red-500">
                            {verificationMessage}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={triggerFileInput}
                            className="mt-2"
                          >
                            Try Again
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* OCR Methods Information */}
                <div className="w-full">
                  <h3 className="text-sm font-medium mb-2">OCR Methods</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-sm">
                    <div>
                      <p className="font-medium">OpenAI Vision</p>
                      <p className="text-gray-500 dark:text-gray-400">Uses OpenAI's GPT-4 Vision. Requires API key with billing setup.</p>
                    </div>
                    <div className="bg-primary/5 p-2 rounded-md">
                      <p className="font-medium">Google Gemini (Recommended)</p>
                      <p className="text-gray-500 dark:text-gray-400">Google's AI vision model with excellent receipt processing capability. Requires Gemini API key.</p>
                    </div>
                    <div>
                      <p className="font-medium">Anthropic Claude</p>
                      <p className="text-gray-500 dark:text-gray-400">Anthropic's Claude model with vision capabilities.</p>
                    </div>
                  </div>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </AnimatedPage>
    </div>
  );
}
