import { useState } from 'react';

export default function ApiTest() {
  const [authResult, setAuthResult] = useState('Results will appear here...');
  const [tripResult, setTripResult] = useState('Results will appear here...');
  const [token, setToken] = useState('');
  const [currentTripId, setCurrentTripId] = useState(null);
  const [formData, setFormData] = useState({
    username: 'testuser',
    password: 'testpassword',
    tripName: 'Business Trip to New York',
    tripDescription: 'Annual conference attendance'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Authentication functions
  const register = async () => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          username: formData.username, 
          password: formData.password 
        })
      });
      
      const data = await response.json();
      setAuthResult(JSON.stringify(data, null, 2));
      
      if (response.ok && data.token) {
        setToken(data.token);
        console.log('Token saved:', data.token);
      }
    } catch (error) {
      setAuthResult('Error: ' + error.message);
    }
  };
  
  const login = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          username: formData.username, 
          password: formData.password 
        })
      });
      
      const data = await response.json();
      setAuthResult(JSON.stringify(data, null, 2));
      
      if (response.ok && data.token) {
        setToken(data.token);
        console.log('Token saved:', data.token);
      }
    } catch (error) {
      setAuthResult('Error: ' + error.message);
    }
  };
  
  const logout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.text();
      setAuthResult(data || 'Logged out successfully');
      setToken('');
    } catch (error) {
      setAuthResult('Error: ' + error.message);
    }
  };
  
  // Trip management functions
  const createTrip = async () => {
    try {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: formData.tripName, 
          description: formData.tripDescription 
        })
      });
      
      const data = await response.json();
      setTripResult(`Status: ${response.status}\n\n${JSON.stringify(data, null, 2)}`);
      
      if (response.ok && data.id) {
        setCurrentTripId(data.id);
        console.log('Trip created with ID:', data.id);
      }
    } catch (error) {
      setTripResult('Error: ' + error.message);
    }
  };
  
  const getTrips = async () => {
    try {
      const response = await fetch('/api/trips', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      setTripResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setTripResult('Error: ' + error.message);
    }
  };
  
  const getTripById = async () => {
    if (!currentTripId) {
      setTripResult('No trip ID available. Create a trip first.');
      return;
    }
    
    try {
      const response = await fetch(`/api/trips/${currentTripId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      setTripResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setTripResult('Error: ' + error.message);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-6">Expense Tracker API Test</h1>
      
      <div className="mb-6 p-4 border rounded">
        <h2 className="text-xl font-bold mb-4">Authentication</h2>
        <div className="mb-4">
          <label className="block mb-1">Username:</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
          
          <label className="block mt-2 mb-1">Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
          
          <div className="mt-4 flex space-x-2">
            <button
              onClick={register}
              className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
            >
              Register
            </button>
            <button
              onClick={login}
              className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            >
              Login
            </button>
            <button
              onClick={logout}
              className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
        <pre className="bg-gray-100 p-2 rounded">{authResult}</pre>
      </div>
      
      <div className="p-4 border rounded">
        <h2 className="text-xl font-bold mb-4">Trip Management</h2>
        <div className="mb-4">
          <label className="block mb-1">Trip Name:</label>
          <input
            type="text"
            name="tripName"
            value={formData.tripName}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
          
          <label className="block mt-2 mb-1">Trip Description:</label>
          <textarea
            name="tripDescription"
            value={formData.tripDescription}
            onChange={handleChange}
            className="w-full border rounded p-2"
          ></textarea>
          
          <div className="mt-4 flex space-x-2">
            <button
              onClick={createTrip}
              className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
            >
              Create Trip
            </button>
            <button
              onClick={getTrips}
              className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            >
              Get All Trips
            </button>
            <button
              onClick={getTripById}
              className="bg-purple-500 text-white py-2 px-4 rounded hover:bg-purple-600"
            >
              Get Trip by ID
            </button>
          </div>
        </div>
        <pre className="bg-gray-100 p-2 rounded">{tripResult}</pre>
      </div>
    </div>
  );
}