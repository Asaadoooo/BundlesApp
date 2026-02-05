import {
  Card,
  Text,
  BlockStack,
  TextField,
  Button,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { useState } from "react";
import { ProductSelectionModal } from "./ProductSelectionModal";

interface BundleDetailsFormProps {
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  displayProduct?: { id: string; title: string } | null;
  onDisplayProductChange?: (product: { id: string; title: string } | null) => void;
  titlePlaceholder?: string;
  descriptionPlaceholder?: string;
}

export function BundleDetailsForm({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  displayProduct,
  onDisplayProductChange,
  titlePlaceholder = "e.g., Holiday Gift Set",
  descriptionPlaceholder = "Describe your bundle...",
}: BundleDetailsFormProps) {
  const [showProductPicker, setShowProductPicker] = useState(false);

  const handleProductSelect = (products: any[]) => {
    if (products.length > 0 && onDisplayProductChange) {
      const product = {
        id: products[0].productId,
        title: products[0].productTitle,
      };
      onDisplayProductChange(product);
    }
    setShowProductPicker(false);
  };

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd" fontWeight="bold">
          Bundle details
        </Text>
        <TextField
          label="Title"
          value={title}
          onChange={onTitleChange}
          placeholder={titlePlaceholder}
          autoComplete="off"
        />
        <TextField
          label="Description"
          value={description}
          onChange={onDescriptionChange}
          placeholder={descriptionPlaceholder}
          multiline={4}
          autoComplete="off"
        />

        {/* Display Product Picker */}
        <BlockStack gap="200">
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            Display on Product Page (Optional)
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Select which product page should show this bundle. Leave empty to show on all products.
          </Text>

          {displayProduct ? (
            <InlineStack gap="200" blockAlign="center">
              <Badge tone="info">{displayProduct.title}</Badge>
              <Button
                size="slim"
                onClick={() => onDisplayProductChange?.(null)}
              >
                Remove
              </Button>
              <Button
                size="slim"
                onClick={() => setShowProductPicker(true)}
              >
                Change
              </Button>
            </InlineStack>
          ) : (
            <Button onClick={() => setShowProductPicker(true)}>
              Select Product
            </Button>
          )}
        </BlockStack>
      </BlockStack>

      {showProductPicker && (
        <ProductSelectionModal
          open={showProductPicker}
          onClose={() => setShowProductPicker(false)}
          onSelect={handleProductSelect}
          maxSelections={1}
          title="Select Display Product"
          searchPlaceholder="Search products..."
        />
      )}
    </Card>
  );
}
