import Link from "next/link";

// Simple landing page. Logged-in users go straight to the dashboard.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Missed-Call Assistant</h1>
      <p className="mt-3 max-w-md text-slate-600">
        Your AI receptionist answers the calls you miss, collects the student&apos;s details,
        and texts you a ready-to-book lead.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
      >
        Open dashboard
      </Link>
    </main>
  );
}
