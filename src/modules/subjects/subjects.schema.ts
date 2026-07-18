import { z } from "zod";

export const createSubjectSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(100),
  code: z
    .string()
    .trim()
    .min(1, "code is required")
    .max(20, "code must be at most 20 characters")
    .transform((value) => value.toUpperCase()),
  description: z.string().trim().max(500).optional(),
});

export const updateSubjectSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    code: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .transform((value) => value.toUpperCase())
      .optional(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update",
  });

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
