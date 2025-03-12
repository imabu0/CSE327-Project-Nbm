// Import the jsonwebtoken library for handling JWTs
const jwt = require("jsonwebtoken");

// Get the secret key from environment variables
const SECRET_KEY = process.env.JWT_SECRET;

// Middleware function to protect routes
const protectRoute = (req, res, next) => {
  // Extract the token from the Authorization header (Bearer token)
  const token = req.headers.authorization?.split(" ")[1];

  // If no token is provided, respond with a 401 Unauthorized status
  if (!token) {
    return res.status(401).json({ error: "Unauthorized - No token provided" });
  }

  try {
    // Verify the token using the secret key
    const decoded = jwt.verify(token, SECRET_KEY);
    
    // Attach the decoded user information to the request object
    req.user = decoded;

    // Call the next middleware or route handler
    next();
  } catch (error) {
    // If token verification fails, respond with a 403 Forbidden status
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

// Export the protectRoute middleware for use in other modules
module.exports = protectRoute;