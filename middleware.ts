import { createMiddleware } from "hono/factory";
import { treeifyError, type ZodType } from "zod";
export const jsonMiddleware = <T>(schema: ZodType<T>) => {
  // create middleware that validates the response body against the schema
  return createMiddleware(async (c, next) => {
    await next();
    const body = await c.res.json();
    const { success, data, error } = schema.safeParse(body);
    if (!success) {
      return c.json(
        { message: "Invalid data", errors: treeifyError(error) },
        400
      );
    } else return new Response(JSON.stringify(data));
  });
};
