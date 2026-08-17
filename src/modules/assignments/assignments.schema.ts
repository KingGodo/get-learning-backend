import { z } from "zod";

function formBoolean(defaultValue = false) {
  return z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return defaultValue;
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
      const normalized = val.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off"].includes(normalized)) return false;
    }
    return val;
  }, z.boolean());
}

function formIsoDatetime() {
  return z.preprocess((val) => {
    if (typeof val !== "string" || !val.trim()) return val;
    const parsed = new Date(val);
    if (Number.isNaN(parsed.getTime())) return val;
    return parsed.toISOString();
  }, z.iso.datetime("dueDate must be an ISO datetime"));
}

export const createAssignmentSchema = z.object({
  classId: z.string().min(1, "classId is required"),
  title: z.string().trim().min(1, "title is required").max(200),
  description: z.string().trim().min(1, "description is required").max(5000),
  instructions: z.string().trim().max(5000).optional(),
  dueDate: formIsoDatetime(),
  totalMarks: z.coerce
    .number()
    .int("totalMarks must be an integer")
    .positive("totalMarks must be greater than 0"),
  allowLateSubmission: formBoolean(false),
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
  dueDate: formIsoDatetime().optional(),
  totalMarks: z.coerce.number().int().positive().optional(),
  allowLateSubmission: formBoolean(false).optional(),
  status: z
    .enum(["DRAFT", "PUBLISHED", "CLOSED"], {
      error: "status must be DRAFT, PUBLISHED, or CLOSED",
    })
    .optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
