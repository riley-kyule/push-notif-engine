import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Queue } from "bullmq";

import { SitesService } from "../sites/sites.service";
import { BROWSER_PUSH_JOB_NAME, BROWSER_PUSH_QUEUE_NAME } from "./browser-push.constants";
import type { BrowserPushJobPayload } from "./browser-push.types";
import { CreateBrowserPushDispatchDto } from "./dto/create-browser-push-dispatch.dto";

export const BROWSER_PUSH_QUEUE = Symbol("BROWSER_PUSH_QUEUE");

export interface BrowserPushDispatchInput {
  siteId: string;
  title: string;
  body: string;
  url: string;
  icon?: string | null;
  image?: string | null;
  campaignId?: string | null;
  segmentId?: string | null;
  subscriberId?: string | null;
}

@Injectable()
export class BrowserPushService {
  constructor(
    private readonly sitesService: SitesService,
    @Inject(BROWSER_PUSH_QUEUE) private readonly queue: Queue,
  ) {}

  async dispatch(dto: BrowserPushDispatchInput | CreateBrowserPushDispatchDto): Promise<{ jobId: string | undefined; queued: true }> {
    const site = await this.sitesService.getSite(dto.siteId);
    if (!site) {
      throw new NotFoundException("Site not found");
    }
    if (!site.vapidPublicKey || !site.vapidPrivateKey || !site.vapidSubject) {
      throw new ServiceUnavailableException("Browser push credentials are not configured for this site");
    }

    const payload: BrowserPushJobPayload = {
      siteId: site.id,
      campaignId: dto.campaignId ?? null,
      segmentId: dto.segmentId ?? null,
      subscriberId: dto.subscriberId ?? null,
      notification: {
        title: dto.title,
        body: dto.body,
        url: dto.url,
        icon: dto.icon ?? null,
        image: dto.image ?? null,
      },
      enqueuedAt: new Date().toISOString(),
    };

    const job = await this.queue.add(BROWSER_PUSH_JOB_NAME, payload);

    return {
      jobId: job.id,
      queued: true,
    };
  }
}
