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

export const teacherAssignmentSchema = z.object({
  subjectId: z.string().trim().min(1, "subjectId is required"),
  classIds: z
    .array(z.string().trim().min(1))
    .min(1, "Select at least one class for each subject"),
});

export const createTeacherSchema = personBaseSchema.extend({
  password: passwordSchema,
  department: z.string().trim().max(100).optional(),
  qualification: z.string().trim().max(200).optional(),
  assignments: z
    .array(teacherAssignmentSchema)
    .min(1, "Assign at least one subject with classes"),
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

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    middleName: z.string().trim().max(100).optional().nullable(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: z.email("Valid email is required").optional(),
    phoneNumber: phoneSchema.optional(),
    gender: genderSchema.optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
    // teacher fields
    department: z.string().trim().max(100).optional().nullable(),
    qualification: z.string().trim().max(200).optional().nullable(),
    assignments: z.array(teacherAssignmentSchema).min(1).optional(),
    // student fields
    guardianName: z.string().trim().min(1).max(150).optional(),
    guardianPhone: phoneSchema.optional(),
    guardianEmail: z
      .union([z.email("Valid guardianEmail is required"), z.literal("")])
      .optional()
      .nullable(),
    emergencyContact: z.string().trim().max(150).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update",
  });

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type TeacherAssignmentInput = z.infer<typeof teacherAssignmentSchema>;
