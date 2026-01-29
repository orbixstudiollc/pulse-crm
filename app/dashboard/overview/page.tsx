import {
  Button,
  CalendarBlankIcon,
  CaretDownIcon,
  PlusIcon,
} from "@/components/ui";

export default function OverviewPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
          Welcome back, Angel
        </h1>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            leftIcon={<CalendarBlankIcon size={20} />}
            rightIcon={<CaretDownIcon size={20} />}
          >
            This Month
          </Button>
          <Button leftIcon={<PlusIcon size={20} weight="bold" />}>
            Add Lead
          </Button>
        </div>
      </div>
    </div>
  );
}
