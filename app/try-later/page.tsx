export const dynamic = "force-static";

export default function TryLaterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="max-w-md rounded-xl border border-line p-8 text-center">
        <h1 className="text-xl font-semibold text-fg">The demo is busy right now</h1>
        <p className="mt-2 text-sm text-fg-secondary">
          New guest workspaces are paused for a little while. Please try again in an hour.
        </p>
      </div>
    </main>
  );
}
