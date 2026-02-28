"use client";

import { useState } from "react";

type Sample = {
  id: string;
  label: string;
  value: string;
};

const SAMPLE_EMAILS: Sample[] = [
  {
    id: "sample-1",
    label: "Damaged Transformer",
    value:
      "From: alex.rivera@inspectpro.com\nSubject: URGENT - Pole P-44219 Transformer Leak\n\nTeam,\nDuring inspection at 1458 Riverbend Ave, I found an oil leak from transformer unit on pole P-44219. Immediate hazard near sidewalk.\nContact: (555) 310-7788\nPlease dispatch emergency crew."
  },
  {
    id: "sample-2",
    label: "Routine Vegetation",
    value:
      "From: jlin@gridsurvey.io\nSubject: Vegetation Trim Request for Pole P-88910\n\nRoutine note from site visit: tree branches encroaching near overhead lines at 22 Oak Meadow Dr.\nInspector: Jamie Lin\nPhone: 555-220-7780\nNo immediate hazard, but recommended trim within 14 days."
  },
  {
    id: "sample-3",
    label: "Broken Crossarm",
    value:
      "From: mthomas@fieldops.net\nSubject: Safety issue - broken crossarm\n\nObserved cracked crossarm and loose hardware on utility pole P-12004 behind 700 Pine St.\nPotential risk in high wind conditions.\nInspector: Morgan Thomas\nEmail: mthomas@fieldops.net\nCall back: +1 555 019 6644"
  }
];

type SampleSelectorProps = {
  onInsert: (value: string) => void;
};

export default function SampleSelector({ onInsert }: SampleSelectorProps) {
  const [selectedId, setSelectedId] = useState(SAMPLE_EMAILS[0].id);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label htmlFor="sample-email" className="mb-2 block text-sm font-medium text-slate-700">
        Sample Emails
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          id="sample-email"
          suppressHydrationWarning
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {SAMPLE_EMAILS.map((sample) => (
            <option key={sample.id} value={sample.id}>
              {sample.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            const selected = SAMPLE_EMAILS.find((sample) => sample.id === selectedId) ?? SAMPLE_EMAILS[0];
            onInsert(selected.value);
          }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90"
        >
          Insert
        </button>
      </div>
    </div>
  );
}
