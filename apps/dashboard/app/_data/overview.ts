import { apiJson } from "../../lib/server-api";

export interface DashboardOverview {
  totalSites: number;
  totalSubscribers: number;
  activeSubscribers: number;
  activeCampaigns: number;
  totalCampaigns: number;
  totalPending: number;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalClicked: number;
  deliveryRate: number;
  clickThroughRate: number;
}

const emptyOverview: DashboardOverview = {
  totalSites: 0,
  totalSubscribers: 0,
  activeSubscribers: 0,
  activeCampaigns: 0,
  totalCampaigns: 0,
  totalPending: 0,
  totalSent: 0,
  totalDelivered: 0,
  totalFailed: 0,
  totalClicked: 0,
  deliveryRate: 0,
  clickThroughRate: 0,
};

interface OverviewApiResponse {
  success: true;
  data: DashboardOverview;
}

export async function getDashboardOverview(days = 30): Promise<DashboardOverview> {
  const response = await apiJson<OverviewApiResponse>(`/analytics/overview?days=${days}`);
  return response?.data ?? emptyOverview;
}
