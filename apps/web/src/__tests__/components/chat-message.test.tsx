import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessage } from "@/components/tutor/chat-message";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Bot: (props: Record<string, unknown>) => (
    <span data-testid="icon-bot" {...props} />
  ),
  User: (props: Record<string, unknown>) => (
    <span data-testid="icon-user" {...props} />
  ),
  Copy: (props: Record<string, unknown>) => (
    <span data-testid="icon-copy" {...props} />
  ),
  Check: (props: Record<string, unknown>) => (
    <span data-testid="icon-check" {...props} />
  ),
}));

// Mock radix-ui Avatar primitives to render basic HTML
vi.mock("radix-ui", () => ({
  Avatar: {
    Root: ({ children, ...props }: { children: React.ReactNode }) => (
      <div data-testid="avatar-root" {...props}>
        {children}
      </div>
    ),
    Image: (props: Record<string, unknown>) => (
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      <img data-testid="avatar-image" {...props} />
    ),
    Fallback: ({ children, ...props }: { children: React.ReactNode }) => (
      <span data-testid="avatar-fallback" {...props}>
        {children}
      </span>
    ),
  },
  Slot: {
    Root: "button",
  },
  Progress: {
    Root: ({ children, ...props }: { children: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
    Indicator: (props: Record<string, unknown>) => <div {...props} />,
  },
}));

describe("ChatMessage", () => {
  const now = new Date();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders user messages with correct alignment", () => {
    const { container } = render(
      <ChatMessage role="user" content="Hello, tutor!" timestamp={now} />
    );

    // User messages use flex-row-reverse for right alignment
    const messageWrapper = container.firstElementChild;
    expect(messageWrapper?.className).toContain("flex-row-reverse");
  });

  it("renders assistant messages with correct alignment", () => {
    const { container } = render(
      <ChatMessage
        role="assistant"
        content="Hello! How can I help?"
        timestamp={now}
      />
    );

    // Assistant messages use flex-row for left alignment
    const messageWrapper = container.firstElementChild;
    expect(messageWrapper?.className).toContain("flex-row");
    expect(messageWrapper?.className).not.toContain("flex-row-reverse");
  });

  it("parses and renders code blocks", () => {
    const contentWithCode = 'Here is some code:\n```python\nprint("hello")\n```';
    render(
      <ChatMessage role="assistant" content={contentWithCode} timestamp={now} />
    );

    // The code block content should be rendered
    expect(screen.getByText('print("hello")')).toBeInTheDocument();
    // The language label should appear
    expect(screen.getByText("python")).toBeInTheDocument();
  });

  it("parses inline code", () => {
    const contentWithInline = "Use the `requests` library for HTTP calls.";
    render(
      <ChatMessage
        role="assistant"
        content={contentWithInline}
        timestamp={now}
      />
    );

    // Inline code should be rendered in a code element
    const codeElement = screen.getByText("requests");
    expect(codeElement.tagName).toBe("CODE");
  });

  it("shows timestamps", () => {
    // Use a timestamp from 5 minutes ago to get "5m ago"
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    render(
      <ChatMessage
        role="user"
        content="Test message"
        timestamp={fiveMinAgo}
      />
    );

    expect(screen.getByText("5m ago")).toBeInTheDocument();
  });

  it("shows 'Just now' for very recent messages", () => {
    const justNow = new Date(now.getTime() - 10 * 1000); // 10 seconds ago
    render(
      <ChatMessage
        role="user"
        content="Recent message"
        timestamp={justNow}
      />
    );

    // May appear more than once (e.g., in timestamp area), check at least one
    const elements = screen.getAllByText("Just now");
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it("shows correct avatar for user role", () => {
    render(
      <ChatMessage role="user" content="User message" timestamp={now} />
    );

    // Multiple icon-user elements may exist, verify at least one
    const userIcons = screen.getAllByTestId("icon-user");
    expect(userIcons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows correct avatar for assistant role", () => {
    render(
      <ChatMessage
        role="assistant"
        content="Assistant message"
        timestamp={now}
      />
    );

    // Multiple icon-bot elements may exist, verify at least one
    const botIcons = screen.getAllByTestId("icon-bot");
    expect(botIcons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders plain text content correctly", () => {
    render(
      <ChatMessage
        role="user"
        content="What is a REST API?"
        timestamp={now}
      />
    );

    expect(screen.getByText("What is a REST API?")).toBeInTheDocument();
  });
});
