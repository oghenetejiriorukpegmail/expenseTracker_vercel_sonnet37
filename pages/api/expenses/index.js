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

    // Handle GET request - Get all expenses for user
    if (req.method === 'GET') {
      const { tripName } = req.query;
      
      // Mock expenses data
      const mockExpenses = [
        {
          id: 1,
          date: '2025-04-10',
          cost: '125.50',
          type: 'Transportation',
          vendor: 'Uber',
          location: 'New York',
          tripName: 'Business Trip to New York',
          comments: 'Airport to hotel',
          userId: 1,
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 2,
          date: '2025-04-11',
          cost: '45.75',
          type: 'Food',
          vendor: 'Restaurant ABC',
          location: 'New York',
          tripName: 'Business Trip to New York',
          comments: 'Dinner with client',
          userId: 1,
          createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 3,
          date: '2025-04-15',
          cost: '89.99',
          type: 'Transportation',
          vendor: 'Taxi Service',
          location: 'Chicago',
          tripName: 'Client Meeting in Chicago',
          comments: 'Office to airport',
          userId: 1,
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      
      // Filter by trip name if provided
      let filteredExpenses = mockExpenses;
      if (tripName) {
        filteredExpenses = mockExpenses.filter(expense => expense.tripName === tripName);
      }
      
      return res.status(200).json(filteredExpenses);
    }
    
    // Handle POST request - Create a new expense
    if (req.method === 'POST') {
      const { date, cost, type, vendor, location, tripName, comments } = req.body;
      
      // Validate input
      if (!date || !cost || !type || !vendor || !location || !tripName) {
        return res.status(400).json({ message: 'Required fields are missing' });
      }
      
      // Mock expense creation
      const newExpense = {
        id: 4, // Mock ID
        date,
        cost: String(cost), // Ensure cost is stored as string
        type,
        vendor,
        location,
        tripName,
        comments: comments || '',
        userId: 1,
        createdAt: new Date().toISOString()
      };
      
      return res.status(201).json(newExpense);
    }
    
    // Method not allowed
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('Expenses error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}