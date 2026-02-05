import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// GraphQL query for product search
const PRODUCTS_SEARCH_QUERY = `#graphql
  query SearchProducts($query: String!, $first: Int!, $after: String) {
    products(first: $first, after: $after, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          status
          totalInventory
          featuredImage {
            url
            altText
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
              }
            }
          }
          tags
          vendor
          productType
        }
      }
    }
  }
`;

// GET /api/products/search - Search products for bundle creation
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const query = url.searchParams.get("query") || "";
  const limit = parseInt(url.searchParams.get("limit") || "25");
  const cursor = url.searchParams.get("cursor");
  const status = url.searchParams.get("status") || "active"; // active, draft, archived

  // Build search query
  let searchQuery = query;
  if (status && status !== "all") {
    searchQuery = `${searchQuery} status:${status}`.trim();
  }

  try {
    const response = await admin.graphql(PRODUCTS_SEARCH_QUERY, {
      variables: {
        query: searchQuery,
        first: Math.min(limit, 100),
        after: cursor || null,
      },
    });

    const responseJson = await response.json();

    if (responseJson.errors) {
      console.error("GraphQL errors:", responseJson.errors);
      return Response.json(
        { error: "Failed to search products", details: responseJson.errors },
        { status: 500 }
      );
    }

    const { products } = responseJson.data;

    // Transform products for easier consumption
    const transformedProducts = products.edges.map((edge: any) => {
      const product = edge.node;
      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        totalInventory: product.totalInventory,
        imageUrl: product.featuredImage?.url || null,
        imageAlt: product.featuredImage?.altText || null,
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
          };
        }),
        tags: product.tags,
        vendor: product.vendor,
        productType: product.productType,
      };
    });

    return Response.json({
      data: transformedProducts,
      pageInfo: {
        hasNextPage: products.pageInfo.hasNextPage,
        endCursor: products.pageInfo.endCursor,
      },
    });
  } catch (error) {
    console.error("Error searching products:", error);
    return Response.json(
      { error: "Failed to search products", details: String(error) },
      { status: 500 }
    );
  }
};
