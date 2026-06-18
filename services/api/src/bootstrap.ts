import { startApiServer } from "./server";

export async function bootstrapApi(): Promise<void> {
  await startApiServer();
}
