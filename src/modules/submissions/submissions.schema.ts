import { z } from "zod";

export const submitAssignmentSchema = z.object({
  assignmentId: z.string().min(1, "assignmentId is required"),
});

export const gradeSubmissionSchema = z.object({
  score: z.coerce
    .number()
    .int("score must be an integer")
    .min(0, "score cannot be negative"),
  feedback: z.string().trim().max(5000).optional(),
});

export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
