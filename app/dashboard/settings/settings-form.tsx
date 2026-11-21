"use client";

import { useActionState, useMemo, useState } from "react";
import { buildAgentPrompt, EXTRACTION_FIELDS } from "@/lib/agent-prompt";
import { DAY_KEYS, DAY_LABELS, type DayKey } from "@/lib/types";
import { saveSettings, type SettingsPayload, type SettingsState } from "./actions";

const input =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none";
const card = "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200";

export function SettingsForm({ initial }: { initial: SettingsPayload }) {
  const [form, setForm] = useState<SettingsPayload>(initial);
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  const errors = state.fieldErrors ?? {};

  // Small helpers to update one part of the form
  const set = <K extends keyof SettingsPayload>(key: K, value: SettingsPayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setDay = (day: DayKey, patch: Partial<{ closed: boolean; open: string; close: string }>) =>
    setForm((f) => ({
      ...f,
      business_hours: { ...f.business_hours, [day]: { ...f.business_hours[day]!, ...patch } },
    }));

  const setPackage = (i: number, patch: Partial<SettingsPayload["packages"][number]>) =>
    set("packages", form.packages.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const setFaq = (i: number, patch: Partial<SettingsPayload["faqs"][number]>) =>
    set("faqs", form.faqs.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-6">
        {/* The whole form goes to the server as one JSON value */}
        <input type="hidden" name="payload" value={JSON.stringify(form)} />

        {/* School + phones */}
        <section className={card}>
          <h2 className="mb-3 font-semibold">School</h2>
          <div className="space-y-4">
            <Field label="School name" error={errors.name}>
              <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </Field>
            <Field
              label="AI phone number"
              hint="The number your Retell agent answers. Calls to this number show up here."
              error={errors.ai_phone_number}
            >
              <input className={input} type="tel" inputMode="tel" placeholder="416-555-0100"
                value={form.ai_phone_number} onChange={(e) => set("ai_phone_number", e.target.value)} />
            </Field>
            <Field label="Admin phone" hint="Gets a text for every new lead." error={errors.admin_phone}>
              <input className={input} type="tel" inputMode="tel" placeholder="416-555-0111"
                value={form.admin_phone} onChange={(e) => set("admin_phone", e.target.value)} />
            </Field>
            <Field label="Owner phone" hint="Gets the weekly report every Monday." error={errors.owner_phone}>
              <input className={input} type="tel" inputMode="tel" placeholder="416-555-0112"
                value={form.owner_phone} onChange={(e) => set("owner_phone", e.target.value)} />
            </Field>
          </div>
        </section>

        {/* Business hours */}
        <section className={card}>
          <h2 className="mb-3 font-semibold">Office hours</h2>
          <div className="space-y-3">
            {DAY_KEYS.map((day) => {
              const d = form.business_hours[day]!;
              return (
                <div key={day}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-24 font-medium">{DAY_LABELS[day]}</span>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={d.closed} onChange={(e) => setDay(day, { closed: e.target.checked })} />
                      Closed
                    </label>
                    {!d.closed && (
                      <span className="flex items-center gap-1.5">
                        <input type="time" className="rounded-lg border border-slate-300 px-2 py-1.5" value={d.open}
                          onChange={(e) => setDay(day, { open: e.target.value })} aria-label={`${DAY_LABELS[day]} opens`} />
                        to
                        <input type="time" className="rounded-lg border border-slate-300 px-2 py-1.5" value={d.close}
                          onChange={(e) => setDay(day, { close: e.target.value })} aria-label={`${DAY_LABELS[day]} closes`} />
                      </span>
                    )}
                  </div>
                  {errors[`hours_${day}`] && <p className="mt-1 text-xs text-red-600">{errors[`hours_${day}`]}</p>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Packages */}
        <section className={card}>
          <h2 className="mb-1 font-semibold">Packages and prices</h2>
          <p className="mb-3 text-xs text-slate-500">Prices before HST. The assistant says “plus HST”.</p>
          <div className="space-y-4">
            {form.packages.map((p, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="flex gap-2">
                  <input className={`${input} mt-0 flex-1`} placeholder="Package name" value={p.name}
                    onChange={(e) => setPackage(i, { name: e.target.value })} aria-label="Package name" />
                  <div className="relative w-28">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500">$</span>
                    <input className={`${input} mt-0 pl-6`} inputMode="decimal" placeholder="745" value={p.price}
                      onChange={(e) => setPackage(i, { price: e.target.value })} aria-label="Price" />
                  </div>
                </div>
                <textarea className={input} rows={2} placeholder="Details (what's included)" value={p.details}
                  onChange={(e) => setPackage(i, { details: e.target.value })} aria-label="Package details" />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-red-600">{errors[`package_${i}`]}</span>
                  <button type="button" className="text-xs font-medium text-red-600 hover:underline"
                    onClick={() => set("packages", form.packages.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="mt-3 text-sm font-medium text-blue-700 hover:underline"
            onClick={() => set("packages", [...form.packages, { name: "", price: "", details: "" }])}>
            + Add package
          </button>
        </section>

        {/* FAQs */}
        <section className={card}>
          <h2 className="mb-3 font-semibold">FAQs</h2>
          <div className="space-y-4">
            {form.faqs.map((f, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <input className={`${input} mt-0`} placeholder="Question" value={f.question}
                  onChange={(e) => setFaq(i, { question: e.target.value })} aria-label="Question" />
                <textarea className={input} rows={2} placeholder="Answer" value={f.answer}
                  onChange={(e) => setFaq(i, { answer: e.target.value })} aria-label="Answer" />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-red-600">{errors[`faq_${i}`]}</span>
                  <button type="button" className="text-xs font-medium text-red-600 hover:underline"
                    onClick={() => set("faqs", form.faqs.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="mt-3 text-sm font-medium text-blue-700 hover:underline"
            onClick={() => set("faqs", [...form.faqs, { question: "", answer: "" }])}>
            + Add FAQ
          </button>
        </section>

        {/* Extra notes */}
        <section className={card}>
          <h2 className="mb-1 font-semibold">Extra notes for the assistant</h2>
          <p className="mb-2 text-xs text-slate-500">Address, service area, languages, anything else callers ask about.</p>
          <textarea className={input} rows={4} value={form.extra_notes} onChange={(e) => set("extra_notes", e.target.value)} />
        </section>

        {/* Save bar (sticks to the bottom on phones) */}
        <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          {state.error && <p className="mb-2 text-sm text-red-600">{state.error}</p>}
          {state.ok && !pending && <p className="mb-2 text-sm text-green-700">Saved ✓</p>}
          <button type="submit" disabled={pending}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {pending ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      <AgentSetup form={form} />
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

/** The "Copy AI agent prompt" button and the list of Retell extraction fields. */
function AgentSetup({ form }: { form: SettingsPayload }) {
  const [copied, setCopied] = useState(false);

  // Rebuilt whenever the form changes, so it always matches what you see.
  const prompt = useMemo(
    () =>
      buildAgentPrompt({
        schoolName: form.name,
        businessHours: form.business_hours,
        packages: form.packages
          .filter((p) => p.name.trim())
          .map((p) => ({ name: p.name.trim(), price: Number(p.price.replace(/[$,\s]/g, "")) || 0, details: p.details.trim() })),
        faqs: form.faqs.filter((f) => f.question.trim() && f.answer.trim()),
        extraNotes: form.extra_notes,
      }),
    [form],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert("Couldn't copy automatically. Open “Show prompt” and copy it by hand.");
    }
  }

  return (
    <section className={`${card} space-y-4`}>
      <div>
        <h2 className="font-semibold">Retell AI agent setup</h2>
        <p className="mt-1 text-sm text-slate-600">
          Paste this prompt into your Retell agent. Save your settings first, and copy it again whenever your prices or FAQs
          change.
        </p>
      </div>
      <button type="button" onClick={copy}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700">
        {copied ? "Copied ✓" : "Copy AI agent prompt"}
      </button>
      <details>
        <summary className="cursor-pointer text-sm font-medium text-blue-700">Show prompt</summary>
        <textarea readOnly value={prompt} rows={16} className={`${input} font-mono text-xs`} />
      </details>

      <div>
        <h3 className="mb-1 font-semibold">Post-call extraction fields</h3>
        <p className="mb-3 text-sm text-slate-600">
          In Retell, open your agent → <b>Post-Call Analysis</b> and add these fields. Use these exact names — the app reads them.
        </p>
        <ul className="divide-y divide-slate-100 text-sm">
          {EXTRACTION_FIELDS.map((f) => (
            <li key={f.name} className="py-2">
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold">{f.name}</code>{" "}
              <span className="text-xs text-slate-500">({f.type})</span>
              <p className="mt-1 text-slate-600">{f.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
