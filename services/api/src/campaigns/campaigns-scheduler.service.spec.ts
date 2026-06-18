import assert from "node:assert/strict";
import test from "node:test";

import { CampaignsSchedulerService } from "./campaigns-scheduler.service";

test("scheduler sends due one-off campaigns and advances due recurring campaigns", async () => {
  const sentIds: string[] = [];
  const dispatchedIds: string[] = [];
  const advancedIds: string[] = [];

  const campaignsService = {
    async listDueScheduledCampaigns() {
      return [
        { id: "one-off-1", recurrenceType: null },
        { id: "recurring-1", recurrenceType: "daily" },
      ];
    },
    async sendCampaign(id: string) {
      sentIds.push(id);
      return { jobId: "job-1", queued: true as const };
    },
    async dispatchScheduledOccurrence(campaign: { id: string }) {
      dispatchedIds.push(campaign.id);
      return { jobId: "job-2", queued: true as const };
    },
    async advanceRecurringCampaign(campaign: { id: string }) {
      advancedIds.push(campaign.id);
    },
  };

  const scheduler = new CampaignsSchedulerService(campaignsService as never);
  await scheduler.dispatchDueCampaigns();

  assert.deepEqual(sentIds, ["one-off-1"]);
  assert.deepEqual(dispatchedIds, ["recurring-1"]);
  assert.deepEqual(advancedIds, ["recurring-1"]);
});

test("scheduler continues processing remaining campaigns if one dispatch fails", async () => {
  const sentIds: string[] = [];

  const campaignsService = {
    async listDueScheduledCampaigns() {
      return [
        { id: "broken-1", recurrenceType: null },
        { id: "ok-1", recurrenceType: null },
      ];
    },
    async sendCampaign(id: string) {
      if (id === "broken-1") {
        throw new Error("dispatch failed");
      }
      sentIds.push(id);
      return { jobId: "job-1", queued: true as const };
    },
    async dispatchScheduledOccurrence() {
      return { jobId: "job-2", queued: true as const };
    },
    async advanceRecurringCampaign() {
      return undefined;
    },
  };

  const scheduler = new CampaignsSchedulerService(campaignsService as never);
  await scheduler.dispatchDueCampaigns();

  assert.deepEqual(sentIds, ["ok-1"]);
});
