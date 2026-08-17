import { z } from "zod";

export const createMaterialsSchema = z.object({
  description: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === "") return undefined;
      return val;
    }, z.string().trim().max(2000).optional()),
});

export const classIdParamSchema = z.object({
  classId: z.string().min(1, "classId is required"),
});

export const materialIdParamSchema = z.object({
  classId: z.string().min(1, "classId is required"),
  id: z.string().min(1, "id is required"),
});

export type CreateMaterialsInput = z.infer<typeof createMaterialsSchema>;
