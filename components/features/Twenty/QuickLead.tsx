"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { proposeQuickLeadAction } from "@/lib/twenty/workflows/actions";

export function QuickLead({ connectionId, onProposed }: { connectionId: string; onProposed?: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const requestRef = useRef<string | null>(null);
  return (
    <section className="rounded-xl border border-divider p-4">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="font-medium text-fg">Quick Lead</button>
      <p className="mt-1 text-sm text-fg-muted">Review company and person changes before they are created in Twenty.</p>
      {open && <form ref={formRef} className="mt-4 grid gap-3 sm:grid-cols-2" onChange={() => { requestRef.current = null; }} onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const payload = Object.fromEntries(["firstName", "lastName", "email", "jobTitle", "companyName", "companyDomain"].map((key) => [key, String(form.get(key) ?? "").trim()]));
        requestRef.current ??= crypto.randomUUID();
        const requestId = requestRef.current;
        startTransition(async () => {
          try {
            const result = await proposeQuickLeadAction(connectionId, payload, requestId);
            if (result.status === "awaiting_approval") toast.success("Quick Lead prepared for approval");
            else toast.info("Quick Lead queued. Check Recent jobs for its preparation status.");
            formRef.current?.reset(); requestRef.current = null; onProposed?.();
          } catch { toast.error("Could not prepare Quick Lead. Check your connection and try again."); }
        });
      }}>
        {[
          ["firstName", "First name", "text", true], ["lastName", "Last name", "text", false], ["email", "Email", "email", true],
          ["jobTitle", "Job title", "text", false], ["companyName", "Company name", "text", false], ["companyDomain", "Company domain", "text", false],
        ].map(([name, label, type, required]) => <label key={String(name)} className="grid gap-1 text-sm text-fg-muted">{label}
          <input name={String(name)} type={String(type)} required={Boolean(required)} disabled={pending} maxLength={name === "email" ? 254 : 253} className="rounded-lg border border-divider bg-surface px-3 py-2 text-fg" />
        </label>)}
        <button type="submit" disabled={pending} className="rounded-lg bg-fg px-4 py-2 text-sm text-surface disabled:opacity-50 sm:col-span-2">{pending ? "Preparing proposal…" : "Prepare changes for approval"}</button>
      </form>}
    </section>
  );
}
