import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const sessionsDir = path.join(process.cwd(), '.puppeteer-sessions');
    const sessions = fs.existsSync(sessionsDir)
      ? fs.readdirSync(sessionsDir).filter((f) => f.endsWith('-session.json'))
      : [];

    const health = {
      status: 'healthy',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      puppeteer: {
        sessions: sessions.length,
        sessionFiles: sessions,
      },
    };

    res.json(health);
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

export { router as healthRouter };

