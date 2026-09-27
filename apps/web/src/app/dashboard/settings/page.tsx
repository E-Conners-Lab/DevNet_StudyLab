"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportStudyProgress, importStudyProgress, resetStudyProgress } from "@/lib/local/store";

export default function SettingsPage() {
  const [message, setMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmImport, setConfirmImport] = useState<string | null>(null);
  const perform = (action: () => void, success: string) => {
    try { action(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save progress. Export a backup before closing."); }
  };
  const download = () => perform(() => {
    const url = URL.createObjectURL(new Blob([exportStudyProgress()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "devnet-study-progress.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "Backup downloaded.");
  const readBackup = async (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMessage("Backup exceeds the 2 MiB limit."); return; }
    try { setConfirmImport(await file.text()); setMessage(""); }
    catch { setMessage("Could not read the selected backup."); }
  };
  return <div className="max-w-3xl mx-auto space-y-8 text-zinc-300">
    <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
    <section className="space-y-4 rounded-lg border border-zinc-800 p-6">
      <h2 className="text-lg font-semibold">Your local progress</h2>
      <p>Study progress and lab drafts are saved in this browser profile. Clearing browser data removes them. Export a backup regularly and before changing computers or browsers.</p>
      <Button onClick={download}>Export progress</Button>
      <div><label htmlFor="progress-backup" className="block mb-2">Import progress backup</label>
        <input id="progress-backup" type="file" accept=".json,application/json" onChange={event => { void readBackup(event.target.files?.[0]); event.target.value = ""; }} />
      </div>
      {confirmImport !== null && <div className="space-y-3">
        <p>Import replaces current progress after validation. Export your current progress first if you want to keep it.</p>
        <Button onClick={() => { perform(() => importStudyProgress(confirmImport), "Backup restored."); setConfirmImport(null); }}>Replace progress with backup</Button>{" "}
        <Button variant="outline" onClick={() => setConfirmImport(null)}>Cancel import</Button>
      </div>}
      <div>{confirmReset ? <div className="space-y-3">
        <p>This deletes all local progress and lab drafts. Export a backup first.</p>
        <Button variant="destructive" onClick={() => { perform(resetStudyProgress, "Local progress reset."); setConfirmReset(false); }}>Delete local progress</Button>{" "}
        <Button variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
      </div> : <Button variant="outline" onClick={() => setConfirmReset(true)}>Reset progress</Button>}</div>
      {message && <p role="status">{message}</p>}
    </section>
    <section className="space-y-3 rounded-lg border border-zinc-800 p-6">
      <h2 className="text-lg font-semibold">Optional AI assistance</h2>
      <p>The AI tutor uses your own Anthropic account. Set TUTOR_ANTHROPIC_KEY and TUTOR_MODEL in the local launcher environment; follow the release README. Never paste a key into a chat, lab, or backup.</p>
      <p>Only messages you send to the tutor and their conversation context leave your computer for Anthropic. Provider charges and policies apply. Conversations remain in memory and disappear when the app reloads.</p>
      <p>All other study tools work offline without a key. AI answers can be wrong; verify them against authoritative documentation.</p>
    </section>
    <section className="space-y-3 rounded-lg border border-zinc-800 p-6">
      <h2 className="text-lg font-semibold">About this edition</h2>
      <p>This is an unmaintained, local-only learning snapshot. Do not expose its launcher to the internet or a shared network. Use on a trusted personal computer.</p>
      <p>The curriculum follows historical Cisco DevNet Associate 200-901 objectives. It is independent study material, not an official Cisco product or a guarantee of current exam coverage.</p>
    </section>
  </div>;
}
