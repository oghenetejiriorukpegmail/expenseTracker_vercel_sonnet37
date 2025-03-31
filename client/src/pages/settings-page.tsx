import { useState } from "react";
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
import { Loader2 } from "lucide-react";

const ocrSettingsSchema = z.object({
  ocrMethod: z.string(),
  ocrApiKey: z.string().optional(),
});

export default function SettingsPage() {
  const { toast } = useToast();
  const { theme, ocrMethod, ocrApiKey, setOcrMethod, setOcrApiKey, toggleTheme } = useSettingsStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
              <CardFooter className="flex flex-col items-start border-t pt-6">
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
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
