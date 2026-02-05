import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// GraphQL query for single product
const PRODUCT_QUERY = `#graphql
  query GetProduct($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      description
      descriptionHtml
      status
      totalInventory
      featuredImage {
        url
        altText
      }
      images(first: 10) {
        edges {
          node {
            url
            altText
          }
        }
      }
      priceRangeV2 {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            sku
            price
            compareAtPrice
            inventoryQuantity
            availableForSale
            selectedOptions {
              name
              value
            }
            image {
              url
              altText
            }
            inventoryItem {
              id
              tracked
              inventoryLevels(first: 10) {
                edges {
                  node {
                    id
                    available
                    location {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
      options {
        id
        name
        position
        values
      }
      tags
      vendor
      productType
      collections(first: 10) {
        edges {
          node {
            id
            title
            handle
          }
        }
      }
    }
  }
`;

// GET /api/products/:id - Get product details
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    return Response.json({ error: "Product ID is required" }, { status: 400 });
  }

  // Ensure ID is in Shopify GID format
  const productId = id.startsWith("gid://shopify/Product/")
    ? id
    : `gid://shopify/Product/${id}`;

  try {
    const response = await admin.graphql(PRODUCT_QUERY, {
      variables: { id: productId },
    });

    const responseJson = await response.json();

    if (responseJson.errors) {
      console.error("GraphQL errors:", responseJson.errors);
      return Response.json(
        { error: "Failed to fetch product", details: responseJson.errors },
        { status: 500 }
      );
    }

    const { product } = responseJson.data;

    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    // Transform product for easier consumption
    const transformedProduct = {
      id: product.id,
      title: product.title,
      handle: product.handle,
      description: product.description,
      descriptionHtml: product.descriptionHtml,
      status: product.status,
      totalInventory: product.totalInventory,
      imageUrl: product.featuredImage?.url || null,
      images: product.images.edges.map((edge: any) => ({
        url: edge.node.url,
        altText: edge.node.altText,
      })),
      minPrice: parseFloat(product.priceRangeV2.minVariantPrice.amount),
      maxPrice: parseFloat(product.priceRangeV2.maxVariantPrice.amount),
      currency: product.priceRangeV2.minVariantPrice.currencyCode,
      variants: product.variants.edges.map((variantEdge: any) => {
        const variant = variantEdge.node;
        return {
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          price: parseFloat(variant.price),
          compareAtPrice: variant.compareAtPrice
            ? parseFloat(variant.compareAtPrice)
            : null,
          inventoryQuantity: variant.inventoryQuantity,
          availableForSale: variant.availableForSale,
          options: variant.selectedOptions,
          imageUrl: variant.image?.url || product.featuredImage?.url || null,
          inventoryItem: variant.inventoryItem
            ? {
                id: variant.inventoryItem.id,
                tracked: variant.inventoryItem.tracked,
                inventoryLevels: variant.inventoryItem.inventoryLevels.edges.map(
                  (levelEdge: any) => ({
                    id: levelEdge.node.id,
                    available: levelEdge.node.available,
                    locationId: levelEdge.node.location.id,
                    locationName: levelEdge.node.location.name,
                  })
                ),
              }
            : null,
        };
      }),
      options: product.options,
      tags: product.tags,
      vendor: product.vendor,
      productType: product.productType,
      collections: product.collections.edges.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
      })),
    };

    return Response.json({ data: transformedProduct });
  } catch (error) {
    console.error("Error fetching product:", error);
    return Response.json(
      { error: "Failed to fetch product", details: String(error) },
      { status: 500 }
    );
  }
};
