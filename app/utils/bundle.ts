// Client-safe utility functions for bundles
// These can be imported in both server and client code

// Format price for display
export function formatPrice(price: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
  }).format(price);
}

// Calculate savings display text
export function formatSavings(
  originalPrice: number,
  discountedPrice: number,
  showPercent: boolean = false
): string {
  const savings = originalPrice - discountedPrice;
  const percent = (savings / originalPrice) * 100;

  if (showPercent) {
    return `Save ${percent.toFixed(0)}%`;
  }
  return `Save ${formatPrice(savings)}`;
}

// Check if bundle is currently active based on schedule
export function isBundleScheduleActive(bundle: {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}): boolean {
  const now = new Date();

  if (bundle.startDate && new Date(bundle.startDate) > now) {
    return false;
  }

  if (bundle.endDate && new Date(bundle.endDate) < now) {
    return false;
  }

  return true;
}

// Get effective status considering schedule
export function getEffectiveStatus(bundle: {
  status: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}): string {
  if (bundle.status === "archived") {
    return "archived";
  }

  if (bundle.status === "draft") {
    return "draft";
  }

  if (!isBundleScheduleActive(bundle)) {
    if (bundle.startDate && new Date(bundle.startDate) > new Date()) {
      return "scheduled";
    }
    return "expired";
  }

  return "active";
}
