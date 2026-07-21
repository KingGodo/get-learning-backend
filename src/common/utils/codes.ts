import { customAlphabet } from "nanoid";

const generateSchoolCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const generateClassCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);
const generateEmployeeNumber = customAlphabet("0123456789", 6);
const generateStudentNumber = customAlphabet("0123456789", 8);
const generateTempPassword = customAlphabet(
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%",
  12,
);

export function newSchoolCode(): string {
  return `SCH-${generateSchoolCode()}`;
}

export function newClassCode(): string {
  return generateClassCode();
}

export function newEmployeeNumber(): string {
  return `TCH-${generateEmployeeNumber()}`;
}

export function newStudentNumber(): string {
  return `STU-${generateStudentNumber()}`;
}

/** Temporary password that meets the 8+ character auth requirement. */
export function newTemporaryPassword(): string {
  return `Tmp-${generateTempPassword()}!`;
}
