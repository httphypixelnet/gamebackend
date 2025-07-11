import { createMiddleware } from 'hono/factory';
import type { ZodType } from 'zod';
export const jsonMiddleware = <T>(schema: ZodType<T>) => {
    // create middleware that validates the request body against the schema
  return createMiddleware(async (c, next) => {
    const body = await c.req.json();
    const { success, data, error } = schema.safeParse(body);
    if (!success) {
      return c.json({ message: 'Invalid data', errors: error.errors }, 400);
    }
    await next();
  });
};
