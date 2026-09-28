import { z } from "zod";

// Exactly the keys app/dashboard/sequences/[id]/client.tsx sends from handleSaveSettings.
export const SequenceSettingsSchema = z
  .object({
    schedule_days: z.array(z.string().max(16)).max(7).optional(),
    start_hour: z.number().int().min(0).max(23).optional(),
    end_hour: z.number().int().min(0).max(23).optional(),
    daily_send_limit: z.number().int().min(0).max(10000).optional(),
    max_new_leads_per_day: z.number().int().min(0).max(10000).optional(),
    email_account_ids: z.array(z.uuid()).max(50).optional(),
    stop_on_reply: z.boolean().optional(),
    stop_on_bounce: z.boolean().optional(),
    stop_on_unsubscribe: z.boolean().optional(),
    timezone: z.string().max(64).optional(),
  })
  .strict();

export type SequenceSettingsInput = z.infer<typeof SequenceSettingsSchema>;
