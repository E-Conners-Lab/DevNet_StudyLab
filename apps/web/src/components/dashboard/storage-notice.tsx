"use client";
import Link from 'next/link';
import { useStudyStore } from '@/lib/local/use-study';
export function StorageNotice() {
  const { error } = useStudyStore();
  if (!error) return null;
  return <div role="alert" className="mb-4 rounded border border-amber-500 bg-amber-950 p-4 text-amber-100">{error} <Link className="underline" href="/dashboard/settings">Export a backup in Settings before closing.</Link></div>;
}
