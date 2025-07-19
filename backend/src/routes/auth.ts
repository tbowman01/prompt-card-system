import { Router, Request, Response } from 'express';
import { 
  generateTokens, 
  hashPassword, 
  verifyPassword, 
  refreshToken,
  logout,
  verifyToken,
  requireRole
} from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimiting';
import { sanitizeRequestBody, handleValidationErrors } from '../middleware/validation';
import { body } from 'express-validator';
import { csrfProtection } from '../middleware/security';

const router = Router();

// Apply rate limiting to all auth routes
router.use(authRateLimit);

// Apply CSRF protection to state-changing operations
router.use(['POST', 'PUT', 'DELETE'], csrfProtection);

// Apply input sanitization
router.use(sanitizeRequestBody);

// Mock user database (replace with real database in production)
interface User {
  id: string;
  email: string;
  password: string;
  role: string;
  permissions: string[];
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

const users: User[] = [
  {
    id: '1',
    email: 'admin@example.com',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/UnFhqA5qLiDVN7Z6a',
    role: 'admin',
    permissions: ['read', 'write', 'delete', 'admin'],
    createdAt: new Date(),
    isActive: true
  },
  {
    id: '2',
    email: 'user@example.com',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/UnFhqA5qLiDVN7Z6a',
    role: 'user',
    permissions: ['read', 'write'],
    createdAt: new Date(),
    isActive: true
  }
];

// Helper functions
const findUserByEmail = (email: string): User | undefined => {
  return users.find(user => user.email.toLowerCase() === email.toLowerCase() && user.isActive);
};

const findUserById = (id: string): User | undefined => {
  return users.find(user => user.id === id && user.isActive);
};

// Validation schemas
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be between 6 and 128 characters'),
  handleValidationErrors
];

const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least 8 characters with uppercase, lowercase, number, and special character'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  handleValidationErrors
];

// POST /auth/login
router.post('/login', loginValidation, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    const user = findUserByEmail(email);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
      return;
    }
    
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
      return;
    }
    
    user.lastLogin = new Date();
    
    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    });
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          lastLogin: user.lastLogin
        },
        tokens
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

// POST /auth/register
router.post('/register', registerValidation, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    const existingUser = findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'User already exists',
        code: 'USER_EXISTS'
      });
      return;
    }
    
    const hashedPassword = await hashPassword(password);
    
    const newUser: User = {
      id: String(users.length + 1),
      email,
      password: hashedPassword,
      role: 'user',
      permissions: ['read', 'write'],
      createdAt: new Date(),
      isActive: true
    };
    
    users.push(newUser);
    
    const tokens = generateTokens({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      permissions: newUser.permissions
    });
    
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          permissions: newUser.permissions,
          createdAt: newUser.createdAt
        },
        tokens
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// POST /auth/refresh
router.post('/refresh', refreshToken);

// POST /auth/logout
router.post('/logout', logout);

// GET /auth/me
router.get('/me', verifyToken, (req: Request, res: Response): void => {
  const user = findUserById(req.user!.id);
  
  if (!user) {
    res.status(404).json({
      success: false,
      error: 'User not found',
      code: 'USER_NOT_FOUND'
    });
    return;
  }
  
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    }
  });
});

// GET /auth/users - Admin only
router.get('/users', verifyToken, requireRole(['admin']), (req: Request, res: Response): void => {
  const userList = users
    .filter(user => user.isActive)
    .map(user => ({
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }));
  
  res.json({
    success: true,
    data: { users: userList }
  });
});

export { router as authRoutes };