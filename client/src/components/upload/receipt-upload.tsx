import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, Image as ImageIcon, FileText } from "lucide-react";

interface ReceiptUploadProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  currentReceiptUrl?: string | null;
}

export default function ReceiptUpload({ onFileSelect, selectedFile, currentReceiptUrl }: ReceiptUploadProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // If there's a current receipt URL but no selected file, show the existing receipt
  const showExistingReceipt = !selectedFile && currentReceiptUrl;
  
  const validateFile = (file: File): boolean => {
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, GIF, or PDF file.",
        variant: "destructive",
      });
      return false;
    }
    
    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB.",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };
  
  const handleFileSelection = useCallback((file: File) => {
    if (!validateFile(file)) return;
    
    setIsLoading(true);
    
    // Create a preview for images (not PDFs)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
    } else {
      // For PDFs, just show an icon
      setPreviewUrl(null);
      setIsLoading(false);
    }
    
    onFileSelect(file);
  }, [onFileSelect, toast]);
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileSelection(file);
    }
  }, [handleFileSelection]);
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFileSelection(file);
    }
  }, [handleFileSelection]);
  
  const handleRemoveFile = useCallback(() => {
    setPreviewUrl(null);
    onFileSelect(null);
  }, [onFileSelect]);
  
  return (
    <div className="mt-1">
      {selectedFile || showExistingReceipt ? (
        <div className="border-2 border-gray-300 dark:border-gray-600 rounded-md p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              {selectedFile ? (
                <>
                  {selectedFile.type.startsWith('image/') ? (
                    <ImageIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                  ) : (
                    <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                  )}
                  <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {selectedFile.name}
                  </div>
                </>
              ) : (
                <>
                  <ImageIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                  <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    Existing Receipt
                  </div>
                </>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={handleRemoveFile}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
          
          {isLoading ? (
            <div className="h-40 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : previewUrl ? (
            <div className="h-40 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : showExistingReceipt ? (
            <div className="h-40 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
              <img
                src={currentReceiptUrl!}
                alt="Existing receipt"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
              <FileText className="h-12 w-12 text-gray-400 mb-2" />
              <span className="text-sm text-gray-500 dark:text-gray-400">PDF document</span>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${
            isDragging 
              ? "border-primary border-dashed bg-blue-50 dark:bg-blue-900/20" 
              : "border-gray-300 dark:border-gray-600 border-dashed hover:bg-gray-50 dark:hover:bg-gray-700/30"
          } rounded-md transition-colors cursor-pointer`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <div className="space-y-1 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="flex text-sm text-gray-600 dark:text-gray-400">
              <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-primary hover:text-blue-600">
                <span>Upload a file</span>
                <input 
                  id="file-upload" 
                  name="file-upload" 
                  type="file" 
                  className="sr-only" 
                  accept="image/*,application/pdf"
                  onChange={handleInputChange}
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              PNG, JPG, PDF up to 10MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
