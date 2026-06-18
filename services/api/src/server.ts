import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Pool } from "pg";

import { AppModule } from "./app.module";
import { DATABASE_POOL } from "./database/database.constants";

export async function createApiApp() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableShutdownHooks();
  const corsOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
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
