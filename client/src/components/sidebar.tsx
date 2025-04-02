import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSettingsStore, useSidebarStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { UserIcon, LogOut, Moon, Sun } from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { theme, toggleTheme } = useSettingsStore();
  const { isOpen, toggle, close } = useSidebarStore();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const isActiveRoute = (path: string) => {
    return location === path;
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden w-full bg-white dark:bg-gray-800 p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={toggle} className="mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>
          <h1 className="text-lg font-bold">ExpenseTracker</h1>
        </div>
        <div>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={close}></div>
      )}

      {/* Sidebar */}
      <aside className={`bg-white dark:bg-gray-800 w-full md:w-64 shadow-md md:shadow-none md:flex md:flex-col flex-shrink-0 md:h-screen overflow-y-auto transition-all duration-300 z-50 fixed md:relative inset-0 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <span className="text-primary text-2xl">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <h1 className="text-xl font-bold">ExpenseTracker</h1>
          </div>
        </div>
        
        {user && (
          <div className="p-4 border-b dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="bg-primary text-white p-2 rounded-full">
                <UserIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium">{user.username}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">User</p>
              </div>
            </div>
          </div>
        )}
        
        <nav className="p-2 space-y-1">
          <div
            className={`flex items-center p-3 rounded-lg cursor-pointer ${
              isActiveRoute("/")
                ? "text-primary bg-blue-50 dark:bg-blue-900/20"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            onClick={() => {
              window.location.href = "/";
              close();
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Dashboard</span>
          </div>
          
          <div
            className={`flex items-center p-3 rounded-lg cursor-pointer ${
              isActiveRoute("/trips")
                ? "text-primary bg-blue-50 dark:bg-blue-900/20"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            onClick={() => {
              window.location.href = "/trips";
              close();
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Trips</span>
          </div>
          
          <div
            className={`flex items-center p-3 rounded-lg cursor-pointer ${
              isActiveRoute("/expenses")
                ? "text-primary bg-blue-50 dark:bg-blue-900/20"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            onClick={() => {
              window.location.href = "/expenses";
              close();
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Expenses</span>
          </div>
          
          {/* Profile Link */}
          <div
            className={`flex items-center p-3 rounded-lg cursor-pointer ${
              isActiveRoute("/profile")
                ? "text-primary bg-blue-50 dark:bg-blue-900/20"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            onClick={() => {
              window.location.href = "/profile";
              close();
            }}
          >
            <UserIcon className="h-5 w-5 mr-3" />
            <span>Profile</span>
          </div>

          {/* Settings Link */}
          <div
            className={`flex items-center p-3 rounded-lg cursor-pointer ${
              isActiveRoute("/settings")
                ? "text-primary bg-blue-50 dark:bg-blue-900/20"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            onClick={() => {
              window.location.href = "/settings";
              close();
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
          </div>
        </nav>
        
        <div className="mt-auto p-4 border-t dark:border-gray-700">
          <Button variant="ghost" className="w-full justify-start" onClick={toggleTheme}>
            {theme === "dark" ? (
              <>
                <Sun className="mr-2 h-5 w-5" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="mr-2 h-5 w-5" />
                <span>Dark Mode</span>
              </>
            )}
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start mt-2" 
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="mr-2 h-5 w-5" />
            <span>{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
