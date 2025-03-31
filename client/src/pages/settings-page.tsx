import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Sidebar from "@/components/sidebar";
import { useSettingsStore } from "@/lib/store";
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

const ocrSettingsSchema = z.object({
  ocrMethod: z.string(),
  ocrApiKey: z.string().optional(),
});

export default function SettingsPage() {
  const { toast } = useToast();
  const { theme, ocrMethod, ocrApiKey, setOcrMethod, setOcrApiKey, toggleTheme } = useSettingsStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"none" | "loading" | "success" | "error">("none");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [extractedData, setExtractedData] = useState<{
    date?: string | null;
    vendor?: string | null;
    location?: string | null;
    total_amount?: string | number | null;
    type?: string | null;
    items?: Array<{name: string; price: number}>;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const form = useForm<z.infer<typeof ocrSettingsSchema>>({
    resolver: zodResolver(ocrSettingsSchema),
    defaultValues: {
      ocrMethod: ocrMethod || "gemini",
      ocrApiKey: ocrApiKey || "",
    },
  });
  
  async function onSubmit(values: z.infer<typeof ocrSettingsSchema>) {
    setIsSubmitting(true);
    try {
      // Save settings to backend
      await apiRequest("POST", "/api/update-env", {
        ocrMethod: values.ocrMethod,
        apiKey: values.ocrApiKey,
      });
      
      // Update local state
      setOcrMethod(values.ocrMethod);
      setOcrApiKey(values.ocrApiKey || null);
      
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
    
    if (values.ocrMethod !== "tesseract" && (!values.ocrApiKey || values.ocrApiKey.trim() === "")) {
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
    
    try {
      const response = await fetch("/api/ocr/process", {
        method: "POST",
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Extract structured data if available
        if (data.data && Object.keys(data.data).length > 0) {
          setExtractedData(data.data);
          setVerificationStatus("success");
          setVerificationMessage("Receipt processed successfully! See extracted data below.");
        } else {
          // Handle case where OCR worked but no structured data was extracted
          setVerificationStatus("error");
          setVerificationMessage("Receipt was processed, but no structured data could be extracted. Try another image or a different OCR method.");
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
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
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
                              <SelectItem value="tesseract">Tesseract.js (Local)</SelectItem>
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
                    
                    {form.watch("ocrMethod") !== "tesseract" && (
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
                    )}
                    
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
                                <tr className="bg-white dark:bg-gray-800">
                                  <td className="px-4 py-2 font-medium">Vendor</td>
                                  <td className="px-4 py-2">{extractedData.vendor || "Not detected"}</td>
                                </tr>
                                <tr className="bg-white dark:bg-gray-800">
                                  <td className="px-4 py-2 font-medium">Type</td>
                                  <td className="px-4 py-2">{extractedData.type || "Not detected"}</td>
                                </tr>
                                <tr className="bg-white dark:bg-gray-800">
                                  <td className="px-4 py-2 font-medium">Location</td>
                                  <td className="px-4 py-2">{extractedData.location || "Not detected"}</td>
                                </tr>
                                <tr className="bg-white dark:bg-gray-800">
                                  <td className="px-4 py-2 font-medium">Total Amount</td>
                                  <td className="px-4 py-2">
                                    {extractedData.total_amount 
                                      ? typeof extractedData.total_amount === 'number' 
                                        ? `$${extractedData.total_amount.toFixed(2)}` 
                                        : extractedData.total_amount
                                      : "Not detected"}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          
                          {extractedData.items && extractedData.items.length > 0 && (
                            <div className="w-full mt-4 border rounded-md overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-100 dark:bg-gray-700">
                                  <tr>
                                    <th className="px-4 py-2 text-left">Item</th>
                                    <th className="px-4 py-2 text-right">Price</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {extractedData.items.map((item, index) => (
                                    <tr key={index} className="bg-white dark:bg-gray-800">
                                      <td className="px-4 py-2">{item.name}</td>
                                      <td className="px-4 py-2 text-right">${item.price.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          
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
                      <p className="font-medium">Tesseract.js</p>
                      <p className="text-gray-500 dark:text-gray-400">Free, runs locally in browser. No API key required but less accurate.</p>
                    </div>
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
      </main>
    </div>
  );
}
