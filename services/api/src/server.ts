import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { Pool } from "pg";

import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { createOriginAllowlistChecker } from "./cors-origin.util";
import { DATABASE_POOL } from "./database/database.constants";

export async function createApiApp() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableShutdownHooks();

  // This API never serves HTML itself, but helmet's defaults (HSTS,
  // X-Content-Type-Options, X-Frame-Options, a restrictive CSP, etc.) cost
  // nothing for a JSON API and close off header-based attacks against any
  // browser that does end up rendering a response directly (an error page,
  // a misconfigured proxy, a future endpoint that does serve HTML).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  const pool = app.get<Pool>(DATABASE_POOL);
  const corsOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isAllowedOrigin = createOriginAllowlistChecker(
    { listSiteUrls: async () => (await pool.query<{ url: string }>("SELECT url FROM sites")).rows.map((row) => row.url) },
    corsOrigins,
  );

  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        // Non-browser callers (server-to-server, mobile apps, curl) don't send
        // an Origin header at all -- nothing to validate against.
        callback(null, true);
        return;
      }

      isAllowedOrigin(origin)
        .then((allowed) => callback(null, allowed))
        .catch(() => callback(null, false));
    },
    credentials: false,
  });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  return app;
}

export async function startApiServer(port = Number(process.env.PORT ?? "3001")): Promise<void> {
  const app = await createApiApp();

  const pool = app.get<Pool>(DATABASE_POOL);
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    console.error("Database connectivity check failed — aborting startup:", error);
    process.exit(1);
  }

  await app.listen(port, "0.0.0.0");
}
