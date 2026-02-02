import { PageHeader } from "@/components/dashboard";
import { Button, ExportIcon, PlusIcon } from "@/components/ui";

export default function CustomersPage() {
  return (
    <div>
      <PageHeader title="Customers">
        <Button variant="outline" leftIcon={<ExportIcon size={20} />}>
          Export
        </Button>
        <Button leftIcon={<PlusIcon size={20} weight="bold" />}>
          Add Customer
        </Button>
      </PageHeader>
    </div>
  );
}
