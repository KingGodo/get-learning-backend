import {
  ChatRoomKind,
  EnrollmentStatus,
  Prisma,
  UserRole,
  UserStatus,
} from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/AppError.js";
import { prisma } from "../../config/prisma.js";
import type { OpenChatInput } from "./chat.schema.js";

type ActorContext = {
  userId: string;
  role: UserRole;
  schoolId: string | null;
};

const roomInclude = {
  class: {
    select: { id: true, name: true, subject: { select: { name: true } } },
  },
  teacher: {
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  parent: {
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  student: {
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      body: true,
      createdAt: true,
      sender: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.ChatRoomInclude;

type RoomRecord = Prisma.ChatRoomGetPayload<{ include: typeof roomInclude }>;

function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`;
}

async function loadActor(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { teacher: true, student: true, parent: true },
  });
  if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
    throw new AppError("Account not found", 404);
  }
  return user;
}

async function assertClassMember(
  actor: Awaited<ReturnType<typeof loadActor>>,
  classId: string,
) {
  const classRoom = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, schoolId: true, status: true },
  });
  if (!classRoom || classRoom.status !== "ACTIVE") {
    throw new AppError("Class not found", 404);
  }

  if (actor.role === UserRole.TEACHER && actor.teacher) {
    const link = await prisma.classTeacher.findUnique({
      where: {
        classId_teacherId: { classId, teacherId: actor.teacher.id },
      },
    });
    if (!link) {
      throw new AppError("You are not a teacher of this class", 403);
    }
    return classRoom;
  }

  if (actor.role === UserRole.STUDENT && actor.student) {
    const link = await prisma.classStudent.findUnique({
      where: {
        classId_studentId: { classId, studentId: actor.student.id },
      },
    });
    if (!link || link.status !== EnrollmentStatus.ACTIVE) {
      throw new AppError("You are not in this class", 403);
    }
    return classRoom;
  }

  throw new AppError("You do not have permission to perform this action", 403);
}

async function teacherTeachesStudent(teacherId: string, studentId: string) {
  const count = await prisma.classTeacher.count({
    where: {
      teacherId,
      class: {
        classStudents: {
          some: { studentId, status: EnrollmentStatus.ACTIVE },
        },
      },
    },
  });
  return count > 0;
}

function summarize(room: RoomRecord, actorUserId: string, role: UserRole) {
  const last = room.messages[0];
  let title = "Conversation";
  let subtitle = "Messages";

  if (room.kind === ChatRoomKind.CLASS && room.class) {
    title = room.class.name;
    subtitle = room.class.subject?.name ?? "Class";
  } else if (room.kind === ChatRoomKind.TEACHER_PARENT) {
    const teacherName = room.teacher ? fullName(room.teacher.user) : "Teacher";
    const parentName = room.parent ? fullName(room.parent.user) : "Parent";
    const studentName = room.student ? fullName(room.student.user) : "Student";
    title = role === UserRole.PARENT ? teacherName : parentName;
    subtitle = studentName;
  } else if (room.kind === ChatRoomKind.HEADMASTER_PARENT) {
    const parentName = room.parent ? fullName(room.parent.user) : "Parent";
    title = role === UserRole.PARENT ? "Headmaster" : parentName;
    subtitle = "School";
  }

  return {
    id: room.id,
    kind: room.kind,
    title,
    subtitle,
    classId: room.classId,
    teacherId: room.teacherId,
    parentId: room.parentId,
    studentId: room.studentId,
    updatedAt: room.updatedAt.toISOString(),
    lastMessage: last
      ? {
          body: last.body,
          createdAt: last.createdAt.toISOString(),
          senderName: fullName(last.sender),
          mine: false,
        }
      : null,
    viewerId: actorUserId,
  };
}

async function findRoom(id: string) {
  const room = await prisma.chatRoom.findUnique({
    where: { id },
    include: roomInclude,
  });
  if (!room) {
    throw new AppError("Conversation not found", 404);
  }
  return room;
}

async function assertRoomAccess(
  actor: Awaited<ReturnType<typeof loadActor>>,
  room: RoomRecord,
) {
  if (room.kind === ChatRoomKind.CLASS && room.classId) {
    await assertClassMember(actor, room.classId);
    return;
  }

  if (room.kind === ChatRoomKind.TEACHER_PARENT) {
    const isTeacher = actor.teacher?.id === room.teacherId;
    const isParent = actor.parent?.id === room.parentId;
    if (!isTeacher && !isParent) {
      throw new AppError("You do not have permission to perform this action", 403);
    }
    if (room.teacherId && room.studentId) {
      const allowed = await teacherTeachesStudent(room.teacherId, room.studentId);
      if (!allowed) {
        throw new AppError("This conversation is no longer available", 403);
      }
    }
    if (isParent && room.studentId && actor.parent) {
      const link = await prisma.parentStudent.findUnique({
        where: {
          parentId_studentId: {
            parentId: actor.parent.id,
            studentId: room.studentId,
          },
        },
      });
      if (!link) {
        throw new AppError("You do not have permission to perform this action", 403);
      }
    }
    return;
  }

  if (room.kind === ChatRoomKind.HEADMASTER_PARENT) {
    if (actor.role === UserRole.PARENT && actor.parent?.id === room.parentId) return;
    if (
      actor.role === UserRole.HEADMASTER &&
      actor.schoolId &&
      actor.schoolId === room.schoolId
    ) {
      return;
    }
  }

  throw new AppError("You do not have permission to perform this action", 403);
}

async function createOrFind(
  where: Prisma.ChatRoomWhereInput,
  data: Prisma.ChatRoomCreateInput,
) {
  const existing = await prisma.chatRoom.findFirst({ where, include: roomInclude });
  if (existing) return existing;
  try {
    return await prisma.chatRoom.create({ data, include: roomInclude });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const again = await prisma.chatRoom.findFirst({ where, include: roomInclude });
      if (again) return again;
    }
    throw error;
  }
}

export async function getInbox(ctx: ActorContext) {
  const actor = await loadActor(ctx.userId);
  const filters: Prisma.ChatRoomWhereInput[] = [];

  if (actor.teacher) {
    filters.push({
      kind: ChatRoomKind.CLASS,
      class: { classTeachers: { some: { teacherId: actor.teacher.id } } },
    });
    filters.push({
      kind: ChatRoomKind.TEACHER_PARENT,
      teacherId: actor.teacher.id,
    });
  }

  if (actor.student) {
    filters.push({
      kind: ChatRoomKind.CLASS,
      class: {
        classStudents: {
          some: {
            studentId: actor.student.id,
            status: EnrollmentStatus.ACTIVE,
          },
        },
      },
    });
  }

  if (actor.parent) {
    filters.push({ parentId: actor.parent.id });
  }

  if (actor.role === UserRole.HEADMASTER && actor.schoolId) {
    filters.push({
      kind: ChatRoomKind.HEADMASTER_PARENT,
      schoolId: actor.schoolId,
    });
  }

  const rooms =
    filters.length === 0
      ? []
      : await prisma.chatRoom.findMany({
          where: { OR: filters },
          include: roomInclude,
          orderBy: { updatedAt: "desc" },
        });

  const starts = await listStarts(actor);

  return {
    rooms: rooms.map((room) => summarize(room, actor.id, actor.role)),
    starts,
  };
}

async function listStarts(actor: Awaited<ReturnType<typeof loadActor>>) {
  const classes: Array<{ classId: string; name: string; subjectName: string | null }> =
    [];

  if (actor.teacher) {
    const taught = await prisma.classTeacher.findMany({
      where: { teacherId: actor.teacher.id, class: { status: "ACTIVE" } },
      select: {
        class: {
          select: { id: true, name: true, subject: { select: { name: true } } },
        },
      },
    });
    for (const row of taught) {
      classes.push({
        classId: row.class.id,
        name: row.class.name,
        subjectName: row.class.subject?.name ?? null,
      });
    }
  }

  if (actor.student) {
    const enrolled = await prisma.classStudent.findMany({
      where: {
        studentId: actor.student.id,
        status: EnrollmentStatus.ACTIVE,
        class: { status: "ACTIVE" },
      },
      select: {
        class: {
          select: { id: true, name: true, subject: { select: { name: true } } },
        },
      },
    });
    for (const row of enrolled) {
      classes.push({
        classId: row.class.id,
        name: row.class.name,
        subjectName: row.class.subject?.name ?? null,
      });
    }
  }

  const withParents: Array<{
    parentId: string;
    parentName: string;
    studentId: string;
    studentName: string;
  }> = [];

  if (actor.teacher) {
    const taught = await prisma.classTeacher.findMany({
      where: { teacherId: actor.teacher.id },
      select: {
        class: {
          select: {
            classStudents: {
              where: { status: EnrollmentStatus.ACTIVE },
              select: {
                student: {
                  select: {
                    id: true,
                    user: { select: { firstName: true, lastName: true } },
                    parents: {
                      select: {
                        parent: {
                          select: {
                            id: true,
                            user: {
                              select: { firstName: true, lastName: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const seen = new Set<string>();
    for (const row of taught) {
      for (const enrollment of row.class.classStudents) {
        for (const link of enrollment.student.parents) {
          const key = `${link.parent.id}:${enrollment.student.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          withParents.push({
            parentId: link.parent.id,
            parentName: fullName(link.parent.user),
            studentId: enrollment.student.id,
            studentName: fullName(enrollment.student.user),
          });
        }
      }
    }
  }

  const withTeachers: Array<{
    teacherId: string;
    teacherName: string;
    studentId: string;
    studentName: string;
  }> = [];

  if (actor.parent) {
    const children = await prisma.parentStudent.findMany({
      where: { parentId: actor.parent.id },
      select: {
        student: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
            classStudents: {
              where: {
                status: EnrollmentStatus.ACTIVE,
                class: { status: "ACTIVE" },
              },
              select: {
                class: {
                  select: {
                    classTeachers: {
                      select: {
                        teacher: {
                          select: {
                            id: true,
                            user: { select: { firstName: true, lastName: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const seen = new Set<string>();
    for (const child of children) {
      for (const enrollment of child.student.classStudents) {
        for (const link of enrollment.class.classTeachers) {
          const key = `${link.teacher.id}:${child.student.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          withTeachers.push({
            teacherId: link.teacher.id,
            teacherName: fullName(link.teacher.user),
            studentId: child.student.id,
            studentName: fullName(child.student.user),
          });
        }
      }
    }
  }

  const parents: Array<{
    parentId: string;
    parentName: string;
    studentNames: string;
  }> = [];

  if (actor.role === UserRole.HEADMASTER && actor.schoolId) {
    const rows = await prisma.parent.findMany({
      where: {
        user: {
          schoolId: actor.schoolId,
          deletedAt: null,
          status: UserStatus.ACTIVE,
        },
      },
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true } },
        children: {
          select: {
            student: {
              select: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: { user: { lastName: "asc" } },
    });
    for (const row of rows) {
      parents.push({
        parentId: row.id,
        parentName: fullName(row.user),
        studentNames: row.children
          .map((child) => fullName(child.student.user))
          .join(", "),
      });
    }
  }

  return {
    classes,
    withParents,
    withTeachers,
    withHeadmaster: actor.role === UserRole.PARENT && Boolean(actor.schoolId),
    parents,
  };
}

export async function openRoom(ctx: ActorContext, input: OpenChatInput) {
  const actor = await loadActor(ctx.userId);

  if (input.kind === "CLASS") {
    const classRoom = await assertClassMember(actor, input.classId);
    const room = await createOrFind(
      { kind: ChatRoomKind.CLASS, classId: classRoom.id },
      {
        kind: ChatRoomKind.CLASS,
        school: { connect: { id: classRoom.schoolId } },
        class: { connect: { id: classRoom.id } },
      },
    );
    return summarize(room, actor.id, actor.role);
  }

  if (input.kind === "TEACHER_PARENT") {
    if (actor.role !== UserRole.TEACHER && actor.role !== UserRole.PARENT) {
      throw new AppError("You do not have permission to perform this action", 403);
    }
    const teacherId =
      actor.role === UserRole.TEACHER ? actor.teacher?.id : input.teacherId;
    const parentId =
      actor.role === UserRole.PARENT ? actor.parent?.id : input.parentId;
    if (!teacherId || !parentId) {
      throw new AppError("Choose who this conversation is with", 400);
    }

    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      include: {
        user: { select: { schoolId: true, deletedAt: true, status: true } },
      },
    });
    if (
      !student ||
      !student.user.schoolId ||
      student.user.deletedAt ||
      student.user.status !== UserStatus.ACTIVE
    ) {
      throw new AppError("Student not found", 404);
    }

    const parentLink = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId: student.id } },
    });
    if (!parentLink) {
      throw new AppError("That parent is not linked to this student", 403);
    }

    const allowed = await teacherTeachesStudent(teacherId, student.id);
    if (!allowed) {
      throw new AppError("That teacher does not take a class for this student", 403);
    }

    const room = await createOrFind(
      {
        kind: ChatRoomKind.TEACHER_PARENT,
        teacherId,
        parentId,
        studentId: student.id,
      },
      {
        kind: ChatRoomKind.TEACHER_PARENT,
        school: { connect: { id: student.user.schoolId } },
        teacher: { connect: { id: teacherId } },
        parent: { connect: { id: parentId } },
        student: { connect: { id: student.id } },
      },
    );
    return summarize(room, actor.id, actor.role);
  }

  const parentId =
    actor.role === UserRole.PARENT ? actor.parent?.id : input.parentId;
  const schoolId =
    actor.role === UserRole.PARENT ? actor.schoolId : actor.schoolId;
  if (actor.role !== UserRole.PARENT && actor.role !== UserRole.HEADMASTER) {
    throw new AppError("You do not have permission to perform this action", 403);
  }
  if (!parentId || !schoolId) {
    throw new AppError("Choose a parent", 400);
  }

  if (actor.role === UserRole.HEADMASTER) {
    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
      include: { user: { select: { schoolId: true, deletedAt: true } } },
    });
    if (!parent || parent.user.deletedAt || parent.user.schoolId !== schoolId) {
      throw new AppError("Parent not found", 404);
    }
  }

  const room = await createOrFind(
    { kind: ChatRoomKind.HEADMASTER_PARENT, parentId },
    {
      kind: ChatRoomKind.HEADMASTER_PARENT,
      school: { connect: { id: schoolId } },
      parent: { connect: { id: parentId } },
    },
  );
  return summarize(room, actor.id, actor.role);
}

export async function listMessages(
  ctx: ActorContext,
  roomId: string,
  after?: string,
) {
  const actor = await loadActor(ctx.userId);
  const room = await findRoom(roomId);
  await assertRoomAccess(actor, room);

  const createdAt =
    after && !Number.isNaN(new Date(after).getTime())
      ? { gt: new Date(after) }
      : undefined;

  const rows = await prisma.chatMessage.findMany({
    where: { roomId, ...(createdAt ? { createdAt } : {}) },
    orderBy: { createdAt: createdAt ? "asc" : "desc" },
    take: createdAt ? 100 : 80,
    include: {
      sender: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
    },
  });
  if (!createdAt) rows.reverse();

  return {
    room: summarize(room, actor.id, actor.role),
    messages: rows.map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      sender: {
        id: message.sender.id,
        name: fullName(message.sender),
        role: message.sender.role,
      },
      mine: message.senderId === actor.id,
    })),
  };
}

export async function sendMessage(ctx: ActorContext, roomId: string, body: string) {
  const actor = await loadActor(ctx.userId);
  const room = await findRoom(roomId);
  await assertRoomAccess(actor, room);

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.chatMessage.create({
      data: { roomId, senderId: actor.id, body },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });
    await tx.chatRoom.update({
      where: { id: roomId },
      data: { updatedAt: new Date() },
    });
    return created;
  });

  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    sender: {
      id: message.sender.id,
      name: fullName(message.sender),
      role: message.sender.role,
    },
    mine: true,
  };
}
