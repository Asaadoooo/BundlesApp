import { useState, useCallback } from "react";
import {
  Text,
  BlockStack,
  InlineStack,
  ResourceItem,
  Popover,
  ActionList,
  Button,
} from "@shopify/polaris";
import { StatusBadge } from "./StatusBadge";
import { BundleTypeBadge } from "./BundleTypeBadge";
import { formatPrice } from "~/utils/bundle";

interface Bundle {
  id: string;
  title: string;
  type: string;
  status: string;
  effectiveStatus: string;
  price: number | null;
  itemCount: number;
}

interface BundleListItemProps {
  bundle: Bundle;
  onNavigate: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleStatus: (id: string, currentStatus: string) => void;
  onDelete: (id: string, title: string) => void;
}

export function BundleListItem({
  bundle,
  onNavigate,
  onEdit,
  onDuplicate,
  onToggleStatus,
  onDelete,
}: BundleListItemProps) {
  const [isPopoverActive, setIsPopoverActive] = useState(false);

  const togglePopover = useCallback(() => {
    setIsPopoverActive((prev) => !prev);
  }, []);

  const closePopover = useCallback(() => {
    setIsPopoverActive(false);
  }, []);

  return (
    <ResourceItem
      id={bundle.id}
      onClick={() => onNavigate(bundle.id)}
      accessibilityLabel={`View details for ${bundle.title}`}
    >
      <InlineStack gap="400" align="space-between" blockAlign="center" wrap={false}>
        <BlockStack gap="100">
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {bundle.title}
          </Text>
          <InlineStack gap="200">
            <BundleTypeBadge type={bundle.type} />
            <StatusBadge status={bundle.effectiveStatus} />
            <Text as="span" variant="bodySm" tone="subdued">
              {bundle.itemCount} items
            </Text>
          </InlineStack>
        </BlockStack>
        <InlineStack gap="300" blockAlign="center">
          {bundle.price && (
            <Text as="span" fontWeight="semibold">
              {formatPrice(bundle.price)}
            </Text>
          )}
          <Popover
            active={isPopoverActive}
            activator={
              <span onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="plain"
                  onClick={togglePopover}
                  icon={() => (
                    <span style={{ fontSize: "18px" }}>⋯</span>
                  )}
                  accessibilityLabel="Actions"
                />
              </span>
            }
            onClose={closePopover}
          >
            <ActionList
              items={[
                {
                  content: "Edit",
                  onAction: () => {
                    onEdit(bundle.id);
                    closePopover();
                  },
                },
                {
                  content: "Duplicate",
                  onAction: () => {
                    onDuplicate(bundle.id);
                    closePopover();
                  },
                },
                {
                  content: bundle.effectiveStatus === "active" ? "Deactivate" : "Activate",
                  onAction: () => {
                    onToggleStatus(bundle.id, bundle.effectiveStatus);
                    closePopover();
                  },
                },
                {
                  content: "Delete",
                  destructive: true,
                  onAction: () => {
                    onDelete(bundle.id, bundle.title);
                    closePopover();
                  },
                },
              ]}
            />
          </Popover>
        </InlineStack>
      </InlineStack>
    </ResourceItem>
  );
}
