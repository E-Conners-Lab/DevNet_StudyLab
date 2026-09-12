import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

/**
 * Current Claude model for the tutor. Pinned as an alias (no date suffix) so
 * the app tracks the supported release; the prior `claude-sonnet-4-20250514`
 * snapshot is deprecated.
 */
const TUTOR_MODEL = "claude-opus-5";

/** Thinking and the visible reply share this cap on current models. */
const TUTOR_MAX_TOKENS = 16000;

const REFUSAL_MESSAGE =
  "\n\nI can't help with that request. Let's get back to DevNet Associate topics.";

/**
 * Helper: create a streaming text Response so the chat UI renders the message
 * the same way it renders normal assistant replies.
 */
function streamTextResponse(text: string): Response {
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}

const domainSystemPrompts: Record<string, string> = {
  "software-dev": `You are an expert tutor focused on Domain 1: Software Development & Design for the Cisco DevNet Associate 200-901 exam.

Focus areas:
- Software development methodologies (Agile, Lean, Waterfall)
- Software design patterns: MVC, Observer, Singleton
- Version control with Git (branching, merging, pull requests)
- Python programming: data types, functions, classes, modules, error handling
- Unit testing with Python (unittest, pytest)
- Code review best practices
- Parsing data formats: JSON, XML, YAML
- Constructing and interpreting Python scripts for API interaction`,

  "apis": `You are an expert tutor focused on Domain 2: Understanding & Using APIs for the Cisco DevNet Associate 200-901 exam.

Focus areas:
- REST API concepts: HTTP methods (GET, POST, PUT, PATCH, DELETE), status codes, headers
- API authentication: Basic Auth, API keys, OAuth 2.0, token-based auth
- Pagination, rate limiting, and error handling in APIs
- SOAP vs REST comparison
- Working with Postman and curl
- Constructing REST API requests using Python (requests library)
- Interpreting API documentation (Swagger/OpenAPI)
- Webhooks and event-driven APIs
- Cisco API platforms (Meraki, Webex, Catalyst Center)`,

  "cisco-platforms": `You are an expert tutor focused on Domain 3: Cisco Platforms & Development for the Cisco DevNet Associate 200-901 exam.

Focus areas:
- Cisco Meraki Dashboard API
- Cisco Catalyst Center (DNA Center) APIs and Intent API
- Cisco ACI (Application Centric Infrastructure) and APIC
- Cisco SD-WAN (vManage) APIs
- Cisco NSO (Network Services Orchestrator)
- Webex APIs and Bot development
- Cisco platform capabilities and APIs for each platform
- Model-Driven Programmability with NETCONF, RESTCONF, and YANG
- Guest Shell and on-box programmability
- Cisco DevNet sandbox environments`,

  "deployment-security": `You are an expert tutor focused on Domain 4: Application Deployment & Security for the Cisco DevNet Associate 200-901 exam.

Focus areas:
- Docker containers: Dockerfile, images, volumes, networking
- Containers vs Virtual Machines
- CI/CD pipelines (Jenkins, GitHub Actions, GitLab CI)
- 12-Factor App methodology
- Cloud deployment models (IaaS, PaaS, SaaS)
- Edge computing concepts
- Application security: OWASP Top 10, SQL injection, XSS, CSRF
- Securing APIs: input validation, encryption, certificates
- Secret management and environment variables
- Firewall rules and network security basics`,

  "infrastructure-automation": `You are an expert tutor focused on Domain 5: Infrastructure & Automation for the Cisco DevNet Associate 200-901 exam.

Focus areas:
- Infrastructure as Code (IaC) concepts
- Ansible: playbooks, inventory, modules, roles, YAML syntax
- Terraform: providers, resources, state, plan, apply
- Puppet and Chef overview
- NETCONF protocol: operations, capabilities, XML-based
- RESTCONF protocol: REST-based interface to YANG models
- YANG data models: containers, leaves, lists, augmentations
- Network automation workflows
- Configuration management and drift detection
- Model-Driven Telemetry (MDT)
- Python automation with Netmiko, Paramiko, NAPALM, pyATS`,

  "network-fundamentals": `You are an expert tutor focused on Domain 6: Network Fundamentals for the Cisco DevNet Associate 200-901 exam.

Focus areas:
- IP addressing and subnetting (IPv4 and IPv6)
- CIDR notation and VLSM
- OSI model and TCP/IP model layers
- Switching: VLANs, trunking, STP
- Routing protocols: OSPF, EIGRP, BGP basics
- Static vs dynamic routing
- DHCP, DNS, NAT/PAT
- Wireless networking fundamentals
- Network components: routers, switches, firewalls, load balancers
- TCP vs UDP, ports, and protocols
- Network topologies and diagrams
- QoS concepts`,
};

const baseSystemPrompt = `You are an expert AI tutor for the Cisco DevNet Associate 200-901 certification exam. You are knowledgeable, patient, and encouraging.

Your expertise spans all six exam domains:
1. Software Development & Design (15%) - Python, design patterns, version control, testing
2. Understanding & Using APIs (20%) - REST, authentication, HTTP, API consumption
3. Cisco Platforms & Development (15%) - Meraki, Catalyst Center, ACI, SD-WAN, NSO, Webex
4. Application Deployment & Security (15%) - Docker, CI/CD, cloud, OWASP, security
5. Infrastructure & Automation (20%) - Ansible, Terraform, NETCONF, RESTCONF, YANG
6. Network Fundamentals (15%) - IP addressing, subnetting, VLANs, routing, DHCP, DNS, NAT

Teaching guidelines:
- Give clear, concise explanations with real-world examples
- Use code examples in Python when relevant
- Reference specific Cisco platforms and tools when applicable
- When quizzing, provide questions similar to the actual exam format
- Break down complex topics into digestible pieces
- Relate concepts back to exam objectives when possible
- Encourage hands-on practice with Cisco DevNet sandboxes
- If a student seems confused, try explaining from a different angle
- Format responses with markdown: use **bold** for key terms, \`code\` for inline code, and code blocks for multi-line code
- Use numbered or bulleted lists for steps and comparisons
- Latency-sensitive: begin your visible answer immediately`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.TUTOR_ANTHROPIC_KEY;

    if (!apiKey || apiKey === "your-anthropic-api-key-here") {
      return streamTextResponse(
        "The AI Tutor is not configured yet. To enable it, add your Anthropic API key to .env.local:\n\n" +
          "TUTOR_ANTHROPIC_KEY=<your Anthropic API key>\n\n" +
          "You can get an API key at https://console.anthropic.com/\n\n" +
          "Once configured, restart the dev server and the AI tutor will be ready to help you study for the DevNet Associate exam."
      );
    }

    const body = await request.json();
    const { messages, domain } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required and must not be empty." },
        { status: 400 }
      );
    }

    // Validate message structure
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { error: "Each message must have a role and content." },
          { status: 400 }
        );
      }
      if (msg.role !== "user" && msg.role !== "assistant") {
        return NextResponse.json(
          { error: "Message role must be 'user' or 'assistant'." },
          { status: 400 }
        );
      }
    }

    const systemPrompt =
      domain && domainSystemPrompts[domain]
        ? `${domainSystemPrompts[domain]}\n\n${baseSystemPrompt}`
        : baseSystemPrompt;

    const client = new Anthropic({ apiKey });

    const stream = await client.messages.stream({
      model: TUTOR_MODEL,
      max_tokens: TUTOR_MAX_TOKENS,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    // Create a ReadableStream that emits text chunks
    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            } else if (
              event.type === "message_delta" &&
              event.delta.stop_reason === "refusal"
            ) {
              controller.enqueue(encoder.encode(REFUSAL_MESSAGE));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);

    if (err instanceof Anthropic.APIError) {
      if (err.status === 401) {
        return streamTextResponse(
          "The Anthropic API key is invalid or expired. Please check your TUTOR_ANTHROPIC_KEY in .env.local and make sure it is correct.\n\n" +
            "You can manage your API keys at https://console.anthropic.com/"
        );
      }
      if (err.status === 429) {
        return streamTextResponse(
          "The AI Tutor is temporarily rate-limited. Please wait a moment and try again."
        );
      }
      return streamTextResponse(
        "Sorry, the AI Tutor encountered an error communicating with the Anthropic API. " +
          "Please try again in a moment.\n\n" +
          `Error: ${err.message || "Unknown API error"}`
      );
    }

    return streamTextResponse(
      "Sorry, something unexpected went wrong with the AI Tutor. Please try again. " +
        "If the problem persists, check the server logs for details."
    );
  }
}
