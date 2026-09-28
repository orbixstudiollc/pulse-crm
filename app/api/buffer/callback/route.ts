import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/buffer/callback
 * Handle OAuth callback from Buffer after user authorizes connection
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    // Handle OAuth error
    if (error) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/settings?error=${encodeURIComponent(error)}`,
          request.url
        )
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/settings?error=missing_code`,
          request.url
        )
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL(
          `/login?redirect=/dashboard/settings`,
          request.url
        )
      );
    }

    // In a real implementation, you would:
    // 1. Exchange the authorization code for an access token
    // 2. Use the access token to get channel information from Buffer
    // 3. Store the channel in your database linked to the organization
    // 4. Close the popup window and notify the parent

    // For now, return a simple success page that closes the popup
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Successful</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
            }
            .success-icon {
              font-size: 64px;
              margin-bottom: 16px;
            }
            h1 {
              font-size: 24px;
              margin: 0 0 8px 0;
            }
            p {
              font-size: 16px;
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>Account Connected!</h1>
            <p>This window will close automatically...</p>
          </div>
          <script>
            // Close popup after 2 seconds
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
      `,
      {
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/dashboard/settings?error=callback_failed`,
        request.url
      )
    );
  }
}
