import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const status = {
      apify: {
        configured: !!process.env.APIFY_API_TOKEN,
        keyPrefix: process.env.APIFY_API_TOKEN
          ? `${process.env.APIFY_API_TOKEN.slice(0, 6)}...`
          : null,
      },
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
        keyPrefix: process.env.OPENAI_API_KEY
          ? `${process.env.OPENAI_API_KEY.slice(0, 6)}...`
          : null,
      },
      anthropic: {
        configured: !!process.env.ANTHROPIC_API_KEY,
        keyPrefix: process.env.ANTHROPIC_API_KEY
          ? `${process.env.ANTHROPIC_API_KEY.slice(0, 6)}...`
          : null,
      },
      cronSecret: {
        configured: !!process.env.CRON_SECRET,
      },
    };

    return NextResponse.json({ data: status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
