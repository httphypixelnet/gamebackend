import { Hono } from "hono";
import { PrismaClient } from "@prisma/client";
import {
  generateToken,
  jwtAuthMiddleware,
} from "./middleware";
import { serveStatic } from "hono/bun";
export type Variables = { jwtPayload: { userId?: number; role?: string; type?: string }, public?: boolean };
export const prisma = new PrismaClient();
const app = new Hono<{ Variables: Variables }>();
// Public routes (no authentication required)
// Anonymous authentication - creates a new game client identity
app.post("/auth/anonymous", async (c) => {
  try {
    // Generate a unique client ID for this game session
    const clientId = crypto.randomUUID();
    // Create a user record in the database with a generated name
    const user = await prisma.user.create({
      data: { 
        name: `Player_${clientId.slice(0, 8)}`, // Short readable name
        score: 0 
      },
    });
    // Generate a JWT token that includes the user ID
    const token = await generateToken({
      sub: user.id,
      clientId: clientId,
      userId: user.id,
      role: "player",
      type: "anonymous"
    });
    return c.json({
      message: "Anonymous authentication successful",
      token,
      user: { 
        id: user.id, 
        name: user.name, 
        score: user.score,
        clientId: clientId,
        role: "player" 
      },
      instructions: "Store this token safely on the client. It serves as your permanent game identity."
    });
  } catch (error) {
    console.error("Anonymous auth error:", error);
    return c.json({ message: "Failed to create anonymous user" }, 500);
  }
});
// Optional: Traditional login for admin/dev purposes
app.post("/auth/login", async (c) => {
  const { username, password } = await c.req.json();
  // Admin login for debugging/management
  if (username === "admin" && password === "password") {
    const token = await generateToken({
      sub: "admin",
      username: username,
      role: "admin",
      type: "admin"
    });
    return c.json({
      message: "Admin login successful",
      token,
      user: { username, role: "admin" },
    });
  }
  return c.json({ message: "Invalid credentials" }, 401);
});
// Register route - creates user and returns JWT token
app.post("/auth/register", async (c) => {
  const { username, password, name } = await c.req.json();
  // In a real app, you'd hash the password and store in database
  // For demo purposes, we'll just create a user record
  try {
    const user = await prisma.user.create({
      data: { name: name || username },
    });
    const token = await generateToken({
      sub: user.id,
      username: username,
      role: "user",
    });
    return c.json({
      message: "Registration successful",
      token,
      user: { id: user.id, username, name: user.name, role: "user" },
    });
  } catch (error) {
    return c.json({ message: "Registration failed" }, 400);
  }
});
// Protected routes (require JWT authentication)
// Apply JWT middleware to all /api/* routes
app.use("/api/*", jwtAuthMiddleware);
// Game leaderboard endpoints
// Get leaderboard (top players)
app.get("/api/leaderboard", async (c) => {
  c.set("public", true); // Allow public access to leaderboard
  const users = await prisma.user.findMany({
    orderBy: { score: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      score: true,
    }
  });
  return c.json({ leaderboard: users });
});
// Update current player's score (requires auth)
app.post("/api/score", async (c) => {
  const payload = c.get("jwtPayload");
  const { score } = await c.req.json();
  if (!payload || !payload.userId) {
    return c.json({ message: "Invalid token" }, 401);
  }
  // For user-specific operations, ensure we have a real user when auth is skipped
  if (process.env.SKIP_AUTH === "true" && payload.type === "development") {
    // Check if development user exists, create if not
    const devUser = await prisma.user.findUnique({
      where: { id: payload.userId }
    });
    if (!devUser) {
      // Create development user
      await prisma.user.create({
        data: {
          id: payload.userId,
          name: "Dev Player",
          score: 0
        }
      });
      console.log("🔧 Created development user for SKIP_AUTH mode");
    }
  }
  // Validate score (add your game-specific validation here)
  if (typeof score !== "number" || score < 0) {
    return c.json({ message: "Invalid score" }, 400);
  }
  try {
    // Only allow updating if the new score is higher (prevents score manipulation)
    const updatedUser = await prisma.user.updateMany({
      where: {
        id: payload.userId,
        score: { lt: score } // Only update if new score is higher
      },
      data: { score }
    });
    if (updatedUser.count === 0) {
      // Either user not found or score not higher
      const currentUser = await prisma.user.findUnique({
        where: { id: payload.userId }
      });
      if (!currentUser) {
        return c.json({ message: "User not found" }, 404);
      }
      return c.json({ 
        message: "Score not updated - must be higher than current score",
        currentScore: currentUser.score,
        submittedScore: score
      }, 400);
    }
    // Get updated user data
    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });
    return c.json({ 
      message: "Score updated successfully", 
      user: {
        id: user?.id,
        name: user?.name,
        score: user?.score
      }
    });
  } catch (error) {
    console.error("Score update error:", error);
    return c.json({ message: "Failed to update score" }, 500);
  }
});
// Get current player's info
app.get("/api/me", async (c) => {
  const payload = c.get("jwtPayload");
  if (!payload || !payload.userId) {
    return c.json({ message: "Invalid token" }, 401);
  }
  // For user-specific operations, ensure we have a real user when auth is skipped
  if (process.env.SKIP_AUTH === "true" && payload.type === "development") {
    // Check if development user exists, create if not
    const devUser = await prisma.user.findUnique({
      where: { id: payload.userId }
    });
    if (!devUser) {
      // Create development user
      const newDevUser = await prisma.user.create({
        data: {
          id: payload.userId,
          name: "Dev Player",
          score: 0
        }
      });
      console.log("🔧 Created development user for SKIP_AUTH mode");
      return c.json({ user: newDevUser });
    }
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      score: true
    }
  });
  if (!user) {
    return c.json({ message: "User not found" }, 404);
  }
  return c.json({ user });
});
// Update player name (optional feature)
app.put("/api/name", async (c) => {
  const payload = c.get("jwtPayload");
  const { name } = await c.req.json();
  if (!payload || !payload.userId) {
    return c.json({ message: "Invalid token" }, 401);
  }
  if (!name || name.length < 2 || name.length > 20) {
    return c.json({ message: "Name must be 2-20 characters" }, 400);
  }
  // For user-specific operations, ensure we have a real user when auth is skipped
  if (process.env.SKIP_AUTH === "true" && payload.type === "development") {
    // Check if development user exists, create if not
    const devUser = await prisma.user.findUnique({
      where: { id: payload.userId }
    });
    if (!devUser) {
      // Create development user
      await prisma.user.create({
        data: {
          id: payload.userId,
          name: name,
          score: 0
        }
      });
      console.log("🔧 Created development user for SKIP_AUTH mode");
    }
  }
  try {
    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: { name },
      select: {
        id: true,
        name: true,
        score: true
      }
    });
    return c.json({ 
      message: "Name updated successfully", 
      user 
    });
  } catch (error) {
    console.error("Name update error:", error);
    return c.json({ message: "Failed to update name" }, 500);
  }
});
// Game API info endpoint
app.get("/", async (c) => {
  const isDevMode = process.env.SKIP_AUTH === "true";
  return c.json({
    message: "Unreal Engine Game Leaderboard API",
    version: "1.0.0",
    developmentMode: isDevMode,
    ...(isDevMode && {
      devWarning: "⚠️  DEVELOPMENT MODE: Authentication is disabled. Set SKIP_AUTH=false for production."
    }),
    endpoints: {
      // Public endpoints
      "Get API info": "GET /",
      "Anonymous auth": "POST /auth/anonymous",
      "Get leaderboard": "GET /api/leaderboard",
      // Protected endpoints (require Bearer token, or dev mode)
      "Get my info": `GET /api/me ${isDevMode ? "(dev mode - no auth required)" : "(requires auth)"}`,
      "Update score": `POST /api/score ${isDevMode ? "(dev mode - no auth required)" : "(requires auth)"}`,
      "Update name": `PUT /api/name ${isDevMode ? "(dev mode - no auth required)" : "(requires auth)"}`,
      // Admin endpoints
      "Admin login": "POST /auth/login",
      "Create mock data": "PUT /api/mock-data (requires admin auth)"
    },
    usage: isDevMode ? {
      "Development Mode": "Authentication is bypassed. You can call protected endpoints directly.",
      "Example": "curl -X POST http://localhost:9999/api/score -d '{\"score\": 1000}' -H 'Content-Type: application/json'"
    } : {
      "Step 1": "Call POST /auth/anonymous to get a token",
      "Step 2": "Store the token in your Unreal Engine game",
      "Step 3": "Use the token in Authorization header: 'Bearer YOUR_TOKEN'",
      "Step 4": "Submit scores via POST /api/score with { \"score\": 1000 }"
    }
  });
});

// serve static file Windows.7z
app.get("/Windows.7z", serveStatic({
  'path': './Windows.7z',
}));

// do not export default here, we are serving using Bun.serve for hot reload
// export default app;
if (import.meta.main) {
  const port = process.env.PORT || 9999;
  console.log(`Starting server on port ${port}`);
  Bun.serve({
    fetch: app.fetch,
    port: port,
  });
}
