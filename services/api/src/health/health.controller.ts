import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): { success: true; data: { status: string } } {
    return { success: true, data: { status: "ok" } };
  }
}
