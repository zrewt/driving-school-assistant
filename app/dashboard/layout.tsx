import { redirect } from "next/navigation";
import { getCurrentSchool } from "@/lib/school";
import { isSupabaseConfigured } from "@/lib/config";
import { NavBar } from "./nav-bar";
import { CreateSchoolForm } from "./create-school-form";

// Dashboard pages depend on who is logged in, so never pre-render them.
export const dynamic = "force-dynamic";

// Every page under /dashboard shares this layout: it checks the login,
// shows the top nav, and asks new users to create their school first.
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  if (!isSupabaseConfigured()) redirect("/login");

  const { user, school } = await getCurrentSchool();
  if (!user) redirect("/login");

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
