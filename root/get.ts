import { prisma } from "@/index";
import type { Context } from "hono";

export default async function get(c: Context) {
  // get all users and return the one with highest score
  const users = await prisma.user.findMany();
  const highestScoringUser = users.reduce((prev, curr) => {
    return prev.score > curr.score ? prev : curr;
  });
  return c.json({ message: highestScoringUser });
}
