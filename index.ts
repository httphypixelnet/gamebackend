import { Hono } from "hono";
import { PrismaClient } from "@prisma/client";
import {
  BaseUserSchema,
  UserSchema,
  UsersResponseSchema,
  type User,
} from "./schemas";
import { jsonMiddleware } from "./middleware";
import { treeifyError } from "zod";
export const prisma = new PrismaClient();

const app = new Hono();

app.get("/", jsonMiddleware<User[]>(UserSchema.array()), async (c) => {
  // get users from DB, sort by highest score.
  console.log('d')
  const users = await prisma.user.findMany({
    orderBy: { score: "desc" },
  });
  return c.json({ users });
});

app.post("/", jsonMiddleware<User>(UserSchema), async (c) => {
  const { data, success, error } = BaseUserSchema.safeParse(await c.req.json());
  if (!success) {
    return c.json(
      { message: "Invalid data", errors: treeifyError(error) },
      400
    );
  }
  const user = await prisma.user.create({
    data: {
      name: data.name,
    },
  });
  return c.json({ message: user });
});
app.put("/", async (c) => {
  await mockData();
  return c.json({
    message: "Mock data created",
    users: await prisma.user.findMany(),
  });
});

if (import.meta.main) {
  const port = process.env.PORT || 3000;
  console.log(`Starting server on port ${port}`);

  //   Bun.serve({
  //     fetch: app.fetch,
  //     port: port,
  //   });
  Bun.serve({
    fetch: app.fetch,
    port: 8080,
  });
}

export async function mockData() {
  await prisma.user.createMany({
    data: [
      { name: "Alice", score: 10 },
      { name: "Bob", score: 20 },
      { name: "Charlie", score: 30 },
    ],
  });
}
