import { Badge } from "@shopify/polaris";

interface StatusBadgeProps {
  status: string;
}

const statusMap: Record<string, { tone: "success" | "info" | "warning" | "critical"; label: string }> = {
  active: { tone: "success", label: "Active" },
  draft: { tone: "info", label: "Draft" },
  scheduled: { tone: "warning", label: "Scheduled" },
  archived: { tone: "info", label: "Archived" },
  expired: { tone: "critical", label: "Expired" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status] || { tone: "info" as const, label: status };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function getStatusBadgeConfig(status: string) {
  return statusMap[status] || { tone: "info" as const, label: status };
}