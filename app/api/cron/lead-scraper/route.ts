import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Lead Scraper Cron — runs daily.
 * Processes recurring saved searches:
 *   1. Finds all active recurring searches due to run
 *   2. For each: launches Apify scrape (or re-imports from source)
 *   3. Auto-imports results if configured
 *   4. Auto-enrolls in sequence if configured
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let searchesProcessed = 0;
  let leadsImported = 0;
  let leadsVerified = 0;

  try {
    // Fetch all recurring searches that are due
    const now = new Date();
    const { data: searches, error } = await admin
      .from("lead_searches")
      .select("*")
      .eq("is_recurring", true)
      .or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`);

    if (error || !searches?.length) {
      return NextResponse.json({ searchesProcessed: 0, leadsImported: 0 });
    }

    for (const search of searches) {
      searchesProcessed++;

      // Calculate next run time based on frequency
      const nextRun = new Date();
      const frequency = (search as Record<string, unknown>).schedule_frequency as string || "daily";
      if (frequency === "weekly") {
        nextRun.setDate(nextRun.getDate() + 7);
      } else {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      // Update last_run_at and next_run_at
      await admin
        .from("lead_searches")
        .update({
          last_run_at: now.toISOString(),
          next_run_at: nextRun.toISOString(),
        })
        .eq("id", search.id);

      // Get unimported scraped leads from this search
      const { data: scrapedLeads } = await admin
        .from("scraped_leads")
        .select("*")
        .eq("search_id", search.id)
        .eq("imported", false);

      if (!scrapedLeads?.length) continue;

      // Verify emails using MX check
      const { verifyBulk } = await import("@/lib/verification/email-verifier");
      const emails = scrapedLeads
        .filter((sl) => sl.email)
        .map((sl) => sl.email as string);

      if (emails.length > 0) {
        const verificationResults = await verifyBulk(emails, { concurrency: 10 });

        // Update verification status on scraped leads
        for (const sl of scrapedLeads) {
          if (!sl.email) continue;
          const result = verificationResults.find((r) => r.email === sl.email);
          if (result) {
            await admin
              .from("scraped_leads")
              .update({
                verified: result.status === "valid" || result.status === "catch_all",
                verification_status: result.status,
                confidence_score: result.confidence,
                verified_at: new Date().toISOString(),
              })
              .eq("id", sl.id);
            if (result.status === "valid" || result.status === "catch_all") {
              leadsVerified++;
            }
          }
        }
      }

      // Auto-import if configured
      const autoImport = (search as Record<string, unknown>).auto_import as boolean;
      if (!autoImport) continue;

      // Only import verified leads
      const { data: verifiedLeads } = await admin
        .from("scraped_leads")
        .select("*")
        .eq("search_id", search.id)
        .eq("imported", false)
        .eq("verified", true);

      if (!verifiedLeads?.length) continue;

      for (const sl of verifiedLeads) {
        // Duplicate check: skip if email already exists in leads
        if (sl.email) {
          const { data: existing } = await admin
            .from("leads")
            .select("id")
            .eq("organization_id", search.organization_id)
            .eq("email", sl.email)
            .limit(1);

          if (existing?.length) {
            await admin
              .from("scraped_leads")
              .update({ duplicate_of: existing[0].id })
              .eq("id", sl.id);
            continue;
          }
        }

        const leadName = [sl.first_name, sl.last_name].filter(Boolean).join(" ") || sl.email || "Unknown";
        const { data: newLead } = await admin
          .from("leads")
          .insert({
            organization_id: search.organization_id,
            created_by: search.created_by,
            name: leadName,
            email: sl.email ?? "",
            company: sl.company ?? null,
            phone: sl.phone ?? null,
            linkedin: sl.linkedin_url ?? null,
            location: sl.location ?? null,
            industry: sl.industry ?? null,
            website: sl.company_website ?? null,
            employees: sl.company_size ?? null,
            source: "LinkedIn",
            status: "cold",
            estimated_value: 0,
            score: 0,
          })
          .select("id")
          .single();

        if (newLead) {
          await admin
            .from("scraped_leads")
            .update({ imported: true, imported_lead_id: newLead.id })
            .eq("id", sl.id);
          leadsImported++;

          // Fire automation rules for new lead
          import("@/lib/actions/automation").then(({ evaluateLeadAgainstRules }) =>
            evaluateLeadAgainstRules(newLead.id, "lead_created", {}).catch(() => {}),
          );

          // Auto-enroll in sequence if configured
          const autoEnrollSeqId = (search as Record<string, unknown>).auto_enroll_sequence_id as string | null;
          if (autoEnrollSeqId) {
            const { data: existingEnrollment } = await admin
              .from("sequence_enrollments")
              .select("id")
              .eq("sequence_id", autoEnrollSeqId)
              .eq("lead_id", newLead.id)
              .eq("status", "active")
              .maybeSingle();

            if (!existingEnrollment) {
              await admin.from("sequence_enrollments").insert({
                sequence_id: autoEnrollSeqId,
                lead_id: newLead.id,
                current_step: 0,
                status: "active",
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[lead-scraper-cron] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ searchesProcessed, leadsImported, leadsVerified });
}
