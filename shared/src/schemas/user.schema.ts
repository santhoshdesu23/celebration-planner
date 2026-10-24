import { z } from 'zod';

export const RegisterInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address')
    .max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters'),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UserResponse = z.infer<typeof UserResponseSchema>;

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}
