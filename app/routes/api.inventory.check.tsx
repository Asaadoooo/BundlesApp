import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import type { InventoryCheckResponse, InventoryItemStatus } from "~/types/bundle";

// GraphQL query to check inventory for multiple variants
const INVENTORY_QUERY = `#graphql
  query GetInventory($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        sku
        inventoryQuantity
        availableForSale
        product {
          id
          title
        }
        inventoryItem {
          id
          tracked
          inventoryLevels(first: 10) {
            edges {
              node {
                available
                location {
                  id
                  name
                  isActive
                }
              }
            }
          }
        }
      }
    }
  }
`;

// GET /api/inventory/check - Check availability for bundle
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const bundleId = url.searchParams.get("bundleId");
  const quantity = parseInt(url.searchParams.get("quantity") || "1");

  // Get selected items from query params (JSON encoded)
  const selectedItemsParam = url.searchParams.get("selectedItems");
  let selectedItems: Array<{
    productId: string;
    variantId: string;
    quantity: number;
  }> = [];

  if (selectedItemsParam) {
    try {
      selectedItems = JSON.parse(selectedItemsParam);
    } catch {
      return Response.json({ error: "Invalid selectedItems format" }, { status: 400 });
    }
  }

  try {
    // If bundleId provided, get bundle items
    if (bundleId && selectedItems.length === 0) {
      const bundle = await prisma.bundle.findFirst({
        where: { id: bundleId, shop },
        include: {
          items: true,
        },
      });

      if (!bundle) {
        return Response.json({ error: "Bundle not found" }, { status: 404 });
      }

      // Convert bundle items to selected items format
      selectedItems = bundle.items.map((item) => ({
        productId: item.shopifyProductId,
        variantId: item.shopifyVariantId || "",
        quantity: item.quantity,
      }));
    }

    if (selectedItems.length === 0) {
      return Response.json({ error: "No items to check" }, { status: 400 });
    }

    // Get variant IDs for inventory check
    const variantIds = selectedItems
      .filter((item) => item.variantId)
      .map((item) =>
        item.variantId.startsWith("gid://")
          ? item.variantId
          : `gid://shopify/ProductVariant/${item.variantId}`
      );

    // For items without variant IDs, we need to fetch the product's default variant
    const productIdsWithoutVariants = selectedItems
      .filter((item) => !item.variantId)
      .map((item) =>
        item.productId.startsWith("gid://")
          ? item.productId
          : `gid://shopify/Product/${item.productId}`
      );

    // Fetch product variants for items without specific variants
    if (productIdsWithoutVariants.length > 0) {
      const productQuery = `#graphql
        query GetProducts($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              variants(first: 1) {
                edges {
                  node {
                    id
                  }
                }
              }
            }
          }
        }
      `;

      const productResponse = await admin.graphql(productQuery, {
        variables: { ids: productIdsWithoutVariants },
      });
      const productJson = await productResponse.json();

      if (productJson.data?.nodes) {
        for (const product of productJson.data.nodes) {
          if (product?.variants?.edges?.[0]?.node?.id) {
            variantIds.push(product.variants.edges[0].node.id);
          }
        }
      }
    }

    if (variantIds.length === 0) {
      return Response.json({
        isAvailable: false,
        availableQuantity: 0,
        items: [],
        limitingItem: null,
      } as InventoryCheckResponse);
    }

    // Fetch inventory for all variants
    const inventoryResponse = await admin.graphql(INVENTORY_QUERY, {
      variables: { ids: variantIds },
    });
    const inventoryJson = await inventoryResponse.json();

    if (inventoryJson.errors) {
      console.error("GraphQL errors:", inventoryJson.errors);
      return Response.json(
        { error: "Failed to check inventory", details: inventoryJson.errors },
        { status: 500 }
      );
    }

    // Process inventory data
    const items: InventoryItemStatus[] = [];
    let minAvailableBundles = Infinity;
    let limitingItem: InventoryItemStatus | null = null;

    for (const node of inventoryJson.data.nodes) {
      if (!node) continue;

      // Find the matching selected item
      const selectedItem = selectedItems.find(
        (item) =>
          node.id === item.variantId ||
          node.id === `gid://shopify/ProductVariant/${item.variantId}` ||
          node.product?.id === item.productId ||
          node.product?.id === `gid://shopify/Product/${item.productId}`
      );

      const requiredQuantity = (selectedItem?.quantity || 1) * quantity;
      const availableQuantity = node.inventoryQuantity || 0;

      const itemStatus: InventoryItemStatus = {
        productId: node.product?.id || "",
        variantId: node.id,
        title: `${node.product?.title || ""} - ${node.title || ""}`.trim(),
        available: availableQuantity,
        required: requiredQuantity,
        isLimiting: false,
      };

      // Calculate how many complete bundles this item can fulfill
      const bundlesAvailable =
        requiredQuantity > 0
          ? Math.floor(availableQuantity / requiredQuantity)
          : Infinity;

      if (bundlesAvailable < minAvailableBundles) {
        minAvailableBundles = bundlesAvailable;
        // Reset previous limiting item
        if (limitingItem) {
          const prevItem = items.find((i) => i.variantId === limitingItem?.variantId);
          if (prevItem) prevItem.isLimiting = false;
        }
        itemStatus.isLimiting = true;
        limitingItem = itemStatus;
      }

      items.push(itemStatus);
    }

    // Handle case where no items were found
    if (items.length === 0) {
      return Response.json({
        isAvailable: false,
        availableQuantity: 0,
        items: [],
        limitingItem: null,
      } as InventoryCheckResponse);
    }

    const response: InventoryCheckResponse = {
      isAvailable: minAvailableBundles > 0,
      availableQuantity: minAvailableBundles === Infinity ? 0 : minAvailableBundles,
      items,
      limitingItem,
    };

    // Update inventory snapshot if bundleId provided
    if (bundleId) {
      await prisma.bundleInventorySnapshot.create({
        data: {
          bundleId,
          isAvailable: response.isAvailable,
          availableCount: response.availableQuantity,
          limitingProduct: limitingItem?.productId || null,
          limitingVariant: limitingItem?.variantId || null,
          limitingStock: limitingItem?.available || null,
        },
      });
    }

    return Response.json(response);
  } catch (error) {
    console.error("Error checking inventory:", error);
    return Response.json(
      { error: "Failed to check inventory", details: String(error) },
      { status: 500 }
    );
  }
};
