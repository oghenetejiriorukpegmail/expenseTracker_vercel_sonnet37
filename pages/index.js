import { useState, useEffect } from 'react';

export default function Home() {
  const [databaseStatus, setDatabaseStatus] = useState({ checked: false, connected: false, error: null });
  const [supabaseStatus, setSupabaseStatus] = useState({ checked: false, connected: false, error: null });
  const [apiStatus, setApiStatus] = useState({ checked: false, working: false, error: null });

  useEffect(() => {
    // Check Supabase connection
    async function checkSupabaseConnection() {
      try {
        const response = await fetch('/api/check-supabase');
        const data = await response.json();

        setSupabaseStatus({
          checked: true,
          connected: response.ok && data.success,
          error: data.error || null
        });
      } catch (error) {
        setSupabaseStatus({
          checked: true,
          connected: false,
          error: 'Failed to check Supabase connection'
        });
      }
    }

    // Check API status
    async function checkApiStatus() {
      try {
        const response = await fetch('/api/hello');
        const data = await response.json();

        setApiStatus({
          checked: true,
          working: response.ok,
          error: response.ok ? null : 'API endpoint not responding correctly'
        });
      } catch (error) {
        setApiStatus({
          checked: true,
          working: false,
          error: 'Failed to check API status'
        });
      }
    }

    checkSupabaseConnection();
    checkApiStatus();
  }, []);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Expense Tracker - Development Verification</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">System Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Supabase Status */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">Supabase Storage</h3>
            {!supabaseStatus.checked ? (
              <p className="text-gray-500">Checking connection...</p>
            ) : supabaseStatus.connected ? (
              <p className="text-green-600">✓ Connected</p>
            ) : (
              <p className="text-red-600">✗ Connection Error: {supabaseStatus.error}</p>
            )}
          </div>

          {/* API Status */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">API Routes</h3>
            {!apiStatus.checked ? (
              <p className="text-gray-500">Checking API...</p>
            ) : apiStatus.working ? (
              <p className="text-green-600">✓ Working</p>
            ) : (
              <p className="text-red-600">✗ Error: {apiStatus.error}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Key Functionality</h2>
        <p className="mb-4">
          The following API endpoints are available for testing:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li><strong>Authentication:</strong> /api/auth/register, /api/auth/login, /api/auth/logout</li>
          <li><strong>Expenses:</strong> /api/expenses, /api/expenses/[id], /api/expenses/upload</li>
          <li><strong>Trips:</strong> /api/trips, /api/trips/[id]</li>
          <li><strong>OCR Processing:</strong> /api/ocr/process</li>
        </ul>
        <p>
          Note: These endpoints require proper authentication and request parameters.
        </p>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
        <p className="mb-2">
          Make sure the following environment variables are properly configured:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><code>DATABASE_URL</code> - PostgreSQL connection string</li>
          <li><code>JWT_SECRET</code> - Secret key for JWT token generation</li>
          <li><code>SUPABASE_URL</code> - Supabase project URL</li>
          <li><code>SUPABASE_SERVICE_KEY</code> - Supabase service key</li>
          <li><code>OPENAI_API_KEY</code> or another OCR API key</li>
        </ul>
      </div>

      <div className="border-t pt-4 text-sm text-gray-600">
        <p>
          This verification page confirms that the refactored expense tracker application
          is running correctly in development mode.
        </p>
      </div>
    </div>
  );
}