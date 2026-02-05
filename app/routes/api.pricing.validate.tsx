import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { BundleType, type ValidationError } from "~/types/bundle";

interface ValidatePricingRequest {
  bundleId: string;
  selectedItems?: Array<{
    productId: string;
    variantId: string;
    quantity: number;
    price: number;
  }>;
  tierId?: string;
  quantity?: number;
}

// POST /api/pricing/validate - Validate bundle pricing rules
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body: ValidatePricingRequest = await request.json();
    const { bundleId, selectedItems = [], tierId, quantity = 1 } = body;

    if (!bundleId) {
      return Response.json({ error: "Bundle ID is required" }, { status: 400 });
    }

    // Fetch bundle with all relations
    const bundle = await prisma.bundle.findFirst({
      where: { id: bundleId, shop },
      include: {
        items: true,
        tiers: true,
        volumeRules: true,
        categories: {
          include: { items: true },
        },
      },
    });

    if (!bundle) {
      return Response.json({ error: "Bundle not found" }, { status: 404 });
    }

    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Validate based on bundle type
    switch (bundle.type) {
      case BundleType.FIXED:
        // Fixed bundles should have all required items
        const requiredItems = bundle.items.filter((item) => item.isRequired);
        for (const requiredItem of requiredItems) {
          const selected = selectedItems.find(
            (s) =>
              s.variantId === requiredItem.shopifyVariantId ||
              s.productId === requiredItem.shopifyProductId
          );

          if (!selected) {
            errors.push({
              field: "selectedItems",
              message: `Required item missing: ${requiredItem.productTitle}`,
              code: "REQUIRED_ITEM_MISSING",
            });
          } else if (selected.quantity < requiredItem.quantity) {
            errors.push({
              field: "selectedItems",
              message: `Insufficient quantity for ${requiredItem.productTitle}: need ${requiredItem.quantity}, got ${selected.quantity}`,
              code: "INSUFFICIENT_QUANTITY",
            });
          }
        }

        // Check if bundle has valid pricing
        if (bundle.price === null && bundle.discountType === null) {
          errors.push({
            field: "price",
            message: "Bundle has no price or discount configured",
            code: "NO_PRICING",
          });
        }
        break;

      case BundleType.MIX_MATCH:
        // Validate min/max product selection
        const totalProducts = selectedItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        );

        if (bundle.minProducts && totalProducts < bundle.minProducts) {
          errors.push({
            field: "selectedItems",
            message: `Minimum ${bundle.minProducts} products required, got ${totalProducts}`,
            code: "MIN_PRODUCTS",
          });
        }

        if (bundle.maxProducts && totalProducts > bundle.maxProducts) {
          errors.push({
            field: "selectedItems",
            message: `Maximum ${bundle.maxProducts} products allowed, got ${totalProducts}`,
            code: "MAX_PRODUCTS",
          });
        }

        // Validate category constraints
        for (const category of bundle.categories) {
          const categoryItems = selectedItems.filter((selected) =>
            category.items.some(
              (catItem) =>
                catItem.shopifyVariantId === selected.variantId ||
                catItem.shopifyProductId === selected.productId
            )
          );

          const categoryTotal = categoryItems.reduce(
            (sum, item) => sum + item.quantity,
            0
          );

          if (category.minSelect && categoryTotal < category.minSelect) {
            errors.push({
              field: "categories",
              message: `${category.name}: minimum ${category.minSelect} items required, got ${categoryTotal}`,
              code: "CATEGORY_MIN",
            });
          }

          if (category.maxSelect && categoryTotal > category.maxSelect) {
            errors.push({
              field: "categories",
              message: `${category.name}: maximum ${category.maxSelect} items allowed, got ${categoryTotal}`,
              code: "CATEGORY_MAX",
            });
          }
        }

        // Validate duplicate selection if not allowed
        if (!bundle.allowDuplicates) {
          const variantCounts = new Map<string, number>();
          for (const item of selectedItems) {
            const key = item.variantId || item.productId;
            variantCounts.set(key, (variantCounts.get(key) || 0) + item.quantity);
          }

          for (const [key, count] of variantCounts) {
            if (count > 1) {
              errors.push({
                field: "selectedItems",
                message: `Duplicate selection not allowed: ${key}`,
                code: "NO_DUPLICATES",
              });
            }
          }
        }
        break;

      case BundleType.VOLUME:
        // Validate volume rules exist
        if (bundle.volumeRules.length === 0) {
          errors.push({
            field: "volumeRules",
            message: "No volume discount rules configured",
            code: "NO_RULES",
          });
        } else {
          // Check if quantity qualifies for any discount
          const totalQty = selectedItems.reduce(
            (sum, item) => sum + item.quantity,
            0
          ) * quantity;

          const qualifyingRule = bundle.volumeRules.find(
            (rule) =>
              totalQty >= rule.minQuantity &&
              (rule.maxQuantity === null || totalQty <= rule.maxQuantity)
          );

          if (!qualifyingRule) {
            const minQty = Math.min(...bundle.volumeRules.map((r) => r.minQuantity));
            warnings.push(
              `Current quantity (${totalQty}) does not qualify for any discount. Minimum ${minQty} required.`
            );
          }
        }

        // Validate same product restriction
        if (bundle.applyToSameProduct) {
          const productIds = new Set(selectedItems.map((item) => item.productId));
          if (productIds.size > 1) {
            errors.push({
              field: "selectedItems",
              message: "Volume discount applies only to the same product",
              code: "SAME_PRODUCT_REQUIRED",
            });
          }
        }
        break;

      case BundleType.TIERED:
        // Validate tier selection
        if (!tierId) {
          errors.push({
            field: "tierId",
            message: "Please select a tier",
            code: "TIER_REQUIRED",
          });
        } else {
          const selectedTier = bundle.tiers.find((t) => t.id === tierId);

          if (!selectedTier) {
            errors.push({
              field: "tierId",
              message: "Invalid tier selected",
              code: "INVALID_TIER",
            });
          } else {
            // Validate product count for tier
            const tierProductCount = selectedItems.reduce(
              (sum, item) => sum + item.quantity,
              0
            );

            if (tierProductCount !== selectedTier.productCount) {
              errors.push({
                field: "selectedItems",
                message: `${selectedTier.name} requires exactly ${selectedTier.productCount} products, got ${tierProductCount}`,
                code: "TIER_PRODUCT_COUNT",
              });
            }

            // Validate allowed products if specified
            if (selectedTier.allowedProducts) {
              const allowedIds = JSON.parse(selectedTier.allowedProducts);
              if (Array.isArray(allowedIds) && allowedIds.length > 0) {
                for (const item of selectedItems) {
                  const isAllowed =
                    allowedIds.includes(item.productId) ||
                    allowedIds.includes(item.variantId);

                  if (!isAllowed) {
                    errors.push({
                      field: "selectedItems",
                      message: `Product not available in ${selectedTier.name} tier`,
                      code: "PRODUCT_NOT_IN_TIER",
                    });
                    break;
                  }
                }
              }
            }
          }
        }
        break;
    }

    // Common validations
    if (quantity < 1) {
      errors.push({
        field: "quantity",
        message: "Quantity must be at least 1",
        code: "MIN_QUANTITY",
      });
    }

    // Validate prices are positive
    for (const item of selectedItems) {
      if (item.price < 0) {
        errors.push({
          field: "selectedItems",
          message: `Invalid price for item: ${item.productId}`,
          code: "INVALID_PRICE",
        });
      }
    }

    return Response.json({
      isValid: errors.length === 0,
      errors,
      warnings,
    });
  } catch (error) {
    console.error("Error validating pricing:", error);
    return Response.json(
      { error: "Failed to validate pricing", details: String(error) },
      { status: 500 }
    );
  }
};
