import { z } from "zod";

export const createAssignmentSchema = z.object({
  classId: z.string().min(1, "classId is required"),
  title: z.string().trim().min(1, "title is required").max(200),
  description: z.string().trim().min(1, "description is required").max(5000),
  instructions: z.string().trim().max(5000).optional(),
  dueDate: z.iso.datetime("dueDate must be an ISO datetime"),
  totalMarks: z.coerce
    .number()
    .int("totalMarks must be an integer")
    .positive("totalMarks must be greater than 0"),
  allowLateSubmission: z.coerce.boolean().optional().default(false),
  status: z
    .enum(["DRAFT", "PUBLISHED", "CLOSED"], {
      error: "status must be DRAFT, PUBLISHED, or CLOSED",
    })
    .optional()
    .default("DRAFT"),
});

export const updateAssignmentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  instructions: z.string().trim().max(5000).nullable().optional(),
  dueDate: z.iso.datetime("dueDate must be an ISO datetime").optional(),
  totalMarks: z.coerce.number().int().positive().optional(),
  allowLateSubmission: z.coerce.boolean().optional(),
  status: z
    .enum(["DRAFT", "PUBLISHED", "CLOSED"], {
      error: "status must be DRAFT, PUBLISHED, or CLOSED",
    })
    .optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
