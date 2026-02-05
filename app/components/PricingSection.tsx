import {
  Card,
  Text,
  BlockStack,
  TextField,
  Select,
} from "@shopify/polaris";

export type DiscountTypeValue = "fixed_price" | "percentage" | "fixed_amount";

interface PricingSectionProps {
  discountType: DiscountTypeValue;
  onDiscountTypeChange: (value: DiscountTypeValue) => void;
  discountValue: number;
  onDiscountValueChange: (value: number) => void;
  fixedPrice?: number;
  onFixedPriceChange?: (value: number) => void;
  showFixedPrice?: boolean;
  title?: string;
}

const discountTypeOptionsWithFixed = [
  { label: "Fixed bundle price", value: "fixed_price" },
  { label: "Percentage discount", value: "percentage" },
  { label: "Fixed amount off", value: "fixed_amount" },
];

const discountTypeOptionsWithoutFixed = [
  { label: "Percentage off total", value: "percentage" },
  { label: "Fixed amount off", value: "fixed_amount" },
];

export function PricingSection({
  discountType,
  onDiscountTypeChange,
  discountValue,
  onDiscountValueChange,
  fixedPrice = 0,
  onFixedPriceChange,
  showFixedPrice = true,
  title = "Pricing",
}: PricingSectionProps) {
  const discountTypeOptions = showFixedPrice
    ? discountTypeOptionsWithFixed
    : discountTypeOptionsWithoutFixed;

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd" fontWeight="bold">
          {title}
        </Text>

        <Select
          label="Discount type"
          options={discountTypeOptions}
          value={discountType}
          onChange={(value) => onDiscountTypeChange(value as DiscountTypeValue)}
        />

        {showFixedPrice && discountType === "fixed_price" && onFixedPriceChange && (
          <TextField
            label="Bundle price"
            type="number"
            value={String(fixedPrice)}
            onChange={(value) => onFixedPriceChange(parseFloat(value) || 0)}
            prefix="€"
            autoComplete="off"
          />
        )}

        {discountType === "percentage" && (
          <TextField
            label="Discount percentage"
            type="number"
            value={String(discountValue)}
            onChange={(value) => onDiscountValueChange(parseFloat(value) || 0)}
            suffix="%"
            autoComplete="off"
          />
        )}

        {discountType === "fixed_amount" && (
          <TextField
            label="Discount amount"
            type="number"
            value={String(discountValue)}
            onChange={(value) => onDiscountValueChange(parseFloat(value) || 0)}
            prefix="€"
            autoComplete="off"
          />
        )}
      </BlockStack>
    </Card>
  );
}
