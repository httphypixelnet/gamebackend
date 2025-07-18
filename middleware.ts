import { createMiddleware } from "hono/factory";
import { jwt } from "hono/jwt";
import { sign, verify } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";
import { treeifyError, type ZodType } from "zod";
import type { Variables } from ".";
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "925608eb301f642ea71f3f818311e93e13c351dc97b69dbc96c4986ae4d7d2e9";

export const jsonMiddleware = <T>(schema: ZodType<T>) => {
  // TODO validate request body against second schema
  // create middleware that validates the response body against the schema
  return createMiddleware(async (c, next) => {
    while (!c.res) await next();
    console.log(
      "Response sent:",
      c.res.status,
      c.res.headers.get("content-type")
    );
    if (!c.res.headers.get("content-type")?.includes("application/json")) {
      console.warn("Response is not JSON, skipping validation.");
      return;
    }
    const body = await c.res.clone().json();
    console.log("Response body:", body);
    const { success, error } = schema.safeParse(body);
    if (!success) {
      return c.json(
        { message: "Internal Server Error", errors: treeifyError(error) },
        400
      );
    }
  });
};

// JWT Authentication Middleware with optional skip for development
export const jwtAuthMiddleware = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  if (c.req.path === "/api/leaderboard")  { await next(); return; }
  if (process.env.SKIP_AUTH === "true") {
    console.log("AUTH SKIPPED - SKIP_AUTH environment variable is enabled");
    // Set a mock payload for development
    c.set("jwtPayload", {
      sub: "dev-user",
      userId: 1, // Default to user ID 1 for development
      role: "player",
      type: "development"
    });
    await next();
    return;
  }
  // Normal JWT authentication
  const jwtMiddleware = jwt({
    secret: JWT_SECRET,
  });
  
  return jwtMiddleware(c, next);
});

export const generateToken = async <T extends object>(
  payload: T
): Promise<string> => {
  const token = await sign(
    {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10,
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET
  );
  return token;
};

export const verifyToken = async (token: string): Promise<JWTPayload> => {
  try {
    const payload = await verify(token, JWT_SECRET);
    return payload;
  } catch (error) {
    throw new Error("Invalid token");
  }
};
export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ message: "Unauthorized - No token provided" }, 401);
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return c.json({ message: "Unauthorized - Invalid token format" }, 401);
  }

  try {
    const payload = await verifyToken(token);
    // Store user info in context for use in route handlers
    c.set("user", payload);
    await next();
  } catch (error) {
    return c.json({ message: "Unauthorized - Invalid token" }, 401);
  }
});
