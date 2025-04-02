import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModalStore } from "@/lib/store";
import { useLocation } from "wouter"; // Import useLocation for navigation
import { useToast } from "@/hooks/use-toast";
import { Loader2, UploadCloud, FileText, X, CheckCircle, AlertCircle } from "lucide-react";
import { useDropzone } from 'react-dropzone';
import { apiRequest, queryClient } from "@/lib/queryClient"; // Import queryClient

interface UploadResult {
  filename: string;
  status: 'success' | 'failed';
  error?: string;
  expenseId?: number;
}

export default function BatchUploadModal() {
  const [, setLocation] = useLocation(); // Get setLocation hook
  const { batchUploadOpen: open, batchUploadTripId, batchUploadTripName, toggleBatchUpload } = useModalStore(); // Get trip name
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
    setUploadResults([]); // Clear previous results when new files are added
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
      'application/pdf': []
    }
  });

  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(file => file.name !== fileName));
  };

  const handleUpload = async () => {
    if (!batchUploadTripId || files.length === 0) return;

    setIsUploading(true);
    setUploadResults([]); 

    const formData = new FormData();
    files.forEach(file => {
      formData.append('receipts', file); // Use 'receipts' as the field name (matches backend)
    });

    try {
      const response = await apiRequest("POST", `/api/trips/${batchUploadTripId}/batch-process-receipts`, formData); // Removed extra argument

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Batch upload failed");
      }

      const result = await response.json();
      setUploadResults(result.results || []);
      toast({
        title: "Batch Upload Complete",
        description: result.message || "Processing finished.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      setFiles([]);
      
      // Redirect on success
      if (batchUploadTripName) {
        handleClose(); // Close modal first
        setLocation(`/expenses?trip=${encodeURIComponent(batchUploadTripName)}`);
      } else {
         handleClose(); // Close modal even if name is missing
      }

    } catch (error) {
      toast({
        title: "Upload Error",
        description: error instanceof Error ? error.message : "An unknown error occurred during upload.",
        variant: "destructive",
      });
      // Optionally clear files on error too, or allow retry
      // setFiles([]); 
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFiles([]); // Clear files when closing
    setUploadResults([]);
    toggleBatchUpload(); 
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Batch Upload Receipts</DialogTitle>
          <DialogDescription>
            Upload multiple receipts (images or PDFs) to automatically create expenses for this trip.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 dark:border-gray-600 hover:border-primary'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
            {isDragActive ? (
              <p className="mt-2 text-sm text-primary">Drop the files here ...</p>
            ) : (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Drag 'n' drop some files here, or click to select files</p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Supports: JPG, PNG, GIF, PDF (Max 10MB each)</p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <h4 className="text-sm font-medium">Selected Files ({files.length}):</h4>
              <ul className="space-y-1">
                {files.map((file, index) => (
                  <li key={index} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                    <div className="flex items-center space-x-2 truncate">
                       <FileText className="h-4 w-4 flex-shrink-0" />
                       <span className="truncate" title={file.name}>{file.name}</span>
                       <span className="text-xs text-gray-500 dark:text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(file.name)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {uploadResults.length > 0 && (
             <div className="space-y-2 max-h-60 overflow-y-auto border-t pt-4">
               <h4 className="text-sm font-medium">Upload Results:</h4>
               <ul className="space-y-1">
                 {uploadResults.map((result, index) => (
                   <li key={index} className={`flex items-center text-sm p-2 rounded ${result.status === 'success' ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
                     {result.status === 'success' ? <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> : <AlertCircle className="h-4 w-4 mr-2 text-red-600" />}
                     <span className="truncate flex-grow" title={result.filename}>{result.filename}</span>
                     {result.status === 'failed' && <span className="text-xs text-red-600 ml-2 truncate" title={result.error}>Error: {result.error}</span>}
                   </li>
                 ))}
               </ul>
             </div>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleUpload} disabled={files.length === 0 || isUploading}>
            {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading & Processing...</> : `Upload ${files.length} File(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}