import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().min(1, "id is required"),
});

export const schoolCodeParamSchema = z.object({
  code: z
    .string()
    .min(3, "School code is required")
    .max(32, "School code is too long"),
});

export const classIdQuerySchema = z.object({
  classId: z.string().min(1, "classId must not be empty").optional(),
});

export const assignmentIdQuerySchema = z.object({
  assignmentId: z.string().min(1, "assignmentId must not be empty").optional(),
});

export const genderSchema = z.enum(
  ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"],
  { error: "gender must be MALE, FEMALE, OTHER, or PREFER_NOT_TO_SAY" },
);

export const phoneSchema = z
  .string()
  .min(7, "phoneNumber must be at least 7 characters")
  .max(20, "phoneNumber must be at most 20 characters");

export const passwordSchema = z
  .string()
  .min(8, "password must be at least 8 characters")
  .max(128, "password must be at most 128 characters");

/** Optional one-off password; blank/omitted means generate one. */
export const optionalPasswordSchema = z.preprocess((val) => {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, passwordSchema.optional());
