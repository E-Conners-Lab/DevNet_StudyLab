"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Mail,
  Sliders,
  Info,
  LogOut,
  ExternalLink,
  BookOpen,
} from "lucide-react";

// ---------------------------------------------------------------------------
// localStorage helpers for preferences
// ---------------------------------------------------------------------------

const PREFS_KEY = "devnet-settings";

interface Preferences {
  dailyFlashcardGoal: number;
  reviewBatchSize: number;
}

const defaultPrefs: Preferences = {
  dailyFlashcardGoal: 20,
  reviewBatchSize: 10,
};

function loadPrefs(): Preferences {
  if (typeof window === "undefined") return defaultPrefs;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...defaultPrefs, ...JSON.parse(raw) } : defaultPrefs;
  } catch {
    return defaultPrefs;
  }
}

function savePrefs(prefs: Preferences) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { data: session } = useSession();
  const [prefs, setPrefs] = useState<Preferences>(() => {
    if (typeof window !== "undefined") return loadPrefs();
    return defaultPrefs;
  });

  const userName = session?.user?.name ?? "Student";
  const userEmail = session?.user?.email ?? "student@devnet.lab";

  const updatePref = <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs(next);
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage your profile and study preferences
        </p>
      </div>

      {/* Profile Section */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <User className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-zinc-200">Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-zinc-800/50 px-4 py-3">
            <User className="h-4 w-4 text-zinc-500 shrink-0" />
            <div>
              <p className="text-xs text-zinc-500">Name</p>
              <p className="text-sm font-medium text-zinc-200">{userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-zinc-800/50 px-4 py-3">
            <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
            <div>
              <p className="text-xs text-zinc-500">Email</p>
              <p className="text-sm font-medium text-zinc-200">{userEmail}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Study Preferences */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Sliders className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-zinc-200">Study Preferences</CardTitle>
              <CardDescription>
                Customize your daily study goals
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Daily flashcard goal */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-300">
                Daily Flashcard Goal
              </label>
              <Badge
                variant="secondary"
                className="bg-zinc-800 text-zinc-300 text-xs"
              >
                {prefs.dailyFlashcardGoal} cards
              </Badge>
            </div>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={prefs.dailyFlashcardGoal}
              onChange={(e) =>
                updatePref("dailyFlashcardGoal", Number(e.target.value))
              }
              className="w-full h-2 rounded-full appearance-none bg-zinc-800 accent-emerald-500 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500"
            />
            <div className="flex justify-between text-xs text-zinc-600">
              <span>5</span>
              <span>25</span>
              <span>50</span>
            </div>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Review batch size */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-300">
                Review Batch Size
              </label>
              <Badge
                variant="secondary"
                className="bg-zinc-800 text-zinc-300 text-xs"
              >
                {prefs.reviewBatchSize} cards
              </Badge>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={5}
              value={prefs.reviewBatchSize}
              onChange={(e) =>
                updatePref("reviewBatchSize", Number(e.target.value))
              }
              className="w-full h-2 rounded-full appearance-none bg-zinc-800 accent-emerald-500 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500"
            />
            <div className="flex justify-between text-xs text-zinc-600">
              <span>5</span>
              <span>15</span>
              <span>30</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Info className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-zinc-200">About</CardTitle>
              <CardDescription>App information and resources</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-4 py-3">
            <span className="text-sm text-zinc-400">App Version</span>
            <span className="text-sm font-mono text-zinc-300">1.0.0</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-4 py-3">
            <span className="text-sm text-zinc-400">Exam Blueprint</span>
            <span className="text-sm font-mono text-zinc-300">200-901 v1.1</span>
          </div>
          <a
            href="https://developer.cisco.com/certification/devnet-associate/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-4 py-3 text-sm text-emerald-400 hover:bg-zinc-800 transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Cisco DevNet Associate Certification
            <ExternalLink className="h-3 w-3 ml-auto" />
          </a>
        </CardContent>
      </Card>

      {/* Account */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="pt-6">
          <Button
            variant="outline"
            className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
