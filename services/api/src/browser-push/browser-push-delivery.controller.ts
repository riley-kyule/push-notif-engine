import { Controller, forwardRef, Inject, Param, Post } from "@nestjs/common";

import { WorkflowService } from "../workflows/workflow.service";
import { BrowserPushRepository } from "./browser-push.repository";

@Controller("browser-push/deliveries")
export class BrowserPushDeliveryController {
  constructor(
    private readonly browserPushRepository: BrowserPushRepository,
    @Inject(forwardRef(() => WorkflowService)) private readonly workflowService: WorkflowService,
  ) {}

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

    // Only fire the 'click' automation trigger on the first click for this delivery —
    // markDeliveryEventClicked's WHERE clicked_at IS NULL guard makes `updated` true
    // exactly once, so this can't double-fire on repeat clicks.
    if (updated) {
      const context = await this.browserPushRepository.findDeliveryEventContext(deliveryId);
      if (context) {
        await this.workflowService.recordEvent({
          siteId: context.siteId,
          subscriberId: context.subscriberId,
          campaignId: context.campaignId,
          triggerEvent: "click",
          payload: { deliveryId },
        });
      }
    }

    return { success: true, data: { updated } };
  }
}
