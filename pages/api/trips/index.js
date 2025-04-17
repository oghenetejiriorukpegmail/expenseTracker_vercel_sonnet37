// Mock implementation for testing
export default async function handler(req, res) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // In a real implementation, we would verify the token
    // For testing, we'll just check if it starts with our mock prefix
    if (!token.startsWith('mock-jwt-token-')) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Handle GET request - Get all trips for user
    if (req.method === 'GET') {
      // Mock trips data
      const mockTrips = [
        {
          id: 1,
          name: 'Business Trip to New York',
          description: 'Annual conference attendance',
          userId: 1,
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
        },
        {
          id: 2,
          name: 'Client Meeting in Chicago',
          description: 'Quarterly planning session',
          userId: 1,
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
        }
      ];
      
      return res.status(200).json(mockTrips);
    }
    
    // Handle POST request - Create a new trip
    if (req.method === 'POST') {
      const { name, description } = req.body;
      
      // Validate input
      if (!name) {
        return res.status(400).json({ message: 'Trip name is required' });
      }
      
      // Mock trip creation
      const newTrip = {
        id: 3, // Mock ID
        name,
        description: description || '',
        userId: 1,
        createdAt: new Date().toISOString()
      };
      
      return res.status(201).json(newTrip);
    }
    
    // Method not allowed
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('Trips error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}