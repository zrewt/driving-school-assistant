import { redirect } from "next/navigation";
import { getCurrentSchool } from "@/lib/school";
import { isSupabaseConfigured } from "@/lib/config";
import { NavBar } from "./nav-bar";
import { CreateSchoolForm } from "./create-school-form";
import { logout } from "@/app/login/actions";

// Dashboard pages depend on who is logged in, so never pre-render them.
export const dynamic = "force-dynamic";

// Every page under /dashboard shares this layout: it checks the login,
// shows the top nav, and asks new users to create their school first.
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  if (!isSupabaseConfigured()) redirect("/login");

  const { user, school, loadError } = await getCurrentSchool();
  if (!user) redirect("/login");

  // The database refused the lookup. Don't offer "create your school" here,
  // or the user could end up making a duplicate school.
  if (loadError) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <h1 className="text-2xl font-bold">Couldn&apos;t load your school</h1>
        <p className="mt-2 text-slate-600">
          The database returned an error. If this is a new setup, make sure you ran <b>both</b> files in{" "}
          <code>supabase/migrations</code> in the Supabase SQL Editor, then reload this page.
        </p>
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 font-mono text-xs text-red-700">{loadError}</p>
        <form action={logout} className="mt-6">
          <button type="submit" className="text-sm font-medium text-blue-700 hover:underline">
            Log out
          </button>
        </form>
      </main>
    );
  }

  if (!school) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <h1 className="text-2xl font-bold">Create your school</h1>
        <p className="mt-2 mb-6 text-slate-600">
          Your login isn&apos;t linked to a driving school yet. Enter your school&apos;s name to get
          started. You can add hours, prices and FAQs next.
        </p>
        <CreateSchoolForm />
      </main>
    );
  }

  return (
    <>
      <NavBar schoolName={school.name} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
