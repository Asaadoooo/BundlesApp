import type { Bundle, BundleItem, VolumeRule, BundleTier } from "@prisma/client";
import {
  BundleType,
  DiscountType,
  type PricingCalculationResponse,
  type SelectedItem,
  type ItemPrice,
  type AppliedDiscount,
  type ValidationResult,
  type ValidationError,
} from "~/types/bundle";

// Generate URL-friendly handle from title
export function generateHandle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}

// Normalize Shopify Product ID - handles both GID and numeric formats
// Example: "gid://shopify/Product/8984540053667" -> "8984540053667"
// Example: "8984540053667" -> "8984540053667"
export function normalizeProductId(id: string): string {
  if (id.startsWith('gid://shopify/Product/')) {
    return id.replace('gid://shopify/Product/', '');
  }
  return id;
}

// Check if two product IDs match (handles GID vs numeric comparison)
export function productIdsMatch(id1: string | null, id2: string | null): boolean {
  if (!id1 || !id2) return false;
  return normalizeProductId(id1) === normalizeProductId(id2);
}

// Calculate pricing for a bundle
export function calculateBundlePricing(
  bundle: Bundle & {
    items: BundleItem[];
    volumeRules: VolumeRule[];
    tiers: BundleTier[];
  },
  selectedItems: SelectedItem[],
  tierId?: string,
  quantity: number = 1
): PricingCalculationResponse {
  const errors: string[] = [];
  let isValid = true;

  // Calculate original price from selected items
  let originalPrice = 0;
  const itemPrices: ItemPrice[] = [];

  for (const item of selectedItems) {
    const itemTotal = item.price * item.quantity;
    originalPrice += itemTotal;

    itemPrices.push({
      productId: item.productId,
      variantId: item.variantId,
      originalPrice: item.price,
      discountedPrice: item.price, // Will be updated based on discount
      quantity: item.quantity,
    });
  }

  // Multiply by bundle quantity
  originalPrice *= quantity;

  let discountedPrice = originalPrice;
  let appliedDiscount: AppliedDiscount | null = null;

  // Apply discount based on bundle type
  switch (bundle.type) {
    case BundleType.FIXED:
      // Fixed bundles have a set price
      if (bundle.price !== null) {
        discountedPrice = bundle.price * quantity;
        appliedDiscount = {
          type: DiscountType.FIXED_PRICE,
          value: bundle.price,
          label: `Bundle price: €${bundle.price.toFixed(2)}`,
        };
      } else if (
        bundle.discountType &&
        bundle.discountValue !== null
      ) {
        const result = applyDiscount(
          originalPrice,
          bundle.discountType as DiscountType,
          bundle.discountValue
        );
        discountedPrice = result.discountedPrice;
        appliedDiscount = result.appliedDiscount;
      }
      break;

    case BundleType.MIX_MATCH:
      // Mix & match uses discount rules
      if (bundle.discountType && bundle.discountValue !== null) {
        const result = applyDiscount(
          originalPrice,
          bundle.discountType as DiscountType,
          bundle.discountValue
        );
        discountedPrice = result.discountedPrice;
        appliedDiscount = result.appliedDiscount;
      }

      // Validate min/max products
      const totalProducts = selectedItems.reduce((sum, i) => sum + i.quantity, 0);
      if (bundle.minProducts && totalProducts < bundle.minProducts) {
        isValid = false;
        errors.push(`Minimum ${bundle.minProducts} products required`);
      }
      if (bundle.maxProducts && totalProducts > bundle.maxProducts) {
        isValid = false;
        errors.push(`Maximum ${bundle.maxProducts} products allowed`);
      }
      break;

    case BundleType.VOLUME:
      // Find applicable volume rule based on quantity
      const totalQuantity = selectedItems.reduce((sum, i) => sum + i.quantity, 0) * quantity;
      const applicableRule = findApplicableVolumeRule(bundle.volumeRules, totalQuantity);

      if (applicableRule) {
        const result = applyDiscount(
          originalPrice,
          applicableRule.discountType as DiscountType,
          applicableRule.discountValue
        );
        discountedPrice = result.discountedPrice;
        appliedDiscount = {
          ...result.appliedDiscount!,
          label: applicableRule.label || result.appliedDiscount!.label,
        };
      }
      break;

    case BundleType.TIERED:
      // Tiered bundles use the selected tier's price
      if (tierId) {
        const selectedTier = bundle.tiers.find((t) => t.id === tierId);
        if (selectedTier) {
          discountedPrice = selectedTier.price * quantity;
          appliedDiscount = {
            type: DiscountType.FIXED_PRICE,
            value: selectedTier.price,
            label: `${selectedTier.name}: €${selectedTier.price.toFixed(2)}`,
          };

          // Validate product count for tier
          const tierProductCount = selectedItems.reduce((sum, i) => sum + i.quantity, 0);
          if (tierProductCount !== selectedTier.productCount) {
            isValid = false;
            errors.push(
              `${selectedTier.name} requires exactly ${selectedTier.productCount} products`
            );
          }
        } else {
          isValid = false;
          errors.push("Invalid tier selected");
        }
      } else {
        isValid = false;
        errors.push("Please select a tier");
      }
      break;
  }

  // Update item prices based on discount ratio
  if (appliedDiscount && originalPrice > 0) {
    const discountRatio = discountedPrice / originalPrice;
    for (const itemPrice of itemPrices) {
      itemPrice.discountedPrice = itemPrice.originalPrice * discountRatio;
    }
  }

  const savingsAmount = originalPrice - discountedPrice;
  const savingsPercent = originalPrice > 0 ? (savingsAmount / originalPrice) * 100 : 0;

  return {
    originalPrice,
    discountedPrice,
    savingsAmount,
    savingsPercent,
    itemPrices,
    appliedDiscount,
    isValid,
    validationErrors: errors,
  };
}

// Apply discount based on type
function applyDiscount(
  originalPrice: number,
  discountType: DiscountType,
  discountValue: number
): { discountedPrice: number; appliedDiscount: AppliedDiscount } {
  let discountedPrice: number;
  let label: string;

  switch (discountType) {
    case DiscountType.PERCENTAGE:
      discountedPrice = originalPrice * (1 - discountValue / 100);
      label = `${discountValue}% off`;
      break;

    case DiscountType.FIXED_AMOUNT:
      discountedPrice = Math.max(0, originalPrice - discountValue);
      label = `€${discountValue.toFixed(2)} off`;
      break;

    case DiscountType.FIXED_PRICE:
      discountedPrice = discountValue;
      label = `€${discountValue.toFixed(2)}`;
      break;

    case DiscountType.FIXED_PRICE_PER_ITEM:
      // This requires knowing item count, handle specially
      discountedPrice = originalPrice; // Will be calculated per item
      label = `€${discountValue.toFixed(2)} per item`;
      break;

    default:
      discountedPrice = originalPrice;
      label = "";
  }

  return {
    discountedPrice,
    appliedDiscount: {
      type: discountType,
      value: discountValue,
      label,
    },
  };
}

// Find the applicable volume rule for a given quantity
function findApplicableVolumeRule(
  rules: VolumeRule[],
  quantity: number
): VolumeRule | null {
  // Sort rules by minQuantity descending to find the highest applicable tier
  const sortedRules = [...rules].sort((a, b) => b.minQuantity - a.minQuantity);

  for (const rule of sortedRules) {
    if (quantity >= rule.minQuantity) {
      if (rule.maxQuantity === null || quantity <= rule.maxQuantity) {
        return rule;
      }
    }
  }

  return null;
}

// Validate bundle configuration
export function validateBundle(
  bundle: Partial<Bundle> & {
    items?: BundleItem[];
    volumeRules?: VolumeRule[];
    tiers?: BundleTier[];
  }
): ValidationResult {
  const errors: ValidationError[] = [];

  // Basic validation
  if (!bundle.title || bundle.title.trim() === "") {
    errors.push({
      field: "title",
      message: "Title is required",
      code: "REQUIRED",
    });
  }

  if (!bundle.type) {
    errors.push({
      field: "type",
      message: "Bundle type is required",
      code: "REQUIRED",
    });
  }

  // Type-specific validation
  switch (bundle.type) {
    case BundleType.FIXED:
      if (!bundle.items || bundle.items.length === 0) {
        errors.push({
          field: "items",
          message: "Fixed bundles must have at least one item",
          code: "MIN_ITEMS",
        });
      }
      if (bundle.price === null && bundle.discountType === null) {
        errors.push({
          field: "price",
          message: "Fixed bundles must have a price or discount",
          code: "REQUIRED",
        });
      }
      break;

    case BundleType.MIX_MATCH:
      if (!bundle.items || bundle.items.length === 0) {
        errors.push({
          field: "items",
          message: "Mix & Match bundles must have available items",
          code: "MIN_ITEMS",
        });
      }
      if (bundle.minProducts && bundle.maxProducts) {
        if (bundle.minProducts > bundle.maxProducts) {
          errors.push({
            field: "minProducts",
            message: "Minimum products cannot exceed maximum",
            code: "INVALID_RANGE",
          });
        }
      }
      break;

    case BundleType.VOLUME:
      if (!bundle.volumeRules || bundle.volumeRules.length === 0) {
        errors.push({
          field: "volumeRules",
          message: "Volume bundles must have at least one discount rule",
          code: "MIN_RULES",
        });
      }
      break;

    case BundleType.TIERED:
      if (!bundle.tiers || bundle.tiers.length === 0) {
        errors.push({
          field: "tiers",
          message: "Tiered bundles must have at least one tier",
          code: "MIN_TIERS",
        });
      }
      break;
  }

  // Scheduling validation
  if (bundle.startDate && bundle.endDate) {
    if (new Date(bundle.startDate) >= new Date(bundle.endDate)) {
      errors.push({
        field: "endDate",
        message: "End date must be after start date",
        code: "INVALID_DATE_RANGE",
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Format bundle data for storefront consumption
export async function formatBundleForStorefront(
  bundle: Bundle & {
    items: BundleItem[];
    volumeRules: VolumeRule[];
    tiers: BundleTier[];
  }
) {
  // Calculate total original price
  let totalOriginalPrice = 0;
  let totalCompareAtPrice = 0;

  const formattedItems = bundle.items.map((item) => {
    // In a real implementation, you'd fetch product data from Shopify here
    // For now, we'll use placeholder data
    const itemPrice = 0; // This should be fetched from Shopify API
    totalOriginalPrice += itemPrice * item.quantity;

    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      position: item.position,
      isOptional: item.isOptional,
      isPreselected: item.isPreselected,
      // Product data would be fetched from Shopify API
      product: null,
    };
  });

  // Calculate bundle pricing
  const selectedItems = bundle.items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId || '',
    quantity: item.quantity,
    price: 0, // This should be fetched from Shopify
  }));

  const pricing = calculateBundlePricing(bundle, selectedItems);

  return {
    id: bundle.id,
    shopifyProductId: bundle.shopifyProductId,
    title: bundle.title,
    description: bundle.description,
    type: bundle.type,
    status: bundle.status,
    discountType: bundle.discountType,
    discountValue: bundle.discountValue,
    compareAtPrice: bundle.compareAtPrice,
    startDate: bundle.startDate,
    endDate: bundle.endDate,
    showIndividualPrices: bundle.showIndividualPrices,
    allowCustomization: bundle.allowCustomization,
    continueWhenOutOfStock: bundle.continueWhenOutOfStock,
    items: formattedItems,
    images: [], // Images would be fetched from bundle configuration
    minSelections: bundle.minProducts,
    maxSelections: bundle.maxProducts,
    totalPrice: pricing.discountedPrice,
    totalCompareAtPrice: pricing.originalPrice,
    savings: pricing.savingsAmount,
    savingsPercentage: pricing.savingsPercent,
    isAvailable: true, // This should check inventory
    stockLevel: null, // This should check inventory
  };
}

// Re-export client-safe functions from shared utility
export {
  formatPrice,
  formatSavings,
  getEffectiveStatus,
  isBundleScheduleActive,
} from "~/utils/bundle";

