import { TerminalSquare } from "lucide-react";

interface AuthLayoutProps {
  subtitle: string;
  children: React.ReactNode;
}

export function AuthLayout({ subtitle, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <TerminalSquare className="h-7 w-7" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-zinc-50">
              DevNet StudyLab
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
