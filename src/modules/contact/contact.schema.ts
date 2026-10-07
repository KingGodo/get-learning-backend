import { z } from "zod";

export const createContactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80, "Name is too long"),
  email: z.email("Enter a valid email address"),
  message: z
    .string()
    .trim()
    .min(10, "Write a short message")
    .max(2000, "Message is too long"),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
