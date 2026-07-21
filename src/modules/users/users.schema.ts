import { z } from "zod";
import {
  genderSchema,
  passwordSchema,
  phoneSchema,
} from "../../common/validation/schemas.js";

const personBaseSchema = z.object({
  firstName: z.string().trim().min(1, "firstName is required").max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1, "lastName is required").max(100),
  email: z.email("Valid email is required"),
  phoneNumber: phoneSchema,
  gender: genderSchema,
  /** Optional; a temporary password is generated when omitted. */
  password: passwordSchema.optional(),
  /**
   * Required when a platform ADMIN creates the user.
   * Ignored for SCHOOL_ADMIN (their school is used).
   */
  schoolId: z.string().trim().min(1).optional(),
});

export const createTeacherSchema = personBaseSchema.extend({
  department: z.string().trim().max(100).optional(),
  qualification: z.string().trim().max(200).optional(),
});

export const createStudentSchema = personBaseSchema.extend({
  dateOfBirth: z.iso.datetime("dateOfBirth must be an ISO datetime").optional(),
  guardianName: z.string().trim().min(1, "guardianName is required").max(150),
  guardianPhone: phoneSchema,
  guardianEmail: z.email("Valid guardianEmail is required").optional(),
  emergencyContact: z.string().trim().max(150).optional(),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"], {
    error: "status must be ACTIVE, INACTIVE, or SUSPENDED",
  }),
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
