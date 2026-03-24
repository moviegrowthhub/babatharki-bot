import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { initBot } from "./bot";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });
  next();
});

async function runMigrations() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS channels (
      id SERIAL PRIMARY KEY,
      channel_id TEXT NOT NULL UNIQUE,
      channel_name TEXT NOT NULL,
      channel_username TEXT,
      invite_link TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS plans (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      telegram_user_id TEXT NOT NULL,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      channel_id TEXT NOT NULL,
      plan_id INTEGER,
      plan_name TEXT,
      subscribed_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      telegram_user_id TEXT NOT NULL,
      username TEXT,
      first_name TEXT,
      txn_id TEXT NOT NULL,
      plan_id INTEGER,
      plan_name TEXT,
      amount INTEGER,
      channel_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      screenshot_file_id TEXT,
      payment_method TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      verified_at TIMESTAMP
    )
  `);
  // Add columns if they don't exist (for existing tables)
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS screenshot_file_id TEXT`);
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method TEXT`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);
  log("Database migrations complete.", "db");
}

async function seedData() {
  // Seed default plans if none exist
  const { rows: existingPlans } = await db.execute(sql`SELECT id FROM plans LIMIT 1`);
  if (existingPlans.length === 0) {
    await db.execute(sql`
      INSERT INTO plans (name, price, duration_days, description, is_active) VALUES
      ('Weekly', 99, 7, 'Perfect for a quick trial', true),
      ('Monthly', 299, 30, 'Most popular plan', true),
      ('Quarterly', 699, 90, 'Best value for money', true)
    `);
    log("Seeded default plans.", "db");
  }
  // Seed default settings
  const defaultSettings: Record<string, string> = {
    "upi_id": "bs883653-2@oksbi",
    "upi_name": "Bindar Singh",
    "bitcoin_address": "bc1qe6q4g9gng3f9f3raezx4002yeuv3572v40acuc",
    "bot_username": "",
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    const { rows: existing } = await db.execute(sql`SELECT id FROM settings WHERE key=${key} LIMIT 1`);
    if (existing.length === 0) {
      await db.execute(sql`INSERT INTO settings (key, value) VALUES (${key}, ${value})`);
    }
  }
}

// Prevent unhandled rejections from crashing the server
process.on("unhandledRejection", (reason: any) => {
  console.error("[Process] Unhandled rejection:", reason?.message || reason);
});
process.on("uncaughtException", (err: any) => {
  console.error("[Process] Uncaught exception:", err?.message || err);
});

(async () => {
  try {
    await runMigrations();
    await seedData();
  } catch (err) {
    console.error("Migration error:", err);
  }

  await registerRoutes(httpServer, app);

  // Start Telegram bot
  await initBot();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
