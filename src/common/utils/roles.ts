import { UserRole } from "../../generated/prisma/client.js";

export function canManageUsers(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.SCHOOL_ADMIN;
}

export function canViewUsers(role: UserRole) {
  return canManageUsers(role) || role === UserRole.HEADMASTER;
}

export function canManageSchoolOps(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.SCHOOL_ADMIN;
}

export function canViewSchoolWide(role: UserRole) {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.SCHOOL_ADMIN ||
    role === UserRole.HEADMASTER
  );
}

export function isParent(role: UserRole) {
  return role === UserRole.PARENT;
}

export function isHeadmaster(role: UserRole) {
  return role === UserRole.HEADMASTER;
}
