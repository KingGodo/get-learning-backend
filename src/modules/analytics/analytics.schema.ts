import { z } from "zod";

const day = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .optional(),
);

export const performanceReportQuerySchema = z
  .object({
    classId: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.string().trim().min(1).optional(),
    ),
    from: day,
    to: day,
    compareFrom: day,
    compareTo: day,
  })
  .superRefine((value, ctx) => {
    const compare = [value.compareFrom, value.compareTo].filter(Boolean);
    if (compare.length === 1) {
      ctx.addIssue({
        code: "custom",
        path: ["compareFrom"],
        message: "Choose both dates for the second period",
      });
    }
  });
