import { z } from 'zod'

/**
 * Login form validation schema
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
})

export type LoginFormData = z.infer<typeof loginSchema>

/**
 * Registration form validation schema
 */
export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  username: z
    .string()
    .min(1, 'Username is required')
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  password: z
    .string()
    .min(1, 'Password is required'),
})

export type RegisterFormData = z.infer<typeof registerSchema>

/**
 * Entry form validation schema
 */
export const entrySchema = z.object({
  title: z
    .string()
    .max(200, 'Title must be less than 200 characters')
    .optional(),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(10000, 'Content must be less than 10,000 characters'),
  tags: z
    .array(z.string())
    .max(10, 'Maximum 10 tags allowed')
    .optional()
    .default([]),
  mood_user: z
    .number()
    .min(1, 'Mood must be between 1 and 5')
    .max(5, 'Mood must be between 1 and 5')
    .optional(),
})

export type EntryFormData = z.infer<typeof entrySchema>

/**
 * Settings form validation schema
 */
export const settingsSchema = z.object({
  search_half_life_days: z
    .number()
    .min(1, 'Half-life must be at least 1 day')
    .max(365, 'Half-life must be less than 365 days'),
  privacy_hard_delete: z.boolean(),
})

export type SettingsFormData = z.infer<typeof settingsSchema>
