"use client";

import { GearIcon } from "@/components/ui";
import { Page, PageHeader } from "@/components/dashboard";
import { BTN_PRIMARY } from "./styles";

export function SettingsView() {
  return (
    <div className="flex-1 overflow-y-auto">
      <Page>
        <PageHeader
          icon={<GearIcon size={18} />}
          title="Copilot Settings"
          description="Configure your Pulse Copilot settings."
        />

        <p className="px-8 pb-4 text-[13px] text-fg-secondary max-sm:px-4">These settings are coming soon.</p>

        <fieldset disabled className="min-w-0 opacity-60">
          {/* Analytics Toggle */}
          <div className="flex items-center justify-between gap-4 px-8 py-5 border-t border-divider max-sm:px-4">
            <div>
              <h3 className="text-[14px] font-semibold text-fg">Analytics</h3>
              <p className="text-[13px] text-fg-muted mt-0.5">
                Enable analytics tracking for Copilot interactions and performance metrics.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-fg-secondary px-3 py-1.5 rounded text-xs font-medium transition-colors">
                Disable
              </button>
              <button className="bg-success text-on-inverse px-3 py-1.5 rounded text-xs font-medium transition-colors">
                Enable
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div className="flex items-center justify-between gap-4 px-8 py-5 border-t border-divider max-sm:px-4">
            <div>
              <h3 className="text-[14px] font-semibold text-fg">AI Model</h3>
              <p className="text-[13px] text-fg-muted mt-0.5">
                Choose the AI model for Copilot responses.
              </p>
            </div>
            <select className="pl-3 pr-8 py-1.5 rounded border border-line bg-surface text-xs font-medium text-fg appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%236b7280%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1.25rem_1.25rem]">
              <option>Claude Sonnet 4.6</option>
              <option>Claude Haiku 4.5</option>
            </select>
          </div>

          {/* Chat History */}
          <div className="flex items-center justify-between gap-4 px-8 py-5 border-y border-divider max-sm:px-4">
            <div>
              <h3 className="text-[14px] font-semibold text-fg">Chat History</h3>
              <p className="text-[13px] text-fg-muted mt-0.5">
                Automatically save chat conversations for future reference.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-fg-secondary px-3 py-1.5 rounded text-xs font-medium transition-colors">
                Disable
              </button>
              <button className="bg-success text-on-inverse px-3 py-1.5 rounded text-xs font-medium transition-colors">
                Enable
              </button>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end px-8 pt-4 max-sm:px-4">
            <button className={BTN_PRIMARY}>
              Save
            </button>
          </div>
        </fieldset>
      </Page>
    </div>
  );
}
