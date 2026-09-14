import { z } from "zod";

export const listAuditQuerySchema = z.object({
  action: z.string().trim().min(1).optional(),
  entityType: z.string().trim().min(1).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;
