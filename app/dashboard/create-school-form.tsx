"use client";

import { useActionState } from "react";
import { createSchool, type CreateSchoolState } from "./actions";

export function CreateSchoolForm() {
  const [state, action, pending] = useActionState<CreateSchoolState, FormData>(createSchool, {});

  return (
    <form action={action} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          School name
        </label>
        <input
          id="name"
          name="name"
          required
          placeholder="e.g. Maple Leaf Driving School"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
        />
      </div>
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create school"}
      </button>
    </form>
  );
}
