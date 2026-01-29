import { Button } from "@/components/ui";

export default function CustomersPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
          Customers
        </h1>

        <Button>Add Lead</Button>
      </div>
    </div>
  );
}
