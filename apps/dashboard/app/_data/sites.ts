import { apiJson } from "../../lib/server-api";

export interface SiteChoice {
  id: string;
  name: string;
  url: string;
  country: string;
  language: string;
  status: "active" | "inactive";
}

export const fallbackSiteChoices: SiteChoice[] = [
  {
    id: "site-1",
    name: "Exotic Africa",
    url: "https://exotic-africa.com",
    country: "South Africa",
    language: "en",
    status: "active",
  },
  {
    id: "site-2",
    name: "Zebra Travel",
    url: "https://zebra-travel.co.za",
    country: "Kenya",
    language: "en",
    status: "active",
  },
  {
    id: "site-3",
    name: "All Sites",
    url: "https://exotic.example",
    country: "Global",
    language: "en",
    status: "active",
  },
];

interface SiteApiResponse<T> {
  success: true;
  data: T;
}

export async function getSiteChoices(): Promise<SiteChoice[]> {
  const response = await apiJson<SiteApiResponse<{ items: SiteChoice[] }>>("/sites");
  return response?.data.items ?? fallbackSiteChoices;
}
