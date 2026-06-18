export interface DatabaseConfig {
  databaseUrl: string;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function loadDatabaseConfig(): DatabaseConfig {
  return {
    databaseUrl: readRequiredEnv("DATABASE_URL"),
  };
}
