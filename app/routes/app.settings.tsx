import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Checkbox,
  Box,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return Response.json({
    shop: session.shop,
  });
};

export default function SettingsPage() {
  const { shop } = useLoaderData<typeof loader>();

  return (
    <Page title="Settings">
      <BlockStack gap="500">
        {/* Store Information */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd" fontWeight="bold">
              Store Information
            </Text>
            <InlineStack align="space-between">
              <Text as="span" fontWeight="semibold">Connected Store</Text>
              <Text as="span">{shop}</Text>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Display Settings */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd" fontWeight="bold">
              Display Settings
            </Text>
            <BlockStack gap="300">
              <Checkbox
                label="Show compare at price on bundles"
                checked={true}
                disabled
                onChange={() => {}}
              />
              <Checkbox
                label="Show savings amount"
                checked={true}
                disabled
                onChange={() => {}}
              />
              <Checkbox
                label="Show savings percentage"
                checked={false}
                disabled
                onChange={() => {}}
              />
            </BlockStack>
            <Text as="p" variant="bodySm" tone="subdued">
              These are default settings. Individual bundles can override these.
            </Text>
          </BlockStack>
        </Card>

        {/* Inventory Settings */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd" fontWeight="bold">
              Inventory Settings
            </Text>
            <BlockStack gap="300">
              <Checkbox
                label="Track inventory for bundles"
                checked={true}
                disabled
                onChange={() => {}}
              />
              <Checkbox
                label="Continue selling when out of stock"
                checked={false}
                disabled
                onChange={() => {}}
              />
            </BlockStack>
            <Text as="p" variant="bodySm" tone="subdued">
              When enabled, bundles will become unavailable when any component
              product is out of stock.
            </Text>
          </BlockStack>
        </Card>

        {/* API Information */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd" fontWeight="bold">
              API Information
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Use these endpoints in your theme to display and interact with bundles.
            </Text>
            <BlockStack gap="200">
              <Box
                padding="300"
                borderWidth="025"
                borderRadius="200"
                borderColor="border"
                background="bg-surface-secondary"
              >
                <Text as="p" variant="bodySm" fontWeight="medium">
                  GET /api/storefront/bundle/:id?shop={shop}
                </Text>
              </Box>
              <Box
                padding="300"
                borderWidth="025"
                borderRadius="200"
                borderColor="border"
                background="bg-surface-secondary"
              >
                <Text as="p" variant="bodySm" fontWeight="medium">
                  POST /api/storefront/bundle/add-to-cart
                </Text>
              </Box>
              <Box
                padding="300"
                borderWidth="025"
                borderRadius="200"
                borderColor="border"
                background="bg-surface-secondary"
              >
                <Text as="p" variant="bodySm" fontWeight="medium">
                  POST /api/storefront/bundle/validate
                </Text>
              </Box>
            </BlockStack>
          </BlockStack>
        </Card>

        {/* About */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd" fontWeight="bold">
              About
            </Text>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="span">App Version</Text>
                <Text as="span">1.0.0</Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">Bundle Types</Text>
                <Text as="span">Fixed, Mix & Match, Volume, Tiered</Text>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
