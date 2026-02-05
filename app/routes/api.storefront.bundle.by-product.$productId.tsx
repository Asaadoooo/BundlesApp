import type { LoaderFunctionArgs } from "react-router";
import { unauthenticated } from "../shopify.server";
import prisma from "../db.server";
import type {
  StorefrontBundleResponse,
  StorefrontBundleItem,
  StorefrontBundleTier,
  StorefrontBundleCategory,
  StorefrontVolumeRule,
} from "~/types/bundle";
import { BundleType } from "~/types/bundle";
import { isBundleScheduleActive } from "~/utils/bundle.server";

// GraphQL query to get product prices and inventory
const PRODUCTS_QUERY = `#graphql
  query GetProducts($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        price
        compareAtPrice
        availableForSale
        quantityAvailable
        product {
          id
          title
          featuredImage {
            url
          }
        }
      }
    }
  }
`;

// GET /api/storefront/bundle/by-product/:productId - Find bundle containing this product
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { productId } = params;
  const url = new URL(request.url);

  // Debug: Log incoming request
  console.log("[Bundle API] by-product request received");
  console.log("[Bundle API] Product ID:", productId);
  console.log("[Bundle API] Full URL:", request.url);

  if (!productId) {
    console.log("[Bundle API] Error: No product ID provided");
    return Response.json({ error: "Product ID is required" }, { status: 400 });
  }

  // Get shop from query param or Shopify-Shop-Domain header (App Proxy adds this)
  const shopParam = url.searchParams.get("shop");
  const shopHeader = request.headers.get("Shopify-Shop-Domain");
  const shop = shopParam || shopHeader;

  console.log("[Bundle API] Shop param:", shopParam);
  console.log("[Bundle API] Shop header:", shopHeader);
  console.log("[Bundle API] Using shop:", shop);

  if (!shop) {
    console.log("[Bundle API] Error: No shop parameter");
    return Response.json(
      { error: "Shop parameter is required", debug: { shopParam, shopHeader } },
      { status: 400 }
    );
  }

  try {
    // Authenticate storefront request
    console.log("[Bundle API] Authenticating for shop:", shop);
    const { admin } = await unauthenticated.admin(shop);

    // Normalize product ID - handle both numeric and GID formats
    const normalizedProductId = productId.startsWith("gid://")
      ? productId
      : `gid://shopify/Product/${productId}`;

    console.log("[Bundle API] Normalized product ID:", normalizedProductId);
    console.log("[Bundle API] Searching for bundles containing this product...");

    // Find bundles that contain this product
    const bundleItems = await prisma.bundleItem.findMany({
      where: {
        shopifyProductId: {
          in: [productId, normalizedProductId],
        },
        bundle: {
          shop: shop,
          status: { in: ["active", "scheduled"] },
        },
      },
      include: {
        bundle: {
          include: {
            items: {
              orderBy: { position: "asc" },
            },
            tiers: {
              orderBy: { position: "asc" },
            },
            volumeRules: {
              orderBy: { position: "asc" },
            },
            categories: {
              include: {
                items: {
                  orderBy: { position: "asc" },
                },
              },
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });

    console.log("[Bundle API] Found bundle items:", bundleItems.length);

    if (bundleItems.length === 0) {
      console.log("[Bundle API] No bundles found for product:", productId);
      return Response.json(
        {
          error: "No bundle found for this product",
          debug: {
            productId,
            normalizedProductId,
            shop,
          }
        },
        { status: 404 }
      );
    }

    // Get the first active bundle (could be enhanced to return multiple)
    const bundleItem = bundleItems.find((item) =>
      isBundleScheduleActive(item.bundle)
    );

    if (!bundleItem) {
      console.log("[Bundle API] No currently active bundles");
      return Response.json(
        { error: "No active bundle found for this product" },
        { status: 404 }
      );
    }

    const bundle = bundleItem.bundle;
    console.log("[Bundle API] Found bundle:", bundle.title, "(ID:", bundle.id, ")");

    // Collect all variant IDs to fetch current prices
    const variantIds: string[] = [];
    for (const item of bundle.items) {
      if (item.shopifyVariantId) {
        const variantId = item.shopifyVariantId.startsWith("gid://")
          ? item.shopifyVariantId
          : `gid://shopify/ProductVariant/${item.shopifyVariantId}`;
        variantIds.push(variantId);
      }
    }

    console.log("[Bundle API] Fetching variant data for", variantIds.length, "variants");

    // Fetch current product data from Shopify
    const variantDataMap = new Map<
      string,
      {
        price: number;
        compareAtPrice: number | null;
        available: boolean;
        quantity: number;
        title: string;
        imageUrl: string | null;
        productTitle: string;
      }
    >();

    if (variantIds.length > 0) {
      const response = await admin.graphql(PRODUCTS_QUERY, {
        variables: { ids: variantIds },
      });
      const responseJson = await response.json();

      if (responseJson.data?.nodes) {
        for (const node of responseJson.data.nodes) {
          if (node) {
            variantDataMap.set(node.id, {
              price: parseFloat(node.price),
              compareAtPrice: node.compareAtPrice
                ? parseFloat(node.compareAtPrice)
                : null,
              available: node.availableForSale,
              quantity: node.quantityAvailable || 0,
              title: node.title,
              imageUrl: node.product?.featuredImage?.url || null,
              productTitle: node.product?.title || "",
            });
          }
        }
      }
    }

    // Transform items with current data
    const transformItem = (item: typeof bundle.items[0]): StorefrontBundleItem => {
      const variantId = item.shopifyVariantId?.startsWith("gid://")
        ? item.shopifyVariantId
        : `gid://shopify/ProductVariant/${item.shopifyVariantId}`;

      const variantData = variantDataMap.get(variantId);

      return {
        productId: item.shopifyProductId,
        variantId: item.shopifyVariantId,
        title: variantData?.productTitle || item.productTitle,
        variantTitle: variantData?.title || item.variantTitle,
        imageUrl: variantData?.imageUrl || item.productImage,
        price: variantData?.price || item.originalPrice || 0,
        compareAtPrice: variantData?.compareAtPrice || null,
        quantity: item.quantity,
        isRequired: item.isRequired,
        available: variantData?.available ?? true,
        availableQuantity: variantData?.quantity || 0,
      };
    };

    // Build response based on bundle type
    const items: StorefrontBundleItem[] = bundle.items
      .filter((item) => !item.categoryId)
      .map(transformItem);

    const categories: StorefrontBundleCategory[] = bundle.categories.map(
      (category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        minSelect: category.minSelect,
        maxSelect: category.maxSelect,
        imageUrl: category.imageUrl,
        items: category.items.map(transformItem),
      })
    );

    const tiers: StorefrontBundleTier[] = bundle.tiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      description: tier.description,
      price: tier.price,
      compareAtPrice: tier.compareAtPrice,
      productCount: tier.productCount,
      featured: tier.featured,
      badgeText: tier.badgeText,
      imageUrl: tier.imageUrl,
    }));

    const volumeRules: StorefrontVolumeRule[] = bundle.volumeRules.map((rule) => ({
      minQuantity: rule.minQuantity,
      maxQuantity: rule.maxQuantity,
      discountType: rule.discountType as any,
      discountValue: rule.discountValue,
      label: rule.label || `Buy ${rule.minQuantity}+ get ${rule.discountValue}% off`,
    }));

    // Calculate display pricing
    let displayPrice = bundle.price || 0;
    let compareAtPrice = bundle.compareAtPrice;
    let savingsAmount: number | null = null;
    let savingsPercent: number | null = null;

    if (bundle.type === BundleType.FIXED) {
      const totalOriginalPrice = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      if (bundle.price !== null) {
        displayPrice = bundle.price;
        compareAtPrice = totalOriginalPrice;
      } else if (totalOriginalPrice > 0) {
        compareAtPrice = totalOriginalPrice;
      }

      if (compareAtPrice && displayPrice < compareAtPrice) {
        savingsAmount = compareAtPrice - displayPrice;
        savingsPercent = (savingsAmount / compareAtPrice) * 100;
      }
    } else if (bundle.type === BundleType.TIERED && tiers.length > 0) {
      const lowestTier = tiers.reduce((min, tier) =>
        tier.price < min.price ? tier : min
      );
      displayPrice = lowestTier.price;
      compareAtPrice = lowestTier.compareAtPrice;

      if (compareAtPrice && displayPrice < compareAtPrice) {
        savingsAmount = compareAtPrice - displayPrice;
        savingsPercent = (savingsAmount / compareAtPrice) * 100;
      }
    }

    // Check overall availability
    const isAvailable = items.every(
      (item) => !item.isRequired || item.available
    );

    // Calculate available quantity
    let availableQuantity = Infinity;
    for (const item of items) {
      if (item.isRequired && item.quantity > 0) {
        const itemAvailable = Math.floor(item.availableQuantity / item.quantity);
        if (itemAvailable < availableQuantity) {
          availableQuantity = itemAvailable;
        }
      }
    }
    if (availableQuantity === Infinity) availableQuantity = 0;

    const response: StorefrontBundleResponse = {
      id: bundle.id,
      title: bundle.title,
      description: bundle.description,
      type: bundle.type as BundleType,
      imageUrl: bundle.imageUrl,
      displayPrice,
      compareAtPrice,
      savingsAmount,
      savingsPercent,
      isAvailable,
      availableQuantity,
      minProducts: bundle.minProducts || 0,
      maxProducts: bundle.maxProducts || 0,
    };

    // Add type-specific data
    if (bundle.type === BundleType.FIXED || bundle.type === BundleType.MIX_MATCH) {
      response.items = items;
    }

    if (bundle.type === BundleType.MIX_MATCH && categories.length > 0) {
      response.categories = categories;
    }

    if (bundle.type === BundleType.TIERED) {
      response.tiers = tiers;
      response.items = items;
    }

    if (bundle.type === BundleType.VOLUME) {
      response.volumeRules = volumeRules;
      response.items = items;
    }

    // Track view for analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.bundleAnalytics.upsert({
      where: {
        bundleId_date: {
          bundleId: bundle.id,
          date: today,
        },
      },
      update: {
        views: { increment: 1 },
      },
      create: {
        bundleId: bundle.id,
        date: today,
        views: 1,
      },
    });

    console.log("[Bundle API] Returning bundle response successfully");

    return Response.json(
      { bundle: response },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60",
        },
      }
    );
  } catch (error) {
    console.error("[Bundle API] Error:", error);
    return Response.json(
      {
        error: "Failed to fetch bundle",
        details: String(error),
        debug: {
          productId,
          shop,
        }
      },
      { status: 500 }
    );
  }
};
