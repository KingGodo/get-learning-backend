import { z } from "zod";

export const createClassSchema = z.object({
  subjectId: z.string().min(1, "subjectId is required"),
  name: z.string().trim().min(1, "name is required").max(150),
  description: z.string().trim().max(1000).optional(),
  academicYear: z
    .number()
    .int("academicYear must be an integer")
    .min(2000, "academicYear must be >= 2000")
    .max(2100, "academicYear must be <= 2100"),
  semester: z
    .number()
    .int("semester must be an integer")
    .min(1, "semester must be between 1 and 4")
    .max(4, "semester must be between 1 and 4"),
});

export const updateClassSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    academicYear: z.number().int().min(2000).max(2100).optional(),
    semester: z.number().int().min(1).max(4).optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"], {
      error: "status must be ACTIVE or ARCHIVED",
    }).optional(),
    subjectId: z.string().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update",
  });

export const joinClassSchema = z.object({
  classCode: z
    .string()
    .trim()
    .min(4, "classCode must be at least 4 characters")
    .max(16, "classCode must be at most 16 characters")
    .transform((value) => value.toUpperCase()),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type JoinClassInput = z.infer<typeof joinClassSchema>;
