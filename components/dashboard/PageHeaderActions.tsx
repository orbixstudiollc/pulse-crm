"use client";

import { useState } from "react";
import { Button, PlusIcon, Dropdown, dateRangeOptions } from "@/components/ui";

export function PageHeaderActions() {
  const [dateRange, setDateRange] = useState("this_month");

  return (
    <>
      <Dropdown
        options={dateRangeOptions}
        value={dateRange}
        onChange={setDateRange}
      />
      <Button leftIcon={<PlusIcon size={20} weight="bold" />}>Add Lead</Button>
    </>
  );
}
