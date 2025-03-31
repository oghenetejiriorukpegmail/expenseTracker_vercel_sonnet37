import { create } from 'zustand';

type ThemeMode = 'light' | 'dark';

interface SettingsState {
  theme: ThemeMode;
  ocrMethod: string;
  ocrApiKey: string | null;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setOcrMethod: (method: string) => void;
  setOcrApiKey: (apiKey: string | null) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: (localStorage.getItem('theme') as ThemeMode) || 'light',
  ocrMethod: localStorage.getItem('ocrMethod') || 'tesseract',
  ocrApiKey: localStorage.getItem('ocrApiKey'),
  
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
    set({ ocrApiKey });
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
  receiptViewerOpen: boolean;
  currentReceiptUrl: string | null;
  toggleAddExpense: () => void;
  toggleAddTrip: () => void;
  openReceiptViewer: (url: string) => void;
  closeReceiptViewer: () => void;
  closeAll: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  addExpenseOpen: false,
  addTripOpen: false,
  receiptViewerOpen: false,
  currentReceiptUrl: null,
  
  toggleAddExpense: () => set((state) => ({ 
    addExpenseOpen: !state.addExpenseOpen,
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
  
  closeAll: () => set({
    addExpenseOpen: false,
    addTripOpen: false,
    receiptViewerOpen: false,
    currentReceiptUrl: null
  }),
}));
