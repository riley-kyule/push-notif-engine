import type { SiteSummary } from "../../app/sites/sites.utils";

export interface BrowserPushDemoNotification {
  title: string;
  body: string;
  url: string;
  icon: string;
  image: string | null;
}

export interface BrowserPushDemoMessage {
  type: "browser-push-demo";
  notification: BrowserPushDemoNotification;
}

export function buildBrowserPushDemoMessage(site: Pick<SiteSummary, "name" | "url">): BrowserPushDemoMessage {
  const origin = new URL(site.url).origin;

  return {
    type: "browser-push-demo",
    notification: {
      title: `${site.name} preview`,
      body: `Local browser push preview for ${site.name}.`,
      url: origin,
      icon: "/logo-icon.svg",
      image: null,
    },
  };
}
