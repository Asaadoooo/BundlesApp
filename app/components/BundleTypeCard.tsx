import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Box,
} from "@shopify/polaris";
import { BundleType } from "~/types/bundle";

interface BundleTypeConfig {
  type: BundleType;
  title: string;
  description: string;
  example: string;
  icon: string;
  benefits: string[];
}

interface BundleTypeCardProps {
  bundleType: BundleTypeConfig;
  onClick: () => void;
}

export const bundleTypes: BundleTypeConfig[] = [
  {
    type: BundleType.FIXED,
    title: "Fixed Bundle",
    description:
      "Pre-configured product sets sold as complete packages at a fixed price.",
    example: 'Example: "Holiday Gift Set" - 4 products for €62.10',
    icon: "📦",
    benefits: [
      "Easy to set up and manage",
      "Clear pricing for customers",
      "Great for curated collections",
    ],
  },
  {
    type: BundleType.MIX_MATCH,
    title: "Mix & Match",
    description:
      "Let customers create their own bundle by choosing products from categories.",
    example: 'Example: "Build Your Box" - Pick any 3 items, save 15%',
    icon: "🎨",
    benefits: [
      "Personalized experience",
      "Higher engagement",
      "Flexible pricing options",
    ],
  },
  {
    type: BundleType.VOLUME,
    title: "Volume Discount",
    description:
      "Offer discounts when customers buy multiple units of the same product.",
    example: 'Example: Buy 1 at €20, Buy 3 at €17 each',
    icon: "📊",
    benefits: [
      "Increases order quantity",
      "Simple to understand",
      "Encourages bulk buying",
    ],
  },
  {
    type: BundleType.TIERED,
    title: "Tiered Bundles",
    description:
      "Offer different bundle tiers (Bronze, Silver, Gold) at increasing value.",
    example: 'Example: Basic €30, Premium €50, Ultimate €80',
    icon: "🏆",
    benefits: [
      "Upselling opportunity",
      "Clear value progression",
      "Appeals to different budgets",
    ],
  },
];

export function BundleTypeCard({ bundleType, onClick }: BundleTypeCardProps) {
  return (
    <Card>
      <div onClick={onClick} style={{ cursor: "pointer" }}>
        <BlockStack gap="400">
          <InlineStack gap="300" blockAlign="center">
            <Text as="span" variant="headingLg">
              {bundleType.icon}
            </Text>
            <Text as="h2" variant="headingMd" fontWeight="bold">
              {bundleType.title}
            </Text>
          </InlineStack>

          <Text as="p" variant="bodyMd">
            {bundleType.description}
          </Text>

          <Box
            padding="200"
            borderRadius="100"
            background="bg-surface-secondary"
          >
            <Text as="p" variant="bodySm" tone="subdued">
              {bundleType.example}
            </Text>
          </Box>

          <BlockStack gap="100">
            {bundleType.benefits.map((benefit, index) => (
              <InlineStack key={index} gap="200" blockAlign="center">
                <Text as="span" tone="success">
                  ✓
                </Text>
                <Text as="span" variant="bodySm">
                  {benefit}
                </Text>
              </InlineStack>
            ))}
          </BlockStack>
        </BlockStack>
      </div>
    </Card>
  );
}
