import { useEffect, useState } from 'react';

// Custom App component to wrap all pages
export default function MyApp({ Component, pageProps }) {
  const [supabaseStatus, setSupabaseStatus] = useState({ checked: false, connected: false, error: null });

  useEffect(() => {
    async function checkSupabaseConnection() {
      try {
        const response = await fetch('/api/check-supabase');
        const data = await response.json();

        if (response.ok && data.success) {
          console.log('Supabase connection successful');
          setSupabaseStatus({
            checked: true,
            connected: true,
            error: null
          });
        } else {
          console.error('Supabase connection error:', data.error);
          setSupabaseStatus({
            checked: true,
            connected: false,
            error: data.error || 'Unknown error'
          });
        }
      } catch (error) {
        console.error('Error checking Supabase connection:', error);
        setSupabaseStatus({
          checked: true,
          connected: false,
          error: 'Failed to check Supabase connection'
        });
      }
    }

    checkSupabaseConnection();
  }, []);

  return (
    <>
      {supabaseStatus.checked && !supabaseStatus.connected && (
        <div style={{ 
          backgroundColor: '#FEE2E2', 
          color: '#B91C1C', 
          padding: '0.75rem', 
          textAlign: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999
        }}>
          Supabase connection error: {supabaseStatus.error || 'Unknown error'}
        </div>
      )}
      <Component {...pageProps} />
    </>
  );
}