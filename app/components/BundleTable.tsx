import type { ReactNode } from "react";
import {
  IndexTable,
  Text,
  useIndexResourceState,
  Card,
} from "@shopify/polaris";
import { StatusBadge } from "./StatusBadge";
import { BundleTypeBadge } from "./BundleTypeBadge";
import { formatPrice } from "~/utils/bundle";

export interface Bundle {
  id: string;
  title: string;
  type: string;
  status: string;
  effectiveStatus: string;
  price: number | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface BundleTableProps {
  bundles: Bundle[];
  onNavigate: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkActivate?: (ids: string[]) => void;
  onBulkDeactivate?: (ids: string[]) => void;
  filters?: ReactNode;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BundleTable({
  bundles,
  onNavigate,
  onBulkDelete,
  onBulkActivate,
  onBulkDeactivate,
  filters,
}: BundleTableProps) {
  const resourceName = {
    singular: "bundle",
    plural: "bundles",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(bundles as { id: string }[]);

  const promotedBulkActions = [
    ...(onBulkActivate
      ? [
          {
            content: "Activate",
            onAction: () => onBulkActivate(selectedResources),
          },
        ]
      : []),
    ...(onBulkDeactivate
      ? [
          {
            content: "Deactivate",
            onAction: () => onBulkDeactivate(selectedResources),
          },
        ]
      : []),
  ];

  const bulkActions = [
    ...(onBulkDelete
      ? [
          {
            content: "Delete",
            destructive: true,
            onAction: () => onBulkDelete(selectedResources),
          },
        ]
      : []),
  ];

  const rowMarkup = bundles.map((bundle, index) => (
    <IndexTable.Row
      id={bundle.id}
      key={bundle.id}
      selected={selectedResources.includes(bundle.id)}
      position={index}
      onClick={() => onNavigate(bundle.id)}
    >
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          {bundle.title}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BundleTypeBadge type={bundle.type} />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <StatusBadge status={bundle.effectiveStatus} />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {bundle.itemCount}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {bundle.price ? formatPrice(bundle.price) : "—"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" tone="subdued">
          {formatDate(bundle.createdAt)}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Card padding="0">
      {filters}
      <IndexTable
        resourceName={resourceName}
        itemCount={bundles.length}
        selectedItemsCount={
          allResourcesSelected ? "All" : selectedResources.length
        }
        onSelectionChange={handleSelectionChange}
        headings={[
          { title: "Title" },
          { title: "Type" },
          { title: "Status" },
          { title: "Items" },
          { title: "Price" },
          { title: "Created" },
        ]}
        promotedBulkActions={promotedBulkActions.length > 0 ? promotedBulkActions : undefined}
        bulkActions={bulkActions.length > 0 ? bulkActions : undefined}
        selectable
      >
        {rowMarkup}
      </IndexTable>
    </Card>
  );
}
