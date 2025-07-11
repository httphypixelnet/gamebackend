import { z } from 'zod';
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  score: z.number().int().nonnegative(),
});

export const BaseUserSchema = z.object({
  name: z.string().min(1),
});

export const UsersResponseSchema = z.object({
  message: z.array(UserSchema),
});

export type User = z.infer<typeof UserSchema>;

export type BaseUser = z.infer<typeof BaseUserSchema>;

export type UsersResponse = z.infer<typeof UsersResponseSchema>;