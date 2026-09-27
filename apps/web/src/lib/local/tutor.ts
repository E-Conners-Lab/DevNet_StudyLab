import { z } from "zod";
interface Message {
    id: number;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
}
interface Conversation {
    id: string;
    title: string;
    domainId: number | null;
    createdAt: string;
    updatedAt: string;
    messages: Message[];
}
const titleSchema = z.string().trim().min(1).max(200);
export function createTutorMemory() {
    let conversations: Conversation[] = [];
    return function tutor(path: string, method: string, body: unknown): Response {
        const parts = path.split("/").slice(4), id = parts[0], conversation = conversations.find(item => item.id === id);
        if (!id && method === "GET")
            return Response.json({ conversations: conversations.map(item => ({ id: item.id, title: item.title, domainId: item.domainId, createdAt: item.createdAt, updatedAt: item.updatedAt })) });
        if (!id && method === "POST") {
            const data = z.object({ title: titleSchema, domainId: z.number().int().min(1).max(6).nullable() }).strict().parse(body);
            if (conversations.length >= 20)
                return Response.json({ error: "Delete a conversation before starting another (20 maximum)." }, { status: 409 });
            const createdAt = new Date().toISOString(), created = { ...data, id: crypto.randomUUID(), createdAt, updatedAt: createdAt, messages: [] };
            conversations = [created, ...conversations];
            return Response.json({ id: created.id });
        }
        if (!conversation)
            return Response.json({ error: "Conversation not found" }, { status: 404 });
        if (parts.length === 1 && method === "GET")
            return Response.json({ conversation });
        if (parts.length === 1 && method === "DELETE") {
            conversations = conversations.filter(item => item.id !== id);
            return Response.json({ success: true });
        }
        if (parts.length === 1 && method === "PATCH") {
            const { title } = z.object({ title: titleSchema }).strict().parse(body);
            conversations = conversations.map(item => item.id === id ? { ...item, title, updatedAt: new Date().toISOString() } : item);
            return Response.json({ success: true });
        }
        if (parts.length === 2 && parts[1] === "messages" && method === "POST") {
            const data = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(64000) }).strict().parse(body);
            if (conversation.messages.length >= 100)
                return Response.json({ error: "Conversation limit reached. Start a new conversation." }, { status: 409 });
            const message = { ...data, id: conversation.messages.length + 1, createdAt: new Date().toISOString() };
            conversations = conversations.map(item => item.id === id ? { ...item, messages: [...item.messages, message], updatedAt: message.createdAt } : item);
            return Response.json({ id: message.id });
        }
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    };
}
async function requestTutor(body: unknown, signal: AbortSignal | null | undefined, network: typeof fetch) {
    const session = await network("/api/v1/session", { credentials: "same-origin", signal, cache: "no-store" });
    if (!session.ok)
        return session;
    const data = await session.json();
    if (typeof data.csrfToken !== "string" || !data.csrfToken)
        return Response.json({ error: "Could not initialize the local tutor session." }, { status: 503 });
    return network("/api/v1/tutor", { method: "POST", credentials: "same-origin", signal, headers: { "Content-Type": "application/json", "X-CSRF-Token": data.csrfToken }, body: JSON.stringify(body) });
}

export async function sendTutor(body: unknown, signal: AbortSignal | null | undefined, network: typeof fetch) {
    try { return await requestTutor(body, signal, network); }
    catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
        return Response.json({ error: "Could not reach the local tutor. Check that the launcher is running." }, { status: 503 });
    }
}
