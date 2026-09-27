"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { StorageNotice } from "@/components/dashboard/storage-notice";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, TerminalSquare } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[280px] shrink-0">
        <Sidebar pathname={pathname} />
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm px-4 py-3">
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-200">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
              <TerminalSquare className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-zinc-50">DevNet StudyLab</span>
          </div>
        </div>
        <SheetContent
          side="left"
          className="w-[280px] p-0 bg-zinc-900 border-zinc-800"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <Sidebar pathname={pathname} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <ScrollArea className="h-screen">
          <div className="md:p-8 p-4 pt-[72px] md:pt-8">
            <StorageNotice />
            {children}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
