import { format } from 'date-fns';
import { Pencil, Trash2, Image as ImageIcon } from 'lucide-react'; // Added ImageIcon

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useModalStore } from '@/lib/store';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { MileageLog } from '@shared/schema';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Added Tooltip

interface MileageLogTableProps {
  logs: MileageLog[];
  isLoading: boolean;
}

export default function MileageLogTable({ logs, isLoading }: MileageLogTableProps) {
  const { toggleAddEditMileageLog } = useModalStore();
  const { toast } = useToast();

  const handleDelete = async (logId: number) => {
    try {
      await apiRequest('DELETE', `/api/mileage-logs/${logId}`);
      toast({
        title: 'Mileage Log Deleted',
        description: 'The mileage log has been successfully deleted.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mileage-logs'] });
    } catch (error) {
      console.error("Failed to delete mileage log:", error);
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Could not delete mileage log.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div>Loading mileage logs...</div>; // Or a skeleton loader
  }

  if (!logs || logs.length === 0) {
    return <p className="text-center text-gray-500 dark:text-gray-400 mt-4">No mileage logs found.</p>;
  }

  return (
    <TooltipProvider> {/* Added TooltipProvider */}
      <div className="rounded-md border mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Start Odometer</TableHead>
              <TableHead className="text-center">Start Img</TableHead> {/* New Column */}
              <TableHead className="text-right">End Odometer</TableHead>
              <TableHead className="text-center">End Img</TableHead>   {/* New Column */}
              <TableHead className="text-right">Distance</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead className="text-center">Entry</TableHead> {/* Added Entry Method Column */}
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{format(new Date(log.tripDate), 'MMM d, yyyy')}</TableCell>
                <TableCell className="text-right">{log.startOdometer}</TableCell>
                <TableCell className="text-center">
                  {log.startImageUrl ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a href={log.startImageUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                          <img src={log.startImageUrl} alt="Start Odometer" className="h-8 w-auto object-cover rounded hover:opacity-80 transition-opacity" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View Start Image</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <ImageIcon className="h-5 w-5 text-gray-400 mx-auto" />
                  )}
                </TableCell>
                <TableCell className="text-right">{log.endOdometer}</TableCell>
                 <TableCell className="text-center">
                  {log.endImageUrl ? (
                     <Tooltip>
                      <TooltipTrigger asChild>
                        <a href={log.endImageUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                          <img src={log.endImageUrl} alt="End Odometer" className="h-8 w-auto object-cover rounded hover:opacity-80 transition-opacity" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View End Image</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                     <ImageIcon className="h-5 w-5 text-gray-400 mx-auto" />
                  )}
                </TableCell>
                <TableCell className="text-right">{log.calculatedDistance}</TableCell>
                <TableCell>{log.purpose || '-'}</TableCell>
                <TableCell className="text-center capitalize">{log.entryMethod}</TableCell> {/* Display Entry Method */}
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mr-2"
                    onClick={() => toggleAddEditMileageLog({ log })} // Pass log data for editing
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Mileage Log</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this mileage log? This action cannot be undone. Associated images will also be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-500 hover:bg-red-600"
                          onClick={() => handleDelete(log.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}