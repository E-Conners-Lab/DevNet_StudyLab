import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { isDbConfigured, getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { jsonOk, jsonBadRequest, jsonError } from "@/lib/api-helpers";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    // Validate required fields
    if (!name || typeof name !== "string" || !name.trim()) {
      return jsonBadRequest("Name is required");
    }

    if (!email || typeof email !== "string") {
      return jsonBadRequest("Valid email is required");
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return jsonBadRequest("Invalid email format");
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return jsonBadRequest("Password must be at least 8 characters");
    }

    if (!isDbConfigured()) {
      return jsonError("Database is not configured", 503);
    }

    const db = getDb();

    // Check for existing email
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      return jsonError("Email already in use", 409);
    }

    // Hash password and insert user
    const hashedPassword = await bcrypt.hash(password, 12);

    await db.insert(schema.users).values({
      name: name.trim(),
      email: email.toLowerCase(),
      hashedPassword,
    });

    return jsonOk({ success: true }, 201);
  } catch (err) {
    console.error("Signup error:", err);
    return jsonError("Something went wrong");
  }
}
