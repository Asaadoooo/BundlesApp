import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { generateHandle, validateBundle } from "~/utils/bundle.server";

// GET /api/bundles/:id - Get bundle details
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { id } = params;

  if (!id) {
    return Response.json({ error: "Bundle ID is required" }, { status: 400 });
  }

  const bundle = await prisma.bundle.findFirst({
    where: { id, shop },
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
  });

  if (!bundle) {
    return Response.json({ error: "Bundle not found" }, { status: 404 });
  }

  // Parse allowedProducts JSON for tiers
  const bundleWithParsedTiers = {
    ...bundle,
    tiers: bundle.tiers.map((tier) => ({
      ...tier,
      allowedProducts: tier.allowedProducts
        ? JSON.parse(tier.allowedProducts)
        : null,
    })),
  };

  return Response.json({ data: bundleWithParsedTiers });
};

// PUT /api/bundles/:id - Update bundle
// DELETE /api/bundles/:id - Delete bundle
export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { id } = params;

  if (!id) {
    return Response.json({ error: "Bundle ID is required" }, { status: 400 });
  }

  // Verify bundle belongs to shop
  const existingBundle = await prisma.bundle.findFirst({
    where: { id, shop },
  });

  if (!existingBundle) {
    return Response.json({ error: "Bundle not found" }, { status: 404 });
  }

  // Handle DELETE
  if (request.method === "DELETE") {
    await prisma.bundle.delete({ where: { id } });
    return Response.json({ success: true });
  }

  // Handle PUT (Update)
  if (request.method === "PUT") {
    try {
      const body = await request.json();
      const {
        title,
        description,
        type,
        status,
        compareAtPrice,
        price,
        discountType,
        discountValue,
        showCompareAtPrice,
        showSavingsAmount,
        showSavingsPercent,
        trackInventory,
        continueWhenOutOfStock,
        minProducts,
        maxProducts,
        allowDuplicates,
        applyToSameProduct,
        combineWithDiscounts,
        startDate,
        endDate,
        metaTitle,
        metaDescription,
        imageUrl,
        items,
        tiers,
        volumeRules,
        categories,
      } = body;

      // Build update data
      const updateData: Record<string, unknown> = {};

      if (title !== undefined) {
        updateData.title = title;
        // Update handle if title changed
        if (title !== existingBundle.title) {
          let newHandle = generateHandle(title);
          const existingWithHandle = await prisma.bundle.findUnique({
            where: { shop_handle: { shop, handle: newHandle } },
          });
          if (existingWithHandle && existingWithHandle.id !== id) {
            newHandle = `${newHandle}-${Date.now()}`;
          }
          updateData.handle = newHandle;
        }
      }

      if (description !== undefined) updateData.description = description;
      if (type !== undefined) updateData.type = type;
      if (status !== undefined) updateData.status = status;
      if (compareAtPrice !== undefined)
        updateData.compareAtPrice = compareAtPrice;
      if (price !== undefined) updateData.price = price;
      if (discountType !== undefined) updateData.discountType = discountType;
      if (discountValue !== undefined) updateData.discountValue = discountValue;
      if (showCompareAtPrice !== undefined)
        updateData.showCompareAtPrice = showCompareAtPrice;
      if (showSavingsAmount !== undefined)
        updateData.showSavingsAmount = showSavingsAmount;
      if (showSavingsPercent !== undefined)
        updateData.showSavingsPercent = showSavingsPercent;
      if (trackInventory !== undefined)
        updateData.trackInventory = trackInventory;
      if (continueWhenOutOfStock !== undefined)
        updateData.continueWhenOutOfStock = continueWhenOutOfStock;
      if (minProducts !== undefined) updateData.minProducts = minProducts;
      if (maxProducts !== undefined) updateData.maxProducts = maxProducts;
      if (allowDuplicates !== undefined)
        updateData.allowDuplicates = allowDuplicates;
      if (applyToSameProduct !== undefined)
        updateData.applyToSameProduct = applyToSameProduct;
      if (combineWithDiscounts !== undefined)
        updateData.combineWithDiscounts = combineWithDiscounts;
      if (startDate !== undefined)
        updateData.startDate = startDate ? new Date(startDate) : null;
      if (endDate !== undefined)
        updateData.endDate = endDate ? new Date(endDate) : null;
      if (metaTitle !== undefined) updateData.metaTitle = metaTitle;
      if (metaDescription !== undefined)
        updateData.metaDescription = metaDescription;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

      // Validate bundle
      const validation = validateBundle({
        ...existingBundle,
        ...updateData,
        items: items,
        volumeRules: volumeRules,
        tiers: tiers,
      } as any);

      if (!validation.isValid) {
        return Response.json(
          { error: "Validation failed", errors: validation.errors },
          { status: 400 }
        );
      }

      // Update bundle
      const bundle = await prisma.bundle.update({
        where: { id },
        data: updateData,
      });

      // Update items if provided
      if (items !== undefined) {
        // Delete existing items
        await prisma.bundleItem.deleteMany({ where: { bundleId: id } });

        // Create new items
        if (items.length > 0) {
          await prisma.bundleItem.createMany({
            data: items.map((item: any, index: number) => ({
              bundleId: id,
              shopifyProductId: item.shopifyProductId,
              shopifyVariantId: item.shopifyVariantId,
              productTitle: item.productTitle,
              variantTitle: item.variantTitle,
              productImage: item.productImage,
              sku: item.sku,
              quantity: item.quantity || 1,
              position: item.position ?? index,
              isRequired: item.isRequired ?? true,
              originalPrice: item.originalPrice,
              discountedPrice: item.discountedPrice,
              minQuantity: item.minQuantity || 0,
              maxQuantity: item.maxQuantity,
              categoryId: item.categoryId,
            })),
          });
        }
      }

      // Update tiers if provided
      if (tiers !== undefined) {
        await prisma.bundleTier.deleteMany({ where: { bundleId: id } });

        if (tiers.length > 0) {
          await prisma.bundleTier.createMany({
            data: tiers.map((tier: any, index: number) => ({
              bundleId: id,
              name: tier.name,
              description: tier.description,
              position: tier.position ?? index,
              price: tier.price,
              compareAtPrice: tier.compareAtPrice,
              productCount: tier.productCount,
              allowedProducts: tier.allowedProducts
                ? JSON.stringify(tier.allowedProducts)
                : null,
              featured: tier.featured || false,
              badgeText: tier.badgeText,
              imageUrl: tier.imageUrl,
            })),
          });
        }
      }

      // Update volume rules if provided
      if (volumeRules !== undefined) {
        await prisma.volumeRule.deleteMany({ where: { bundleId: id } });

        if (volumeRules.length > 0) {
          await prisma.volumeRule.createMany({
            data: volumeRules.map((rule: any, index: number) => ({
              bundleId: id,
              minQuantity: rule.minQuantity,
              maxQuantity: rule.maxQuantity,
              discountType: rule.discountType,
              discountValue: rule.discountValue,
              label: rule.label,
              position: rule.position ?? index,
            })),
          });
        }
      }

      // Update categories if provided
      if (categories !== undefined) {
        // First delete items in categories, then categories
        await prisma.bundleItem.updateMany({
          where: { bundleId: id, categoryId: { not: null } },
          data: { categoryId: null },
        });
        await prisma.bundleCategory.deleteMany({ where: { bundleId: id } });

        if (categories.length > 0) {
          for (let i = 0; i < categories.length; i++) {
            const category = categories[i];
            const createdCategory = await prisma.bundleCategory.create({
              data: {
                bundleId: id,
                name: category.name,
                description: category.description,
                position: category.position ?? i,
                minSelect: category.minSelect || 0,
                maxSelect: category.maxSelect,
                imageUrl: category.imageUrl,
                collapsed: category.collapsed || false,
              },
            });

            // Create items for this category
            if (category.items && category.items.length > 0) {
              await prisma.bundleItem.createMany({
                data: category.items.map((item: any, index: number) => ({
                  bundleId: id,
                  categoryId: createdCategory.id,
                  shopifyProductId: item.shopifyProductId,
                  shopifyVariantId: item.shopifyVariantId,
                  productTitle: item.productTitle,
                  variantTitle: item.variantTitle,
                  productImage: item.productImage,
                  sku: item.sku,
                  quantity: item.quantity || 1,
                  position: item.position ?? index,
                  isRequired: item.isRequired ?? false,
                  originalPrice: item.originalPrice,
                  discountedPrice: item.discountedPrice,
                  minQuantity: item.minQuantity || 0,
                  maxQuantity: item.maxQuantity,
                })),
              });
            }
          }
        }
      }

      // Fetch updated bundle
      const updatedBundle = await prisma.bundle.findUnique({
        where: { id },
        include: {
          items: { orderBy: { position: "asc" } },
          tiers: { orderBy: { position: "asc" } },
          volumeRules: { orderBy: { position: "asc" } },
          categories: {
            include: { items: { orderBy: { position: "asc" } } },
            orderBy: { position: "asc" },
          },
        },
      });

      return Response.json({ data: updatedBundle });
    } catch (error) {
      console.error("Error updating bundle:", error);
      return Response.json(
        { error: "Failed to update bundle", details: String(error) },
        { status: 500 }
      );
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};
