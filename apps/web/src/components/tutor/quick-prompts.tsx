import { Badge } from "@/components/ui/badge";
import { Bot } from "lucide-react";
import { getDomainBySlug } from "@/lib/domains";

const quickPrompts = [
  {
    text: "Explain REST API authentication methods",
    domain: "apis",
  },
  {
    text: "What's the difference between NETCONF and RESTCONF?",
    domain: "infrastructure-automation",
  },
  {
    text: "Help me understand Docker containers vs VMs",
    domain: "deployment-security",
  },
  {
    text: "Quiz me on Cisco Meraki API endpoints",
    domain: "cisco-platforms",
  },
  {
    text: "Explain the MVC design pattern with a Python example",
    domain: "software-dev",
  },
  {
    text: "What are the key OWASP threats I need to know?",
    domain: "deployment-security",
  },
];

interface QuickPromptsProps {
  onSelect: (prompt: string, domain: string) => void;
}

export function QuickPrompts({ onSelect }: QuickPromptsProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] gap-8">
      <div className="text-center space-y-3">
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-emerald-500/10">
          <Bot className="h-7 w-7 text-emerald-500" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-200">
          DevNet AI Tutor
        </h2>
        <p className="text-sm text-zinc-500 max-w-md">
          Ask me anything about the Cisco DevNet Associate 200-901 exam.
          I can explain concepts, provide code examples, and quiz you.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
        {quickPrompts.map((prompt, i) => {
          const domain = getDomainBySlug(prompt.domain);
          return (
            <button
              key={i}
              onClick={() => onSelect(prompt.text, prompt.domain)}
              className="group flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left transition-all hover:border-emerald-500/30 hover:bg-zinc-800/50"
            >
              <span className="text-sm text-zinc-300 group-hover:text-zinc-100 leading-snug">
                {prompt.text}
              </span>
              {domain && (
                <Badge
                  variant="secondary"
                  className="w-fit bg-zinc-800 text-zinc-500 text-[10px] group-hover:bg-emerald-500/10 group-hover:text-emerald-400"
                >
                  D{domain.number} {domain.shortName}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
