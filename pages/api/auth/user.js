// Mock implementation for testing
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

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

    // Mock user data
    const userData = {
      id: 1,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      createdAt: new Date().toISOString()
    };
    
    return res.status(200).json(userData);
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}