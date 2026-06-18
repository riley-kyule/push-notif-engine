import { Controller, Param, Post } from "@nestjs/common";

import { BrowserPushRepository } from "./browser-push.repository";

@Controller("browser-push/deliveries")
export class BrowserPushDeliveryController {
  constructor(private readonly browserPushRepository: BrowserPushRepository) {}

  @Post(":deliveryId/delivered")
  async markDelivered(
    @Param("deliveryId") deliveryId: string,
  ): Promise<{ success: true; data: { updated: boolean } }> {
    const updated = await this.browserPushRepository.markDeliveryEventDelivered(deliveryId);
    return { success: true, data: { updated } };
  }

  @Post(":deliveryId/clicked")
  async markClicked(
    @Param("deliveryId") deliveryId: string,
  ): Promise<{ success: true; data: { updated: boolean } }> {
    const updated = await this.browserPushRepository.markDeliveryEventClicked(deliveryId);
    return { success: true, data: { updated } };
  }
}
