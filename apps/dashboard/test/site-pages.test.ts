import assert from "node:assert/strict";
import test from "node:test";

import SitesPage from "../app/sites/page";
import NewSitePage from "../app/sites/new/page";
import SiteDetailPage from "../app/sites/[id]/page";
import EditSitePage from "../app/sites/[id]/edit/page";
import { BrowserPushDispatchPanel } from "../app/sites/browser-push-dispatch-panel";
import { SiteAnalyticsPanel } from "../app/sites/site-analytics-panel";
import SubscribersPage from "../app/subscribers/page";
import SubscriberDetailPage from "../app/subscribers/[id]/page";

test("phase 2 dashboard pages exist", () => {
  assert.equal(typeof SitesPage, "function");
  assert.equal(typeof NewSitePage, "function");
  assert.equal(typeof SiteDetailPage, "function");
  assert.equal(typeof EditSitePage, "function");
  assert.equal(typeof BrowserPushDispatchPanel, "function");
  assert.equal(typeof SiteAnalyticsPanel, "function");
  assert.equal(typeof SubscribersPage, "function");
  assert.equal(typeof SubscriberDetailPage, "function");
});
