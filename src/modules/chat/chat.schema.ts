import { z } from "zod";

export const openChatSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("CLASS"),
    classId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("TEACHER_PARENT"),
    studentId: z.string().min(1),
    teacherId: z.string().min(1).optional(),
    parentId: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal("HEADMASTER_PARENT"),
    parentId: z.string().min(1).optional(),
  }),
]);

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "Write a message").max(2000),
});

export const messagesQuerySchema = z.object({
  after: z.string().trim().optional(),
});

export type OpenChatInput = z.infer<typeof openChatSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
