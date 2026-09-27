import { NextResponse } from "next/server";

/**
 * Standard JSON success response.
 */
export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Standard JSON error response.
 */
export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonBadRequest(message: string) {
  return jsonError(message, 400);
}

export function jsonNotFound(resource = "Resource") {
  return jsonError(`${resource} not found`, 404);
}

export function jsonUnauthorized(message = "Authentication required") {
  return jsonError(message, 401);
}

/**
 * 429 with a `Retry-After` header, so a client knows when to come back rather
 * than retrying immediately.
 */
export function jsonTooManyRequests(
  retryAfterSeconds: number,
  message = "Too many requests. Please slow down.",
) {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}
