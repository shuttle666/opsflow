export type ActivityFeedTone = "brand" | "success" | "warning" | "neutral";

export type ActivityFeedItem = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  tone: ActivityFeedTone;
  targetType?: string;
  targetId?: string;
};

export type ActivityFeedPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
