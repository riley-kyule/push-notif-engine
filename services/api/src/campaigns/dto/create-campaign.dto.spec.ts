import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateCampaignDto } from "./create-campaign.dto";

const basePayload = {
  siteId: "site-1",
  name: "Weekend sale",
  channel: "web",
  type: "instant",
  title: "Weekend sale is live",
  message: "Save 20% on everything this weekend.",
  url: "https://example.com/sale",
};

test("CreateCampaignDto treats a blank imageUrl/iconUrl as no value instead of failing @IsUrl()", async () => {
  const dto = plainToInstance(CreateCampaignDto, { ...basePayload, imageUrl: "", iconUrl: "" });
  const errors = await validate(dto);

  assert.equal(errors.length, 0);
  assert.equal(dto.imageUrl, null);
  assert.equal(dto.iconUrl, null);
});

test("CreateCampaignDto still rejects a genuinely malformed imageUrl", async () => {
  const dto = plainToInstance(CreateCampaignDto, { ...basePayload, imageUrl: "not a url" });
  const errors = await validate(dto);

  assert.equal(errors.some((error) => error.property === "imageUrl"), true);
});
