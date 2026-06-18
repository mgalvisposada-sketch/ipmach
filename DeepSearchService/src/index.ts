// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { searchRouter } from './routes/search';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { securityHeaders } from './middleware/securityHeaders';
import { cleanupSessions } from './scrapers/browser-manager';
import { SourceHandlerFactory } from './scrapers/handlers/SourceHandlerFactory';

// Initialize source handlers on startup
SourceHandlerFactory.initialize();

// Process-level error handlers to prevent crashes and 502 errors
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('❌ [Process] Unhandled Promise Rejection:', reason);
  console.error('❌ [Process] Promise:', promise);
  console.error('❌ [Process] Stack:', reason?.stack || 'No stack trace');
  // Don't exit - log and continue to prevent 502 errors
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ [Process] Uncaught Exception:', error);
  console.error('❌ [Process] Stack:', error.stack);
  // Don't exit immediately - log and allow current requests to complete
  // The service should be restarted by the process manager (PM2, systemd, etc.)
});

// Handle warnings
process.on('warning', (warning: Error) => {
  console.warn('⚠️ [Process] Warning:', warning.message);
  console.warn('⚠️ [Process] Stack:', warning.stack);
});

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces

// Security middleware
app.use(helmet());
app.use(securityHeaders);

// CORS configuration
const corsOptions = {
  origin: process.env.NEXTJS_API_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/search', searchRouter);
app.use('/health', healthRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Deep Search Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      search: '/search',
      health: '/health',
    },
  });
});

// Error handling (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Deep Search Service running on ${HOST}:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 API Key Auth: ${process.env.API_KEY ? 'Enabled' : 'Disabled'}`);
  if (HOST === '0.0.0.0') {
    console.log(`🌐 Accessible on your local network`);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    await cleanupSessions();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(async () => {
    await cleanupSessions();
    process.exit(0);
  });
});

export default app;

