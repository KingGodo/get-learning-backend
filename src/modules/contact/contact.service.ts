import { AppError } from "../../common/errors/AppError.js";
import { prisma } from "../../config/prisma.js";
import type { CreateContactInput } from "./contact.schema.js";

const HOUR_MS = 60 * 60 * 1000;
/** How many messages one email address may send in an hour. */
const MAX_PER_HOUR = 5;

export async function createContactMessage(input: CreateContactInput) {
  const email = input.email.trim().toLowerCase();
  const since = new Date(Date.now() - HOUR_MS);
  const recent = await prisma.contactMessage.count({
    where: { email, createdAt: { gte: since } },
  });

  if (recent >= MAX_PER_HOUR) {
    throw new AppError(
      "Please wait a while before sending another message",
      429,
    );
  }

  await prisma.contactMessage.create({
    data: {
      name: input.name.trim(),
      email,
      message: input.message.trim(),
    },
  });

  return { message: "Message sent. We will reply to the email you entered." };
}
