"use client";

import { useState } from "react";
import { Button, PlusIcon, Dropdown, dateRangeOptions } from "@/components/ui";
import { AddLeadModal } from "../features/AddLeadModal";

export function PageHeaderActions() {
  const [dateRange, setDateRange] = useState("this_month");
  const [showAddLead, setShowAddLead] = useState(false);

  return (
    <>
      <Dropdown
        options={dateRangeOptions}
        value={dateRange}
        onChange={setDateRange}
      />
      <Button
        leftIcon={<PlusIcon size={20} weight="bold" />}
        onClick={() => setShowAddLead(true)}
      >
        Add Lead
      </Button>

      <AddLeadModal
        open={showAddLead}
        onClose={() => setShowAddLead(false)}
        onSubmit={(data) => {
          console.log("New lead:", data);
        }}
      />
    </>
  );
}
