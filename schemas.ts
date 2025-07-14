import {
  uuid,
  string,
  number,
  object,
  array,
  type infer as ZodInfer,
} from "zod";
export const UserSchema = object({
  id: uuid(),
  name: string().min(1),
  score: number().int().nonnegative(),
});

export const BaseUserSchema = object({
  name: string().min(1),
});

export const UsersResponseSchema = object({
  message: array(UserSchema),
});

export type User = ZodInfer<typeof UserSchema>;

export type BaseUser = ZodInfer<typeof BaseUserSchema>;

export type UsersResponse = ZodInfer<typeof UsersResponseSchema>;
