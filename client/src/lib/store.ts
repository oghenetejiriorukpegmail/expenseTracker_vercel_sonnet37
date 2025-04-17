import { create } from 'zustand';
import type { Trip, Expense, MileageLog } from "@shared/schema"; // Import MileageLog type

type ThemeMode = 'light' | 'dark';

// Define available OCR templates
export type OcrTemplate = 'travel';

interface SettingsState {
  theme: ThemeMode;
  ocrMethod: string;
  ocrApiKey: string | null;
  ocrTemplate: OcrTemplate; // Add template state
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setOcrMethod: (method: string) => void;
  setOcrApiKey: (apiKey: string | null) => void;
  setOcrTemplate: (template: OcrTemplate) => void; // Add template setter
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: (localStorage.getItem('theme') as ThemeMode) || 'light',
  ocrMethod: localStorage.getItem('ocrMethod') || 'gemini',
  ocrApiKey: localStorage.getItem('ocrApiKey'),
  ocrTemplate: (localStorage.getItem('ocrTemplate') as OcrTemplate) || 'travel', // Initialize template to travel by default
  
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme });
  },
  
  toggleTheme: () => {
    set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { theme: newTheme };
    });
  },
  
  setOcrMethod: (method) => {
    localStorage.setItem('ocrMethod', method);
    set({ ocrMethod: method });
  },
  
  setOcrApiKey: (apiKey) => {
    if (apiKey) {
      localStorage.setItem('ocrApiKey', apiKey);
    } else {
      localStorage.removeItem('ocrApiKey');
    }
    set({ ocrApiKey: apiKey });
  },
  setOcrTemplate: (template) => { // Implement template setter
    localStorage.setItem('ocrTemplate', template);
    set({ ocrTemplate: template });
  },
}));

interface SidebarState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  close: () => set({ isOpen: false }),
}));

interface ModalState {
  addExpenseOpen: boolean;
  addTripOpen: boolean;
  editTripOpen: boolean;
  editingTrip: Trip | null;
  editExpenseOpen: boolean; // Add state for edit expense modal
  editingExpense: Expense | null;
  batchUploadOpen: boolean; // Add state for batch upload modal
  batchUploadTripId: number | null;
  batchUploadTripName: string | null; // Add state for target trip name
  receiptViewerOpen: boolean;
  currentReceiptUrl: string | null;
  defaultTripName: string | null;
  addEditMileageLogOpen: boolean; // State for mileage modal
  editingMileageLog: MileageLog | null; // Data for editing mileage log
  mileageLogTripId: number | null; // Trip ID when adding mileage log from trip card
  toggleAddExpense: (defaultTrip?: string) => void;
  toggleAddTrip: () => void;
  toggleEditTrip: (trip?: Trip | null) => void;
  toggleEditExpense: (expense?: Expense | null) => void;
  toggleBatchUpload: (tripData?: { id: number; name: string } | null) => void; // Update signature
  // Duplicate toggleBatchUpload removed
  openReceiptViewer: (url: string) => void;
  closeReceiptViewer: () => void;
  toggleAddEditMileageLog: (options?: { log?: MileageLog | null, tripId?: number | null }) => void; // Toggle function for mileage modal
  closeAll: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  addExpenseOpen: false,
  addTripOpen: false,
  editTripOpen: false,
  editingTrip: null,
  editExpenseOpen: false, // Initialize edit expense state
  editingExpense: null,
  batchUploadOpen: false, // Initialize batch upload state
  batchUploadTripId: null,
  batchUploadTripName: null, // Initialize batch upload trip name
  receiptViewerOpen: false,
  currentReceiptUrl: null,
  defaultTripName: null,
  addEditMileageLogOpen: false, // Initial state for mileage modal
  editingMileageLog: null,
  mileageLogTripId: null,

  toggleAddExpense: (defaultTrip?: string) => set((state) => ({
    addExpenseOpen: !state.addExpenseOpen,
    defaultTripName: !state.addExpenseOpen ? (defaultTrip || null) : null, // Set default trip only when opening
    addTripOpen: false,
    receiptViewerOpen: false
  })),

  toggleEditExpense: (expense?: Expense | null) => set((state) => {
    const newOpenState = !state.editExpenseOpen;
    console.log("Toggling Edit Expense Modal:", {
      currentOpenState: state.editExpenseOpen,
      newOpenState: newOpenState,
      expenseId: expense?.id
    }); // Log state change
    return {
      editExpenseOpen: newOpenState,
      editingExpense: newOpenState ? expense || null : null, // Set expense only when opening
      addExpenseOpen: false,
      addTripOpen: false,
      editTripOpen: false,
      receiptViewerOpen: false
    };
  }),

  toggleBatchUpload: (tripData?: { id: number; name: string } | null) => set((state) => ({
    batchUploadOpen: !state.batchUploadOpen,
    batchUploadTripId: !state.batchUploadOpen ? tripData?.id || null : null, // Set tripId only when opening
    batchUploadTripName: !state.batchUploadOpen ? tripData?.name || null : null, // Set tripName only when opening
    // Close other modals when opening batch upload
    addExpenseOpen: false,
    addTripOpen: false,
    editTripOpen: false,
    editExpenseOpen: false,
    receiptViewerOpen: false
  })),
  
  toggleEditTrip: (trip?: Trip | null) => set((state) => ({
    editTripOpen: !state.editTripOpen,
    editingTrip: !state.editTripOpen ? trip || null : null, // Set trip only when opening
    addExpenseOpen: false,
    addTripOpen: false,
    receiptViewerOpen: false
  })),
  
  toggleAddTrip: () => set((state) => ({ 
    addTripOpen: !state.addTripOpen,
    addExpenseOpen: false,
    receiptViewerOpen: false
  })),
  
  openReceiptViewer: (url) => set({ 
    receiptViewerOpen: true,
    currentReceiptUrl: url,
    addExpenseOpen: false,
    addTripOpen: false
  }),
  
  closeReceiptViewer: () => set({ 
    receiptViewerOpen: false,
    currentReceiptUrl: null
  }),
  
  toggleAddEditMileageLog: (options?: { log?: MileageLog | null, tripId?: number | null }) => set((state) => {
    const isOpen = !state.addEditMileageLogOpen;
    return {
      addEditMileageLogOpen: isOpen,
      editingMileageLog: isOpen ? options?.log ?? null : null,
      mileageLogTripId: isOpen ? options?.tripId ?? null : null,
      // Close other modals when opening this one
      addExpenseOpen: false,
      addTripOpen: false,
      editTripOpen: false,
      editExpenseOpen: false,
      batchUploadOpen: false,
      receiptViewerOpen: false,
    };
  }),

  closeAll: () => set({
    addExpenseOpen: false,
    addTripOpen: false,
    editTripOpen: false,
    editingTrip: null,
    editExpenseOpen: false,
    editingExpense: null,
    batchUploadOpen: false, // Reset batch upload state on closeAll
    batchUploadTripId: null,
    batchUploadTripName: null, // Reset batch upload trip name on closeAll
    receiptViewerOpen: false,
    currentReceiptUrl: null,
    defaultTripName: null,
    addEditMileageLogOpen: false, // Ensure mileage modal is closed too
    editingMileageLog: null,
    mileageLogTripId: null,
  }),
}));
