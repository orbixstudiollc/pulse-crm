import { Button, ExportIcon, PlusIcon } from "@/components/ui";

export default function CustomersPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
          Customers
        </h1>

        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<ExportIcon size={20} />}>
            Export
          </Button>
          <Button leftIcon={<PlusIcon size={20} weight="bold" />}>
            Add Customer
          </Button>
        </div>
      </div>
    </div>
  );
}
