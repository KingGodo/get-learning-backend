import { z } from "zod";
import {
  genderSchema,
  passwordSchema,
  phoneSchema,
} from "../../common/validation/schemas.js";

const schoolAdminSchema = z.object({
  firstName: z.string().trim().min(1, "admin.firstName is required").max(100),
  lastName: z.string().trim().min(1, "admin.lastName is required").max(100),
  email: z.email("Valid admin email is required"),
  phoneNumber: phoneSchema,
  gender: genderSchema,
  /** Optional; a temporary password is generated when omitted. */
  password: passwordSchema.optional(),
});

export const createSchoolSchema = z.object({
  name: z.string().trim().min(2, "name must be at least 2 characters").max(200),
  email: z.email("Valid email is required"),
  phoneNumber: phoneSchema,
  website: z.url("website must be a valid URL").optional(),
  address: z.string().trim().min(2, "address is required").max(300),
  city: z.string().trim().min(2, "city is required").max(100),
  province: z.string().trim().min(2, "province is required").max(100),
  country: z.string().trim().min(2).max(100).optional(),
  termSystem: z.enum(["TERM", "SEMESTER", "QUARTER"]).optional(),
  termsPerYear: z.number().int().min(1).max(4).optional(),
  admin: schoolAdminSchema,
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
    termSystem: z.enum(["TERM", "SEMESTER", "QUARTER"]).optional(),
    termsPerYear: z.number().int().min(1).max(4).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update",
  });

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
