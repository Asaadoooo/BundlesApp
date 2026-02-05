import {
  InlineStack,
  TextField,
  Select,
  Box,
} from "@shopify/polaris";

interface BundleFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
}

const typeOptions = [
  { label: "All types", value: "" },
  { label: "Fixed Bundle", value: "FIXED" },
  { label: "Mix & Match", value: "MIX_MATCH" },
  { label: "Volume Discount", value: "VOLUME" },
  { label: "Tiered Bundle", value: "TIERED" },
];

const statusOptions = [
  { label: "All statuses", value: "" },
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Archived", value: "archived" },
];

export function BundleFilters({
  searchValue,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedStatus,
  onStatusChange,
}: BundleFiltersProps) {
  return (
    <Box padding="400" borderBlockEndWidth="025" borderColor="border">
      <InlineStack gap="400" align="end" blockAlign="end" wrap={false}>
        <div style={{ flex: 1 }}>
          <TextField
            label="Search bundles"
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Search by title..."
            clearButton
            onClearButtonClick={() => onSearchChange("")}
            autoComplete="off"
          />
        </div>
        <Select
          label="Type"
          options={typeOptions}
          value={selectedType}
          onChange={onTypeChange}
        />
        <Select
          label="Status"
          options={statusOptions}
          value={selectedStatus}
          onChange={onStatusChange}
        />
      </InlineStack>
    </Box>
  );
}
