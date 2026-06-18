import { Inject, Injectable, Module, OnApplicationShutdown } from "@nestjs/common";
import { Pool } from "pg";

import { DATABASE_POOL } from "./database.constants";
import { loadDatabaseConfig } from "./database.config";

export function createDatabasePool(): Pool {
  const config = loadDatabaseConfig();
  return new Pool({
    connectionString: config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

@Injectable()
class DatabaseShutdownService implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: createDatabasePool,
    },
    DatabaseShutdownService,
  ],
  exports: [DATABASE_POOL],
})
export class DatabaseModule {}
