"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Objective {
  id: string;
  title: string;
  completed: boolean;
  labSlug?: string;
}

interface StudyDomain {
  number: number;
  name: string;
  slug: string;
  weight: number;
  progress: number;
  objectives: Objective[];
}

const studyDomains: StudyDomain[] = [
  {
    number: 1,
    name: "Software Development & Design",
    slug: "software-dev",
    weight: 15,
    progress: 42,
    objectives: [
      { id: "1.1", title: "Compare data formats (XML, JSON, and YAML)", completed: true },
      { id: "1.2", title: "Describe parsing of common data format to Python data structures", completed: true },
      { id: "1.3", title: "Describe the concepts of test-driven development", completed: false },
      { id: "1.4", title: "Compare software development methods (Agile, Lean, Waterfall)", completed: true },
      { id: "1.5", title: "Explain the benefits of organizing code into methods, functions, classes, and modules", completed: false },
      { id: "1.6", title: "Identify the advantages of common design patterns (MVC and Observer)", completed: false },
      { id: "1.7", title: "Explain the advantages of version control", completed: true, labSlug: "git-basics" },
      { id: "1.8", title: "Utilize common version control operations with Git", completed: true, labSlug: "git-basics" },
    ],
  },
  {
    number: 2,
    name: "Understanding & Using APIs",
    slug: "apis",
    weight: 20,
    progress: 65,
    objectives: [
      { id: "2.1", title: "Construct a REST API request to accomplish a task given API documentation", completed: true, labSlug: "rest-api-client" },
      { id: "2.2", title: "Describe common usage patterns related to webhooks", completed: true },
      { id: "2.3", title: "Identify the constraints when consuming APIs", completed: true },
      { id: "2.4", title: "Explain common HTTP response codes associated with REST APIs", completed: true },
      { id: "2.5", title: "Troubleshoot a problem given the HTTP response code, request and API documentation", completed: false },
      { id: "2.6", title: "Identify the parts of an HTTP response (response code, headers, body)", completed: true },
      { id: "2.7", title: "Utilize common API authentication mechanisms: basic, custom token, and API keys", completed: true },
      { id: "2.8", title: "Compare common API styles (REST, RPC, synchronous, and asynchronous)", completed: false },
      { id: "2.9", title: "Construct a Python script that calls a REST API using the requests library", completed: true, labSlug: "rest-api-client" },
    ],
  },
  {
    number: 3,
    name: "Cisco Platforms & Development",
    slug: "cisco-platforms",
    weight: 15,
    progress: 28,
    objectives: [
      { id: "3.1", title: "Construct a Python script that uses a Cisco SDK given SDK documentation", completed: false },
      { id: "3.2", title: "Describe the capabilities of Cisco network management platforms (Meraki, DNA Center, ACI, NSO)", completed: true },
      { id: "3.3", title: "Describe the capabilities of Cisco compute management platforms (UCS Manager, Intersight)", completed: false },
      { id: "3.4", title: "Describe the capabilities of Cisco collaboration platforms (Webex Teams, Webex devices)", completed: true },
      { id: "3.5", title: "Describe the capabilities of Cisco security platforms (Firepower, Umbrella, AMP, ISE, ThreatGrid)", completed: false },
      { id: "3.6", title: "Describe the device level APIs and dynamic interfaces for IOS XE and NX-OS", completed: true, labSlug: "netconf-basics" },
      { id: "3.7", title: "Identify the appropriate DevNet resource for a given scenario", completed: false },
    ],
  },
  {
    number: 4,
    name: "Application Deployment & Security",
    slug: "deployment-security",
    weight: 15,
    progress: 55,
    objectives: [
      { id: "4.1", title: "Describe benefits of edge computing", completed: true },
      { id: "4.2", title: "Identify attributes of different application deployment models (private cloud, public cloud, hybrid cloud, edge)", completed: true },
      { id: "4.3", title: "Identify the attributes of these application deployment types (virtual machines, bare metal, containers)", completed: true },
      { id: "4.4", title: "Describe components for a CI/CD pipeline in application deployments", completed: false, labSlug: "docker-basics" },
      { id: "4.5", title: "Construct a Python unit test", completed: false },
      { id: "4.6", title: "Interpret contents of a Dockerfile", completed: true, labSlug: "docker-basics" },
      { id: "4.7", title: "Utilize Docker images to create containers", completed: true, labSlug: "docker-basics" },
      { id: "4.8", title: "Identify steps needed to integrate an application into a prebuilt CI/CD workflow", completed: false },
    ],
  },
  {
    number: 5,
    name: "Infrastructure & Automation",
    slug: "infrastructure-automation",
    weight: 20,
    progress: 38,
    objectives: [
      { id: "5.1", title: "Describe the value of model driven programmability for infrastructure automation", completed: true },
      { id: "5.2", title: "Compare controller-level to device-level management", completed: true },
      { id: "5.3", title: "Describe the use and roles of network simulation and test tools (pyATS)", completed: false },
      { id: "5.4", title: "Describe the components and benefits of CI/CD pipeline in infrastructure automation", completed: false },
      { id: "5.5", title: "Describe principles of infrastructure as code", completed: true },
      { id: "5.6", title: "Describe the capabilities of automation tools such as Ansible, Puppet, Chef, and Cisco NSO", completed: false, labSlug: "ansible-network" },
      { id: "5.7", title: "Identify the workflow being automated by a Python script that uses Cisco APIs including ACI, Meraki, DNA Center, or RESTCONF", completed: false },
      { id: "5.8", title: "Identify the workflow being automated by an Ansible playbook", completed: false, labSlug: "ansible-network" },
      { id: "5.9", title: "Identify the workflow being automated by a bash script", completed: true, labSlug: "bash-scripting" },
      { id: "5.10", title: "Interpret the results of a RESTCONF or NETCONF query", completed: true, labSlug: "netconf-basics" },
    ],
  },
  {
    number: 6,
    name: "Network Fundamentals",
    slug: "network-fundamentals",
    weight: 15,
    progress: 72,
    objectives: [
      { id: "6.1", title: "Describe the purpose and usage of MAC addresses and VLANs", completed: true },
      { id: "6.2", title: "Describe the purpose and usage of IP addresses, routes, subnet mask / prefix, and gateways", completed: true },
      { id: "6.3", title: "Describe the function of common networking components (switches, routers, firewalls, load balancers)", completed: true },
      { id: "6.4", title: "Interpret a basic network topology diagram", completed: true },
      { id: "6.5", title: "Describe the function of management, data, and control planes in a network device", completed: true },
      { id: "6.6", title: "Describe the functionality of these IP services: DHCP, DNS, NAT, SNMP, NTP", completed: false },
      { id: "6.7", title: "Recognize common protocol port numbers (SSH, Telnet, HTTP, HTTPS, NETCONF)", completed: true },
      { id: "6.8", title: "Identify cause of application connectivity issues (NAT problem, Transport port blocked, proxy, VPN)", completed: false },
      { id: "6.9", title: "Explain the impacts of network constraints on applications", completed: true },
    ],
  },
];

export default function StudyPage() {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(
    new Set()
  );
  const [completedObjectives, setCompletedObjectives] = useState<Set<string>>(
    () => {
      const completed = new Set<string>();
      studyDomains.forEach((domain) => {
        domain.objectives.forEach((obj) => {
          if (obj.completed) completed.add(obj.id);
        });
      });
      return completed;
    }
  );

  // Load study progress from API (DB wins over hardcoded defaults)
  useEffect(() => {
    fetch("/api/study/progress")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.completed && data.completed.length > 0) {
          setCompletedObjectives(new Set(data.completed));
        }
      })
      .catch(() => {
        // API unavailable — keep hardcoded defaults
      });
  }, []);

  const toggleDomain = (slug: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const toggleObjective = (id: string) => {
    const willComplete = !completedObjectives.has(id);
    setCompletedObjectives((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    // Fire-and-forget: persist to DB via API
    fetch("/api/study/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectiveCode: id, completed: willComplete }),
    }).catch(() => {
      // API unavailable — state change is still reflected in UI
    });
  };

  const totalObjectives = studyDomains.reduce(
    (acc, d) => acc + d.objectives.length,
    0
  );
  const totalCompleted = completedObjectives.size;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
          Study Hub
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Work through all exam objectives organized by domain
        </p>
      </div>

      {/* Overall Stats */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-500">Overall Completion</p>
              <p className="text-2xl font-bold text-zinc-100">
                {totalCompleted}{" "}
                <span className="text-base font-normal text-zinc-500">
                  / {totalObjectives} objectives
                </span>
              </p>
            </div>
            <div className="w-full sm:w-64">
              <Progress
                value={(totalCompleted / totalObjectives) * 100}
                className="h-2 bg-zinc-800 [&>[data-slot=progress-indicator]]:bg-emerald-500"
              />
              <p className="text-xs text-zinc-500 mt-1 text-right">
                {Math.round((totalCompleted / totalObjectives) * 100)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Domain Cards */}
      <div className="space-y-4">
        {studyDomains.map((domain) => {
          const isExpanded = expandedDomains.has(domain.slug);
          const domainCompleted = domain.objectives.filter((o) =>
            completedObjectives.has(o.id)
          ).length;
          const domainProgress = Math.round(
            (domainCompleted / domain.objectives.length) * 100
          );

          return (
            <Card
              key={domain.slug}
              className="border-zinc-800 bg-zinc-900/50 overflow-hidden"
            >
              {/* Domain header - clickable */}
              <button
                onClick={() => toggleDomain(domain.slug)}
                className="w-full text-left"
              >
                <CardHeader className="cursor-pointer hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-sm font-bold text-emerald-500 shrink-0">
                      {domain.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-sm font-semibold text-zinc-200">
                          {domain.name}
                        </CardTitle>
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px]"
                        >
                          {domain.weight}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <Progress
                          value={domainProgress}
                          className="h-1.5 flex-1 bg-zinc-800 [&>[data-slot=progress-indicator]]:bg-emerald-500"
                        />
                        <span className="text-xs text-zinc-500 shrink-0">
                          {domainCompleted}/{domain.objectives.length}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-zinc-500">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </button>

              {/* Objectives list */}
              {isExpanded && (
                <CardContent className="pt-0">
                  <Separator className="bg-zinc-800 mb-4" />
                  <div className="space-y-1">
                    {domain.objectives.map((objective) => {
                      const isCompleted = completedObjectives.has(objective.id);
                      return (
                        <div
                          key={objective.id}
                          className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-zinc-800/30 transition-colors group"
                        >
                          <button
                            onClick={() => toggleObjective(objective.id)}
                            className="mt-0.5 shrink-0"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-zinc-600 hover:text-zinc-400 transition-colors" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/dashboard/study/${domain.slug}`}
                              className={cn(
                                "text-sm leading-relaxed block rounded px-1 -mx-1 hover:bg-zinc-800/50 transition-colors",
                                isCompleted
                                  ? "text-zinc-500 line-through"
                                  : "text-zinc-300 hover:text-emerald-400"
                              )}
                            >
                              <span className="font-mono text-xs text-emerald-500/70 mr-2">
                                {objective.id}
                              </span>
                              {objective.title}
                            </Link>
                          </div>
                          {objective.labSlug && (
                            <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Link href="/dashboard/labs">
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="text-zinc-500 hover:text-emerald-400"
                                >
                                  <FlaskConical className="h-3 w-3" />
                                </Button>
                              </Link>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
