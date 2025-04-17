// Mock implementation for testing
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Mock user authentication - accept any username/password combination
    // In a real implementation, this would verify against the database
    
    // Mock user data
    const userData = {
      id: 1,
      username,
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      createdAt: new Date().toISOString()
    };
    
    // Mock token
    const token = 'mock-jwt-token-' + Math.random().toString(36).substring(2);
    
    // Set cookie with token
    res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}`); // 7 days
    
    return res.status(200).json({
      user: userData,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}