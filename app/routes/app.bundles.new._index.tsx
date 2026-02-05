import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useNavigate } from "react-router";
import {
  Page,
  Text,
  BlockStack,
  InlineGrid,
} from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { BundleTypeCard, bundleTypes } from "~/components/BundleTypeCard";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function NewBundlePage() {
  const navigate = useNavigate();

  return (
    <Page
      title="Create Bundle"
      backAction={{
        content: "Bundles",
        onAction: () => navigate("/app/bundles"),
      }}
    >
      <BlockStack gap="500">
        <Text as="p" variant="bodyMd" tone="subdued">
          Choose the type of bundle you want to create. Each type offers
          different ways to group and discount products.
        </Text>

        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          {bundleTypes.map((bundleType) => (
            <BundleTypeCard
              key={bundleType.type}
              bundleType={bundleType}
              onClick={() =>
                navigate(`/app/bundles/new/${bundleType.type.toLowerCase()}`)
              }
            />
          ))}
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
