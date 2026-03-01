"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Play,
  Clock,
  CheckCircle2,
  Circle,
  RotateCw,
  Code2,
  Globe,
  GitBranch,
  Container,
  Terminal as TerminalIcon,
  Server,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getDifficultyClasses } from "@/lib/ui-constants";

type LabStatus = "not_started" | "in_progress" | "completed";
type LabDifficulty = "beginner" | "intermediate" | "advanced";
type LabCategory =
  | "all"
  | "python"
  | "api"
  | "git"
  | "docker"
  | "bash"
  | "ansible"
  | "netconf";

interface Lab {
  id: string;
  title: string;
  description: string;
  domain: string;
  domainNumber: number;
  category: LabCategory;
  difficulty: LabDifficulty;
  estimatedTime: string;
  status: LabStatus;
  icon: typeof Code2;
}

const labs: Lab[] = [
  {
    id: "python-data-parsing",
    title: "Python Data Parsing with JSON, XML & YAML",
    description:
      "Parse and manipulate data formats commonly used in network automation. Build parsers for API responses and configuration files.",
    domain: "Software Development & Design",
    domainNumber: 1,
    category: "python",
    difficulty: "beginner",
    estimatedTime: "45 min",
    status: "completed",
    icon: Code2,
  },
  {
    id: "rest-api-client",
    title: "Build a REST API Client with Python Requests",
    description:
      "Interact with REST APIs using Python. Make GET, POST, PUT, DELETE requests and handle authentication, pagination, and error responses.",
    domain: "Understanding & Using APIs",
    domainNumber: 2,
    category: "api",
    difficulty: "intermediate",
    estimatedTime: "60 min",
    status: "in_progress",
    icon: Globe,
  },
  {
    id: "netconf-basics",
    title: "NETCONF/RESTCONF Device Configuration",
    description:
      "Use NETCONF and RESTCONF to programmatically configure network devices. Work with YANG models and ncclient.",
    domain: "Cisco Platforms & Development",
    domainNumber: 3,
    category: "netconf",
    difficulty: "advanced",
    estimatedTime: "90 min",
    status: "not_started",
    icon: Server,
  },
  {
    id: "docker-basics",
    title: "Docker Containers for Network Apps",
    description:
      "Build, run, and manage Docker containers. Create Dockerfiles, work with images, and deploy a network monitoring application.",
    domain: "Application Deployment & Security",
    domainNumber: 4,
    category: "docker",
    difficulty: "intermediate",
    estimatedTime: "75 min",
    status: "not_started",
    icon: Container,
  },
  {
    id: "ansible-network",
    title: "Ansible Network Automation Playbooks",
    description:
      "Write Ansible playbooks to automate network device configuration. Use Cisco IOS modules and Jinja2 templates.",
    domain: "Infrastructure & Automation",
    domainNumber: 5,
    category: "ansible",
    difficulty: "advanced",
    estimatedTime: "90 min",
    status: "not_started",
    icon: TerminalIcon,
  },
  {
    id: "bash-scripting",
    title: "Bash Scripting for Network Operations",
    description:
      "Write bash scripts to automate common network operations: health checks, log parsing, backup configurations, and monitoring.",
    domain: "Network Fundamentals",
    domainNumber: 6,
    category: "bash",
    difficulty: "beginner",
    estimatedTime: "30 min",
    status: "completed",
    icon: TerminalIcon,
  },
  {
    id: "git-basics",
    title: "Git Version Control for NetDevOps",
    description:
      "Master Git workflows for network configuration management. Branching, merging, pull requests, and CI/CD integration.",
    domain: "Software Development & Design",
    domainNumber: 1,
    category: "git",
    difficulty: "beginner",
    estimatedTime: "40 min",
    status: "completed",
    icon: GitBranch,
  },
];

const categories: { value: LabCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "python", label: "Python" },
  { value: "api", label: "API" },
  { value: "git", label: "Git" },
  { value: "docker", label: "Docker" },
  { value: "bash", label: "Bash" },
  { value: "ansible", label: "Ansible" },
  { value: "netconf", label: "NETCONF" },
];

const difficultyColors: Record<LabDifficulty, string> = {
  beginner: getDifficultyClasses("beginner"),
  intermediate: getDifficultyClasses("intermediate"),
  advanced: getDifficultyClasses("advanced"),
};

const statusConfig: Record<
  LabStatus,
  { label: string; icon: typeof Circle; color: string }
> = {
  not_started: {
    label: "Not Started",
    icon: Circle,
    color: "text-zinc-500",
  },
  in_progress: {
    label: "In Progress",
    icon: RotateCw,
    color: "text-amber-400",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    color: "text-emerald-500",
  },
};

export default function LabsPage() {
  const router = useRouter();
  const [labStatuses, setLabStatuses] = useState<Record<string, LabStatus>>({});

  // Fetch lab completion statuses from API (DB overrides hardcoded defaults)
  useEffect(() => {
    fetch("/api/labs/attempts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.attempts && Object.keys(data.attempts).length > 0) {
          const statusMap: Record<string, LabStatus> = {};
          for (const [slug, attempt] of Object.entries(data.attempts)) {
            const a = attempt as { status: string };
            // Map DB status to UI status
            if (a.status === "completed") statusMap[slug] = "completed";
            else if (a.status === "started") statusMap[slug] = "in_progress";
            else if (a.status === "failed") statusMap[slug] = "in_progress";
          }
          setLabStatuses(statusMap);
        }
      })
      .catch(() => {
        // API unavailable — keep hardcoded defaults
      });
  }, []);

  // Merge fetched statuses with hardcoded defaults
  const labsWithStatus = labs.map((lab) => ({
    ...lab,
    status: labStatuses[lab.id] ?? lab.status,
  }));

  const completedCount = labsWithStatus.filter((l) => l.status === "completed").length;
  const inProgressCount = labsWithStatus.filter((l) => l.status === "in_progress").length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
            Hands-on Labs
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Practice with interactive coding labs aligned to exam objectives
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          >
            {completedCount} completed
          </Badge>
          <Badge
            variant="secondary"
            className="bg-amber-500/10 text-amber-400 border-amber-500/20"
          >
            {inProgressCount} in progress
          </Badge>
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs
        defaultValue="all"
      >
        <TabsList className="bg-zinc-900 border border-zinc-800 flex-wrap h-auto gap-1 p-1">
          {categories.map((cat) => (
            <TabsTrigger
              key={cat.value}
              value={cat.value}
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 text-xs"
            >
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* We render the same content for all tabs but filter the data */}
        {categories.map((cat) => (
          <TabsContent key={cat.value} value={cat.value}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {(cat.value === "all"
                ? labsWithStatus
                : labsWithStatus.filter((l) => l.category === cat.value)
              ).map((lab) => {
                const StatusIcon = statusConfig[lab.status].icon;
                return (
                  <Card
                    key={lab.id}
                    className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700 transition-all"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 shrink-0">
                            <lab.icon className="h-5 w-5 text-zinc-400" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold text-zinc-200 leading-tight">
                              {lab.title}
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <Badge
                                variant="secondary"
                                className="bg-zinc-800 text-zinc-400 text-[10px]"
                              >
                                Domain {lab.domainNumber}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-[10px] capitalize",
                                  difficultyColors[lab.difficulty]
                                )}
                              >
                                {lab.difficulty}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]"
                              >
                                <Zap className="h-2.5 w-2.5 mr-0.5" />
                                Runnable
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <CardDescription className="text-xs text-zinc-500 leading-relaxed">
                        {lab.description}
                      </CardDescription>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <Clock className="h-3 w-3" />
                            <span>{lab.estimatedTime}</span>
                          </div>
                          <div
                            className={cn(
                              "flex items-center gap-1.5 text-xs",
                              statusConfig[lab.status].color
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            <span>{statusConfig[lab.status].label}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className={cn(
                            "text-xs",
                            lab.status === "completed"
                              ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                              : "bg-emerald-600 text-white hover:bg-emerald-500"
                          )}
                          onClick={() => router.push(`/dashboard/labs/${lab.id}`)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          {lab.status === "completed"
                            ? "Redo"
                            : lab.status === "in_progress"
                            ? "Continue"
                            : "Start"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
