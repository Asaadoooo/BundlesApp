import { Badge } from "@shopify/polaris";

interface BundleTypeBadgeProps {
  type: string;
}

const typeMap: Record<string, string> = {
  FIXED: "Fixed Bundle",
  MIX_MATCH: "Mix & Match",
  VOLUME: "Volume Discount",
  TIERED: "Tiered Bundle",
};

export function BundleTypeBadge({ type }: BundleTypeBadgeProps) {
  const label = typeMap[type] || type;
  return <Badge tone="info">{label}</Badge>;
}

export function getBundleTypeLabel(type: string) {
  return typeMap[type] || type;
}
