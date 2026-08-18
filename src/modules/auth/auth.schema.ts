import { z } from "zod";
import { genderSchema, passwordSchema, phoneSchema } from "../../common/validation/schemas.js";

export const registerTeacherSchema = z.object({
  firstName: z.string().trim().min(1, "firstName is required").max(100),
  lastName: z.string().trim().min(1, "lastName is required").max(100),
  email: z.email("Valid email is required"),
  phoneNumber: phoneSchema,
  password: passwordSchema,
  gender: genderSchema,
  schoolId: z.string().trim().min(1, "schoolId is required"),
});

export const registerStudentSchema = z.object({
  firstName: z.string().trim().min(1, "firstName is required").max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1, "lastName is required").max(100),
  email: z.email("Valid email is required"),
  phoneNumber: phoneSchema,
  password: passwordSchema,
  gender: genderSchema,
  dateOfBirth: z.iso.datetime("dateOfBirth must be an ISO datetime").optional(),
  guardianName: z.string().trim().min(1, "guardianName is required").max(150),
  guardianPhone: phoneSchema,
  guardianEmail: z.email("Valid guardianEmail is required").optional(),
  emergencyContact: z.string().trim().max(150).optional(),
});

export const loginSchema = z.object({
  email: z.email("Valid email is required"),
  password: z.string().min(1, "password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Valid email is required"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, "token is required"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "confirmPassword is required"),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, "firstName is required").max(100),
  middleName: z.string().trim().max(100).optional().nullable(),
  lastName: z.string().trim().min(1, "lastName is required").max(100),
  phoneNumber: phoneSchema,
  gender: genderSchema.optional(),
  dateOfBirth: z
    .union([z.iso.datetime("dateOfBirth must be an ISO datetime"), z.literal("")])
    .optional()
    .nullable(),
  // Teacher fields
  department: z.string().trim().max(100).optional().nullable(),
  qualification: z.string().trim().max(200).optional().nullable(),
  bio: z.string().trim().max(1000).optional().nullable(),
  // Student fields
  guardianName: z.string().trim().min(1).max(150).optional(),
  guardianPhone: phoneSchema.optional(),
  guardianEmail: z
    .union([z.email("Valid guardianEmail is required"), z.literal("")])
    .optional()
    .nullable(),
  emergencyContact: z.string().trim().max(150).optional().nullable(),
  // Optional password change
  currentPassword: z.string().optional(),
  newPassword: z
    .union([passwordSchema, z.literal("")])
    .optional(),
}).superRefine((data, ctx) => {
  if (data.newPassword && data.newPassword.length > 0 && !data.currentPassword) {
    ctx.addIssue({
      code: "custom",
      path: ["currentPassword"],
      message: "currentPassword is required to set a new password",
    });
  }
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "currentPassword is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "confirmPassword is required"),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export const verifyPasswordSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword is required"),
});

export const changeEmailSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword is required"),
  email: z.email("Valid email is required"),
});

export type RegisterTeacherInput = z.infer<typeof registerTeacherSchema>;
export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type VerifyPasswordInput = z.infer<typeof verifyPasswordSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
