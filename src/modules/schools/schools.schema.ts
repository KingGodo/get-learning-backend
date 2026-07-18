import { z } from "zod";
import { phoneSchema } from "../../common/validation/schemas.js";

export const createSchoolSchema = z.object({
  name: z.string().trim().min(2, "name must be at least 2 characters").max(200),
  email: z.email("Valid email is required"),
  phoneNumber: phoneSchema,
  website: z.url("website must be a valid URL").optional(),
  address: z.string().trim().min(2, "address is required").max(300),
  city: z.string().trim().min(2, "city is required").max(100),
  province: z.string().trim().min(2, "province is required").max(100),
  country: z.string().trim().min(2).max(100).optional(),
});

export const updateSchoolSchema = z
  .object({
    name: z.string().trim().min(2, "name must be at least 2 characters").max(200).optional(),
    email: z.email("Valid email is required").optional(),
    phoneNumber: phoneSchema.optional(),
    website: z.url("website must be a valid URL").nullable().optional(),
    address: z.string().trim().min(2).max(300).optional(),
    city: z.string().trim().min(2).max(100).optional(),
    province: z.string().trim().min(2).max(100).optional(),
    country: z.string().trim().min(2).max(100).optional(),
    logo: z.url("logo must be a valid URL").nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update",
  });

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
