import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { withTestContext } from "../helpers/with-test-context";
import type { createCaller } from "~/server/api/root";

const USER_ID = "groups-test-user";
const OTHER_USER_ID = "groups-test-other";
const THIRD_USER_ID = "groups-test-third";

const baseUser = {
  id: USER_ID,
  email: "groupuser@example.com",
  username: "groupuser",
  firstName: "Group",
  lastName: "User",
};

const otherUser = {
  id: OTHER_USER_ID,
  email: "othergroup@example.com",
  username: "othergroup",
  firstName: "Other",
  lastName: "GroupUser",
};

const thirdUser = {
  id: THIRD_USER_ID,
  email: "thirdgroup@example.com",
  username: "thirdgroup",
  firstName: "Third",
  lastName: "GroupUser",
};

type SeedContext = {
  caller: ReturnType<typeof createCaller>;
  tx: Parameters<Parameters<typeof withTestContext>[0]>[0]["tx"];
  callerAs: (userId: string) => ReturnType<typeof createCaller>;
};

/** Seed all three users via DB, create a group via API as USER_ID, return group info */
async function seedGroupWithMembers(
  ctx: SeedContext,
  opts?: { otherJoined?: boolean; thirdJoined?: boolean },
) {
  // Users must be seeded via DB (no create user API — auth middleware handles it)
  await ctx.tx.user.createMany({ data: [baseUser, otherUser, thirdUser] });

  // Always create group as USER_ID (the designated creator)
  const creatorCaller = ctx.callerAs(USER_ID);
  const createResult = await creatorCaller.group.createGroup({ name: "Test Group" });
  if (createResult.error) throw new Error(`createGroup failed: ${createResult.error.message}`);
  const slug = createResult.data!;

  // Look up the group to get its ID
  const group = await ctx.tx.group.findFirst({ where: { slug } });
  if (!group) throw new Error("Group not found after creation");

  // Invite OTHER_USER_ID
  const inviteOtherResult = await creatorCaller.group.inviteUser({
    groupId: group.id,
    inviteeUserId: OTHER_USER_ID,
  });
  if (inviteOtherResult.error)
    throw new Error(`inviteUser(other) failed: ${inviteOtherResult.error.message}`);

  // Accept invite if otherJoined !== false (default: joined)
  if (opts?.otherJoined !== false) {
    const otherInvite = await ctx.tx.groupMember.findFirst({
      where: { groupId: group.id, memberId: OTHER_USER_ID, status: "INVITED" },
    });
    const otherCaller = ctx.callerAs(OTHER_USER_ID);
    const acceptResult = await otherCaller.group.acceptInvite({ groupMemberId: otherInvite!.id });
    if (acceptResult.error)
      throw new Error(`acceptInvite(other) failed: ${acceptResult.error.message}`);
  }

  // Optionally invite THIRD_USER_ID
  if (opts?.thirdJoined !== undefined) {
    const inviteThirdResult = await creatorCaller.group.inviteUser({
      groupId: group.id,
      inviteeUserId: THIRD_USER_ID,
    });
    if (inviteThirdResult.error)
      throw new Error(`inviteUser(third) failed: ${inviteThirdResult.error.message}`);

    if (opts.thirdJoined) {
      const thirdInvite = await ctx.tx.groupMember.findFirst({
        where: { groupId: group.id, memberId: THIRD_USER_ID, status: "INVITED" },
      });
      const thirdCaller = ctx.callerAs(THIRD_USER_ID);
      const acceptResult = await thirdCaller.group.acceptInvite({
        groupMemberId: thirdInvite!.id,
      });
      if (acceptResult.error)
        throw new Error(`acceptInvite(third) failed: ${acceptResult.error.message}`);
    }
  }

  return group;
}

describe("groupRouter", () => {
  // ─── createGroup ────────────────────────────────────────────────────
  describe("createGroup", () => {
    it("creates a group and returns the slug", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.create({ data: baseUser });

        const result = await caller.group.createGroup({ name: "My New Group" });

        expect(result.error).toBeNull();
        expect(result.data).toMatch(/my-new-group/);
      }, USER_ID);
    });

    it("creator is automatically added as a JOINED admin", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.create({ data: baseUser });

        await caller.group.createGroup({ name: "Admin Check Group" });

        const membership = await tx.groupMember.findFirst({
          where: { memberId: USER_ID },
        });
        expect(membership).not.toBeNull();
        expect(membership!.status).toBe("JOINED");
        expect(membership!.isAdmin).toBe(true);
      }, USER_ID);
    });

    it("invites additional users during creation", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.createMany({ data: [baseUser, otherUser] });

        const result = await caller.group.createGroup({
          name: "Invite Group",
          invitedUsers: [{ userId: OTHER_USER_ID, role: "user" }],
        });

        expect(result.error).toBeNull();

        const invite = await tx.groupMember.findFirst({
          where: { memberId: OTHER_USER_ID },
        });
        expect(invite).not.toBeNull();
        expect(invite!.status).toBe("INVITED");
        expect(invite!.isAdmin).toBe(false);
      }, USER_ID);
    });

    it("invites a user as admin during creation", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.createMany({ data: [baseUser, otherUser] });

        await caller.group.createGroup({
          name: "Admin Invite",
          invitedUsers: [{ userId: OTHER_USER_ID, role: "admin" }],
        });

        const invite = await tx.groupMember.findFirst({
          where: { memberId: OTHER_USER_ID },
        });
        expect(invite!.isAdmin).toBe(true);
      }, USER_ID);
    });

    it("returns error when inviting non-existent user", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.create({ data: baseUser });

        const result = await caller.group.createGroup({
          name: "Bad Invite",
          invitedUsers: [{ userId: "non-existent-id", role: "user" }],
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("INTERNAL_SERVER_ERROR");
      }, USER_ID);
    });

    it("creates a group with description", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.create({ data: baseUser });

        const result = await caller.group.createGroup({
          name: "Described Group",
          description: "A group with a description",
        });

        expect(result.error).toBeNull();

        const group = await tx.group.findFirst({ where: { name: "Described Group" } });
        expect(group!.description).toBe("A group with a description");
      }, USER_ID);
    });

    it("generates unique slugs for same-name groups", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.create({ data: baseUser });

        const result1 = await caller.group.createGroup({ name: "Dupe Name" });
        const result2 = await caller.group.createGroup({ name: "Dupe Name" });

        expect(result1.data).not.toBe(result2.data);
      }, USER_ID);
    });
  });

  // ─── getGroupBySlug ─────────────────────────────────────────────────
  describe("getGroupBySlug", () => {
    it("returns group data for a joined member", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.getGroupBySlug({ slug: group.slug });

        expect(result.error).toBeNull();
        expect(result.data!.name).toBe("Test Group");
        expect(result.data!.slug).toBe(group.slug);
        expect(result.data!.members.length).toBeGreaterThanOrEqual(2);
      }, USER_ID);
    });

    it("returns NOT_FOUND for non-existent slug", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.create({ data: baseUser });

        const result = await caller.group.getGroupBySlug({ slug: "no-such-slug" });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("NOT_FOUND");
      }, USER_ID);
    });

    it("returns FORBIDDEN for non-member", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.createMany({ data: [baseUser, otherUser, thirdUser] });

        // Create group as OTHER_USER_ID
        const otherCaller = callerAs(OTHER_USER_ID);
        const createResult = await otherCaller.group.createGroup({ name: "Others Group" });
        const slug = createResult.data!;

        // USER_ID is not a member
        const result = await caller.group.getGroupBySlug({ slug });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("FORBIDDEN");
      }, USER_ID);
    });

    it("excludes soft-deleted groups", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.create({ data: baseUser });

        // Create group then soft-delete it
        const createResult = await caller.group.createGroup({ name: "Deleted Group" });
        const slug = createResult.data!;
        const group = await tx.group.findFirst({ where: { slug } });
        await tx.group.update({ where: { id: group!.id }, data: { deletedAt: new Date() } });

        const result = await caller.group.getGroupBySlug({ slug });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("NOT_FOUND");
      }, USER_ID);
    });

    it("includes members with correct roles and statuses", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs }, { thirdJoined: false });

        const result = await caller.group.getGroupBySlug({ slug: group.slug });

        expect(result.error).toBeNull();
        const members = result.data!.members;
        const creator = members.find((m) => m.id === USER_ID);
        const invited = members.find((m) => m.id === THIRD_USER_ID);

        expect(creator!.isAdmin).toBe(true);
        expect(invited!.status).toBe("INVITED");
      }, USER_ID);
    });

    it("does not expose member emails", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.getGroupBySlug({ slug: group.slug });

        const members = result.data!.members;
        for (const m of members) {
          expect(m).not.toHaveProperty("email");
        }
      }, USER_ID);
    });
  });

  // ─── deleteGroup ────────────────────────────────────────────────────
  describe("deleteGroup", () => {
    it("soft deletes a group by creator", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.deleteGroup({ groupId: group.id });

        expect(result.error).toBeNull();

        const deleted = await tx.group.findUnique({ where: { id: group.id } });
        expect(deleted!.deletedAt).not.toBeNull();
      }, USER_ID);
    });

    it("hard deletes a group when hard=true", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.deleteGroup({ groupId: group.id, hard: true });

        expect(result.error).toBeNull();

        const gone = await tx.group.findUnique({ where: { id: group.id } });
        expect(gone).toBeNull();
      }, USER_ID);
    });

    it("returns FORBIDDEN if non-creator tries to delete", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        // OTHER_USER_ID is a member but not creator
        const otherCaller = callerAs(OTHER_USER_ID);
        const result = await otherCaller.group.deleteGroup({ groupId: group.id });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("FORBIDDEN");
      }, USER_ID);
    });

    it("returns NOT_FOUND for non-existent group", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.create({ data: baseUser });

        const result = await caller.group.deleteGroup({ groupId: 999999 });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("NOT_FOUND");
      }, USER_ID);
    });

    it("returns NOT_FOUND for already soft-deleted group", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        await tx.group.update({ where: { id: group.id }, data: { deletedAt: new Date() } });

        const result = await caller.group.deleteGroup({ groupId: group.id });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("NOT_FOUND");
      }, USER_ID);
    });
  });

  // ─── restoreGroup ──────────────────────────────────────────────────
  describe("restoreGroup", () => {
    it("restores a soft-deleted group", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        await tx.group.update({ where: { id: group.id }, data: { deletedAt: new Date() } });

        const result = await caller.group.restoreGroup({ groupId: group.id });

        expect(result.error).toBeNull();

        const restored = await tx.group.findUnique({ where: { id: group.id } });
        expect(restored!.deletedAt).toBeNull();
      }, USER_ID);
    });

    it("returns FORBIDDEN if non-creator tries to restore", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        await tx.group.update({ where: { id: group.id }, data: { deletedAt: new Date() } });

        const otherCaller = callerAs(OTHER_USER_ID);
        const result = await otherCaller.group.restoreGroup({ groupId: group.id });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("FORBIDDEN");
      }, USER_ID);
    });

    it("returns NOT_FOUND when no deleted group exists", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        // group is NOT deleted

        const result = await caller.group.restoreGroup({ groupId: group.id });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("NOT_FOUND");
      }, USER_ID);
    });
  });

  // ─── updateGroup ───────────────────────────────────────────────────
  describe("updateGroup", () => {
    it("updates group name and description", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.updateGroup({
          groupId: group.id,
          name: "Updated Name",
          description: "Updated desc",
        });

        expect(result.error).toBeNull();

        const updated = await tx.group.findUnique({ where: { id: group.id } });
        expect(updated!.name).toBe("Updated Name");
        expect(updated!.description).toBe("Updated desc");
      }, USER_ID);
    });

    it("clears description when omitted", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        await tx.group.update({
          where: { id: group.id },
          data: { description: "Old desc" },
        });

        const result = await caller.group.updateGroup({
          groupId: group.id,
          name: "Same Name",
        });

        expect(result.error).toBeNull();
        const updated = await tx.group.findUnique({ where: { id: group.id } });
        expect(updated!.description).toBeNull();
      }, USER_ID);
    });

    it("throws FORBIDDEN for non-admin member", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const otherCaller = callerAs(OTHER_USER_ID);
        await expect(
          otherCaller.group.updateGroup({ groupId: group.id, name: "Hijack" }),
        ).rejects.toThrow(TRPCError);
      }, USER_ID);
    });
  });

  // ─── updateMemberRole ──────────────────────────────────────────────
  describe("updateMemberRole", () => {
    it("promotes a member to admin", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.updateMemberRole({
          groupId: group.id,
          memberId: OTHER_USER_ID,
          isAdmin: true,
        });

        expect(result.error).toBeNull();

        const member = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: OTHER_USER_ID },
        });
        expect(member!.isAdmin).toBe(true);
      }, USER_ID);
    });

    it("demotes a member from admin", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        // First promote OTHER_USER_ID
        await tx.groupMember.updateMany({
          where: { groupId: group.id, memberId: OTHER_USER_ID },
          data: { isAdmin: true },
        });

        const result = await caller.group.updateMemberRole({
          groupId: group.id,
          memberId: OTHER_USER_ID,
          isAdmin: false,
        });

        expect(result.error).toBeNull();

        const member = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: OTHER_USER_ID },
        });
        expect(member!.isAdmin).toBe(false);
      }, USER_ID);
    });

    it("cannot change your own role", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.updateMemberRole({
          groupId: group.id,
          memberId: USER_ID,
          isAdmin: false,
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });

    it("cannot demote the group creator", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        // Promote OTHER so they can try to demote creator
        await tx.groupMember.updateMany({
          where: { groupId: group.id, memberId: OTHER_USER_ID },
          data: { isAdmin: true },
        });

        const otherCaller = callerAs(OTHER_USER_ID);
        const result = await otherCaller.group.updateMemberRole({
          groupId: group.id,
          memberId: USER_ID,
          isAdmin: false,
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("FORBIDDEN");
      }, USER_ID);
    });

    it("cannot change role of invited (non-JOINED) member", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs }, { thirdJoined: false });

        const result = await caller.group.updateMemberRole({
          groupId: group.id,
          memberId: THIRD_USER_ID,
          isAdmin: true,
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });

    it("throws FORBIDDEN for non-admin caller", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs }, { thirdJoined: true });

        const otherCaller = callerAs(OTHER_USER_ID);
        await expect(
          otherCaller.group.updateMemberRole({
            groupId: group.id,
            memberId: THIRD_USER_ID,
            isAdmin: true,
          }),
        ).rejects.toThrow(TRPCError);
      }, USER_ID);
    });
  });

  // ─── inviteUser ────────────────────────────────────────────────────
  describe("inviteUser", () => {
    it("invites a user to the group", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        // Group with USER + OTHER joined (no THIRD)
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.inviteUser({
          groupId: group.id,
          inviteeUserId: THIRD_USER_ID,
        });

        expect(result.error).toBeNull();

        const invite = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: THIRD_USER_ID },
        });
        expect(invite!.status).toBe("INVITED");
      }, USER_ID);
    });

    it("regular member can invite as user role", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        // Group with USER + OTHER joined (no THIRD)
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        // OTHER_USER_ID (non-admin) invites THIRD
        const otherCaller = callerAs(OTHER_USER_ID);
        const result = await otherCaller.group.inviteUser({
          groupId: group.id,
          inviteeUserId: THIRD_USER_ID,
        });

        expect(result.error).toBeNull();
      }, USER_ID);
    });

    it("non-admin cannot invite as admin role", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        // OTHER_USER_ID (non-admin) tries to invite THIRD as admin
        const otherCaller = callerAs(OTHER_USER_ID);
        const result = await otherCaller.group.inviteUser({
          groupId: group.id,
          inviteeUserId: THIRD_USER_ID,
          role: "admin",
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("FORBIDDEN");
      }, USER_ID);
    });

    it("admin can invite as admin role", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        // Group with just USER + OTHER (THIRD not in group)
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.inviteUser({
          groupId: group.id,
          inviteeUserId: THIRD_USER_ID,
          role: "admin",
        });

        expect(result.error).toBeNull();
        const invite = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: THIRD_USER_ID },
        });
        expect(invite!.isAdmin).toBe(true);
      }, USER_ID);
    });

    it("returns error when user is already a joined member", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.inviteUser({
          groupId: group.id,
          inviteeUserId: OTHER_USER_ID,
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });

    it("returns error when user is already invited", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs }, { thirdJoined: false });

        const result = await caller.group.inviteUser({
          groupId: group.id,
          inviteeUserId: THIRD_USER_ID,
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });

    it("returns error when inviting non-existent user", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.inviteUser({
          groupId: group.id,
          inviteeUserId: "non-existent-user",
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });

    it("non-member cannot invite", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        // Create group as USER, only USER is a member
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        // THIRD_USER_ID is not a member — call as THIRD
        const thirdCaller = callerAs(THIRD_USER_ID);
        await expect(
          thirdCaller.group.inviteUser({ groupId: group.id, inviteeUserId: OTHER_USER_ID }),
        ).rejects.toThrow(TRPCError);
      }, USER_ID);
    });
  });

  // ─── uninviteUser ──────────────────────────────────────────────────
  describe("uninviteUser", () => {
    it("revokes a pending invite", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs }, { thirdJoined: false });

        const result = await caller.group.uninviteUser({
          groupId: group.id,
          userId: THIRD_USER_ID,
        });

        expect(result.error).toBeNull();

        const member = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: THIRD_USER_ID },
        });
        expect(member).toBeNull();
      }, USER_ID);
    });

    it("returns NOT_FOUND when no pending invite exists", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        // OTHER_USER_ID is JOINED, not INVITED
        const result = await caller.group.uninviteUser({
          groupId: group.id,
          userId: OTHER_USER_ID,
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("NOT_FOUND");
      }, USER_ID);
    });

    it("throws FORBIDDEN for non-admin", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs }, { thirdJoined: false });

        const otherCaller = callerAs(OTHER_USER_ID);
        await expect(
          otherCaller.group.uninviteUser({ groupId: group.id, userId: THIRD_USER_ID }),
        ).rejects.toThrow(TRPCError);
      }, USER_ID);
    });
  });

  // ─── restoreInvite ─────────────────────────────────────────────────
  describe("restoreInvite", () => {
    it("re-invites a user after their invite was revoked", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs }, { thirdJoined: false });

        // Uninvite first (hard delete)
        await tx.groupMember.deleteMany({
          where: { groupId: group.id, memberId: THIRD_USER_ID },
        });

        const result = await caller.group.restoreInvite({
          groupId: group.id,
          userId: THIRD_USER_ID,
        });

        expect(result.error).toBeNull();

        const invite = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: THIRD_USER_ID },
        });
        expect(invite!.status).toBe("INVITED");
      }, USER_ID);
    });

    it("returns BAD_REQUEST if user already has active membership", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.restoreInvite({
          groupId: group.id,
          userId: OTHER_USER_ID,
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });

    it("throws FORBIDDEN for non-admin", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const otherCaller = callerAs(OTHER_USER_ID);
        await expect(
          otherCaller.group.restoreInvite({ groupId: group.id, userId: THIRD_USER_ID }),
        ).rejects.toThrow(TRPCError);
      }, USER_ID);
    });
  });

  // ─── acceptInvite ──────────────────────────────────────────────────
  describe("acceptInvite", () => {
    it("accepts a pending invite", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs }, { otherJoined: false });

        const invite = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: OTHER_USER_ID, status: "INVITED" },
        });

        const otherCaller = callerAs(OTHER_USER_ID);
        const result = await otherCaller.group.acceptInvite({ groupMemberId: invite!.id });

        expect(result.error).toBeNull();

        const updated = await tx.groupMember.findUnique({ where: { id: invite!.id } });
        expect(updated!.status).toBe("JOINED");
      }, USER_ID);
    });

    it("returns FORBIDDEN when trying to accept someone else's invite", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs }, { thirdJoined: false });

        const invite = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: THIRD_USER_ID, status: "INVITED" },
        });

        // USER_ID tries to accept THIRD's invite
        const result = await caller.group.acceptInvite({ groupMemberId: invite!.id });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("FORBIDDEN");
      }, USER_ID);
    });

    it("returns BAD_REQUEST when invite is already accepted", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const membership = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: OTHER_USER_ID, status: "JOINED" },
        });

        const otherCaller = callerAs(OTHER_USER_ID);
        const result = await otherCaller.group.acceptInvite({ groupMemberId: membership!.id });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });

    it("returns NOT_FOUND for non-existent invite", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.create({ data: baseUser });

        const result = await caller.group.acceptInvite({ groupMemberId: 999999 });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("NOT_FOUND");
      }, USER_ID);
    });
  });

  // ─── declineInvite ─────────────────────────────────────────────────
  describe("declineInvite", () => {
    it("declines a pending invite and deletes the record", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs }, { otherJoined: false });

        const invite = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: OTHER_USER_ID, status: "INVITED" },
        });

        const otherCaller = callerAs(OTHER_USER_ID);
        const result = await otherCaller.group.declineInvite({ groupMemberId: invite!.id });

        expect(result.error).toBeNull();

        const deleted = await tx.groupMember.findUnique({ where: { id: invite!.id } });
        expect(deleted).toBeNull();
      }, USER_ID);
    });

    it("returns FORBIDDEN when declining someone else's invite", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs }, { thirdJoined: false });

        const invite = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: THIRD_USER_ID, status: "INVITED" },
        });

        const result = await caller.group.declineInvite({ groupMemberId: invite!.id });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("FORBIDDEN");
      }, USER_ID);
    });

    it("returns BAD_REQUEST when invite is already accepted", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const membership = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: OTHER_USER_ID, status: "JOINED" },
        });

        const otherCaller = callerAs(OTHER_USER_ID);
        const result = await otherCaller.group.declineInvite({ groupMemberId: membership!.id });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });

    it("returns NOT_FOUND for non-existent invite", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.create({ data: baseUser });

        const result = await caller.group.declineInvite({ groupMemberId: 999999 });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("NOT_FOUND");
      }, USER_ID);
    });
  });

  // ─── Complex invite lifecycle ──────────────────────────────────────
  describe("invite lifecycle", () => {
    it("invite → decline → re-invite → accept", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.createMany({ data: [baseUser, otherUser, thirdUser] });
        const createResult = await caller.group.createGroup({ name: "Lifecycle Group" });
        const group = (await tx.group.findFirst({ where: { slug: createResult.data! } }))!;

        // Invite as creator
        const inviteResult = await caller.group.inviteUser({
          groupId: group.id,
          inviteeUserId: OTHER_USER_ID,
        });
        expect(inviteResult.error).toBeNull();

        // Decline as invitee
        const invite1 = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: OTHER_USER_ID },
        });
        const otherCaller = callerAs(OTHER_USER_ID);
        const declineResult = await otherCaller.group.declineInvite({
          groupMemberId: invite1!.id,
        });
        expect(declineResult.error).toBeNull();

        // Re-invite
        const reinviteResult = await caller.group.inviteUser({
          groupId: group.id,
          inviteeUserId: OTHER_USER_ID,
        });
        expect(reinviteResult.error).toBeNull();

        // Accept
        const invite2 = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: OTHER_USER_ID },
        });
        const acceptResult = await otherCaller.group.acceptInvite({
          groupMemberId: invite2!.id,
        });
        expect(acceptResult.error).toBeNull();

        const finalMember = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: OTHER_USER_ID },
        });
        expect(finalMember!.status).toBe("JOINED");
      }, USER_ID);
    });

    it("invite → uninvite → restoreInvite", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        await tx.user.createMany({ data: [baseUser, otherUser, thirdUser] });
        const createResult = await caller.group.createGroup({ name: "Uninvite Restore" });
        const group = (await tx.group.findFirst({ where: { slug: createResult.data! } }))!;

        // Invite
        await caller.group.inviteUser({
          groupId: group.id,
          inviteeUserId: OTHER_USER_ID,
        });

        // Uninvite
        const uninviteResult = await caller.group.uninviteUser({
          groupId: group.id,
          userId: OTHER_USER_ID,
        });
        expect(uninviteResult.error).toBeNull();

        // Restore invite
        const restoreResult = await caller.group.restoreInvite({
          groupId: group.id,
          userId: OTHER_USER_ID,
        });
        expect(restoreResult.error).toBeNull();

        const invite = await tx.groupMember.findFirst({
          where: { groupId: group.id, memberId: OTHER_USER_ID },
        });
        expect(invite!.status).toBe("INVITED");
      }, USER_ID);
    });
  });

  // ─── createTransaction ─────────────────────────────────────────────
  describe("createTransaction", () => {
    it("creates a transaction with valid splits", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.createTransaction({
          groupId: group.id,
          amount: 100,
          payerId: USER_ID,
          title: "Dinner",
          category: "FOOD",
          transactionDetails: [{ recipientId: OTHER_USER_ID, amount: 100 }],
        });

        expect(result.error).toBeNull();
      }, USER_ID);
    });

    it("creates a transaction with multiple splits", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs }, { thirdJoined: true });

        const result = await caller.group.createTransaction({
          groupId: group.id,
          amount: 90,
          payerId: USER_ID,
          title: "Test transaction",
          transactionDetails: [
            { recipientId: OTHER_USER_ID, amount: 45 },
            { recipientId: THIRD_USER_ID, amount: 45 },
          ],
        });

        expect(result.error).toBeNull();
      }, USER_ID);
    });

    it("rejects when split amounts don't match total", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.createTransaction({
          groupId: group.id,
          amount: 100,
          payerId: USER_ID,
          title: "Test transaction",
          transactionDetails: [{ recipientId: OTHER_USER_ID, amount: 50 }],
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });

    it("rejects duplicate recipients", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.createTransaction({
          groupId: group.id,
          amount: 100,
          payerId: USER_ID,
          title: "Test transaction",
          transactionDetails: [
            { recipientId: OTHER_USER_ID, amount: 50 },
            { recipientId: OTHER_USER_ID, amount: 50 },
          ],
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });

    it("rejects when payer is not a group member", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.createTransaction({
          groupId: group.id,
          amount: 50,
          payerId: "non-existent-payer",
          title: "Test transaction",
          transactionDetails: [{ recipientId: OTHER_USER_ID, amount: 50 }],
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });

    it("rejects when recipient is not a group member", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.createTransaction({
          groupId: group.id,
          amount: 50,
          payerId: USER_ID,
          title: "Test transaction",
          transactionDetails: [{ recipientId: "non-member-recipient", amount: 50 }],
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });

    it("non-member cannot create transaction", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const creatorCaller = callerAs(USER_ID);
        const group = await seedGroupWithMembers({ caller: creatorCaller, tx, callerAs });

        // THIRD is not a group member
        const thirdCaller = callerAs(THIRD_USER_ID);
        await expect(
          thirdCaller.group.createTransaction({
            groupId: group.id,
            amount: 50,
            payerId: THIRD_USER_ID,
            title: "Test transaction",
            transactionDetails: [{ recipientId: OTHER_USER_ID, amount: 50 }],
          }),
        ).rejects.toThrow(TRPCError);
      }, USER_ID);
    });

    it("allows another member to pay (not just caller)", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.createTransaction({
          groupId: group.id,
          amount: 80,
          payerId: OTHER_USER_ID,
          title: "Other paid",
          transactionDetails: [{ recipientId: USER_ID, amount: 80 }],
        });

        expect(result.error).toBeNull();
      }, USER_ID);
    });

    it("sets transactionDate to now when omitted", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        await caller.group.createTransaction({
          groupId: group.id,
          amount: 25,
          payerId: USER_ID,
          title: "Test transaction",
          transactionDetails: [{ recipientId: OTHER_USER_ID, amount: 25 }],
        });

        const txn = await tx.transaction.findFirst({
          where: { groupId: group.id },
        });
        expect(txn!.transactionDate).toBeDefined();
        // Should be within the last minute
        const diff = Date.now() - txn!.transactionDate.getTime();
        expect(diff).toBeLessThan(60000);
      }, USER_ID);
    });
  });

  // ─── createSettlement ──────────────────────────────────────────────
  describe("createSettlement", () => {
    it("creates a settlement between two members", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.createSettlement({
          groupId: group.id,
          payerId: USER_ID,
          recipientId: OTHER_USER_ID,
          amount: 50,
        });

        expect(result.error).toBeNull();

        const settlement = await tx.transaction.findFirst({
          where: { groupId: group.id, isSettlement: true },
        });
        expect(settlement).not.toBeNull();
        expect(settlement!.amount.toNumber()).toBe(-50);
      }, USER_ID);
    });

    it("rejects settling with yourself", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.createSettlement({
          groupId: group.id,
          payerId: USER_ID,
          recipientId: USER_ID,
          amount: 50,
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });

    it("only payer or recipient can record settlement", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const creatorCaller = callerAs(USER_ID);
        const group = await seedGroupWithMembers(
          { caller: creatorCaller, tx, callerAs },
          { thirdJoined: true },
        );

        // THIRD tries to record settlement between USER and OTHER
        const thirdCaller = callerAs(THIRD_USER_ID);
        const result = await thirdCaller.group.createSettlement({
          groupId: group.id,
          payerId: USER_ID,
          recipientId: OTHER_USER_ID,
          amount: 50,
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("FORBIDDEN");
      }, USER_ID);
    });

    it("recipient can record settlement", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        // OTHER_USER_ID is the recipient and is recording
        const otherCaller = callerAs(OTHER_USER_ID);
        const result = await otherCaller.group.createSettlement({
          groupId: group.id,
          payerId: USER_ID,
          recipientId: OTHER_USER_ID,
          amount: 30,
        });

        expect(result.error).toBeNull();
      }, USER_ID);
    });
  });

  // ─── updateTransaction ─────────────────────────────────────────────
  describe("updateTransaction", () => {
    it("creator can update their own transaction", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        const txn = await tx.transaction.create({
          data: {
            groupId: group.id,
            amount: 100,
            payerId: USER_ID,
            createdById: USER_ID,
            title: "Test transaction",
            transactionDetails: {
              create: { recipientId: OTHER_USER_ID, groupId: group.id, amount: 100 },
            },
          },
        });

        const result = await caller.group.updateTransaction({
          groupId: group.id,
          transactionId: txn.id,
          amount: 200,
          payerId: USER_ID,
          title: "Test transaction",
          transactionDetails: [{ recipientId: OTHER_USER_ID, amount: 200 }],
        });

        expect(result.error).toBeNull();

        const updated = await tx.transaction.findUnique({ where: { id: txn.id } });
        expect(updated!.amount.toNumber()).toBe(200);
      }, USER_ID);
    });

    it("admin can update another member's transaction", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        // Transaction created by OTHER
        const txn = await tx.transaction.create({
          data: {
            groupId: group.id,
            amount: 60,
            payerId: OTHER_USER_ID,
            createdById: OTHER_USER_ID,
            title: "Test transaction",
            transactionDetails: {
              create: { recipientId: USER_ID, groupId: group.id, amount: 60 },
            },
          },
        });

        // USER_ID is admin, updates OTHER's transaction
        const result = await caller.group.updateTransaction({
          groupId: group.id,
          transactionId: txn.id,
          amount: 80,
          payerId: OTHER_USER_ID,
          title: "Test transaction",
          transactionDetails: [{ recipientId: USER_ID, amount: 80 }],
        });

        expect(result.error).toBeNull();
      }, USER_ID);
    });

    it("non-creator non-admin cannot update", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const txn = await tx.transaction.create({
          data: {
            groupId: group.id,
            amount: 50,
            payerId: USER_ID,
            createdById: USER_ID,
            title: "Test transaction",
            transactionDetails: {
              create: { recipientId: OTHER_USER_ID, groupId: group.id, amount: 50 },
            },
          },
        });

        // OTHER_USER_ID is not admin and didn't create it
        const otherCaller = callerAs(OTHER_USER_ID);
        const result = await otherCaller.group.updateTransaction({
          groupId: group.id,
          transactionId: txn.id,
          amount: 50,
          payerId: USER_ID,
          title: "Test transaction",
          transactionDetails: [{ recipientId: OTHER_USER_ID, amount: 50 }],
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("FORBIDDEN");
      }, USER_ID);
    });

    it("cannot update a settlement", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const settlement = await tx.transaction.create({
          data: {
            groupId: group.id,
            amount: -50,
            payerId: USER_ID,
            createdById: USER_ID,
            title: "Test transaction",
            isSettlement: true,
            transactionDetails: {
              create: { recipientId: OTHER_USER_ID, groupId: group.id, amount: -50 },
            },
          },
        });

        const result = await caller.group.updateTransaction({
          groupId: group.id,
          transactionId: settlement.id,
          amount: 50,
          payerId: USER_ID,
          title: "Test transaction",
          transactionDetails: [{ recipientId: OTHER_USER_ID, amount: 50 }],
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });

    it("returns NOT_FOUND for non-existent transaction", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.updateTransaction({
          groupId: group.id,
          transactionId: 999999,
          amount: 50,
          payerId: USER_ID,
          title: "Test transaction",
          transactionDetails: [{ recipientId: OTHER_USER_ID, amount: 50 }],
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("NOT_FOUND");
      }, USER_ID);
    });

    it("rejects mismatched split amounts on update", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        const txn = await tx.transaction.create({
          data: {
            groupId: group.id,
            amount: 100,
            payerId: USER_ID,
            createdById: USER_ID,
            title: "Test transaction",
            transactionDetails: {
              create: { recipientId: OTHER_USER_ID, groupId: group.id, amount: 100 },
            },
          },
        });

        const result = await caller.group.updateTransaction({
          groupId: group.id,
          transactionId: txn.id,
          amount: 100,
          payerId: USER_ID,
          title: "Test transaction",
          transactionDetails: [{ recipientId: OTHER_USER_ID, amount: 70 }],
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("BAD_REQUEST");
      }, USER_ID);
    });
  });

  // ─── deleteTransaction ─────────────────────────────────────────────
  describe("deleteTransaction", () => {
    it("creator can soft-delete their transaction", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        const txn = await tx.transaction.create({
          data: {
            groupId: group.id,
            amount: 50,
            payerId: USER_ID,
            createdById: USER_ID,
            title: "Test transaction",
            transactionDetails: {
              create: { recipientId: OTHER_USER_ID, groupId: group.id, amount: 50 },
            },
          },
        });

        const result = await caller.group.deleteTransaction({
          groupId: group.id,
          transactionId: txn.id,
        });

        expect(result.error).toBeNull();

        const deleted = await tx.transaction.findUnique({ where: { id: txn.id } });
        expect(deleted!.deletedAt).not.toBeNull();
      }, USER_ID);
    });

    it("admin can delete another member's transaction", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        const txn = await tx.transaction.create({
          data: {
            groupId: group.id,
            amount: 50,
            payerId: OTHER_USER_ID,
            createdById: OTHER_USER_ID,
            title: "Test transaction",
            transactionDetails: {
              create: { recipientId: USER_ID, groupId: group.id, amount: 50 },
            },
          },
        });

        // USER_ID is admin
        const result = await caller.group.deleteTransaction({
          groupId: group.id,
          transactionId: txn.id,
        });

        expect(result.error).toBeNull();
      }, USER_ID);
    });

    it("non-creator non-admin cannot delete", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        const txn = await tx.transaction.create({
          data: {
            groupId: group.id,
            amount: 50,
            payerId: USER_ID,
            createdById: USER_ID,
            title: "Test transaction",
            transactionDetails: {
              create: { recipientId: OTHER_USER_ID, groupId: group.id, amount: 50 },
            },
          },
        });

        const otherCaller = callerAs(OTHER_USER_ID);
        const result = await otherCaller.group.deleteTransaction({
          groupId: group.id,
          transactionId: txn.id,
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("FORBIDDEN");
      }, USER_ID);
    });

    it("returns NOT_FOUND for non-existent transaction", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.deleteTransaction({
          groupId: group.id,
          transactionId: 999999,
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("NOT_FOUND");
      }, USER_ID);
    });

    it("returns NOT_FOUND for already deleted transaction", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        const txn = await tx.transaction.create({
          data: {
            groupId: group.id,
            amount: 50,
            payerId: USER_ID,
            createdById: USER_ID,
            title: "Test transaction",
            deletedAt: new Date(),
            transactionDetails: {
              create: { recipientId: OTHER_USER_ID, groupId: group.id, amount: 50 },
            },
          },
        });

        const result = await caller.group.deleteTransaction({
          groupId: group.id,
          transactionId: txn.id,
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("NOT_FOUND");
      }, USER_ID);
    });
  });

  // ─── restoreTransaction ────────────────────────────────────────────
  describe("restoreTransaction", () => {
    it("restores a soft-deleted transaction", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        const txn = await tx.transaction.create({
          data: {
            groupId: group.id,
            amount: 50,
            payerId: USER_ID,
            createdById: USER_ID,
            title: "Test transaction",
            deletedAt: new Date(),
            transactionDetails: {
              create: { recipientId: OTHER_USER_ID, groupId: group.id, amount: 50 },
            },
          },
        });

        const result = await caller.group.restoreTransaction({
          groupId: group.id,
          transactionId: txn.id,
        });

        expect(result.error).toBeNull();

        const restored = await tx.transaction.findUnique({ where: { id: txn.id } });
        expect(restored!.deletedAt).toBeNull();
      }, USER_ID);
    });

    it("non-creator non-admin cannot restore", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        const txn = await tx.transaction.create({
          data: {
            groupId: group.id,
            amount: 50,
            payerId: USER_ID,
            createdById: USER_ID,
            title: "Test transaction",
            deletedAt: new Date(),
            transactionDetails: {
              create: { recipientId: OTHER_USER_ID, groupId: group.id, amount: 50 },
            },
          },
        });

        const otherCaller = callerAs(OTHER_USER_ID);
        const result = await otherCaller.group.restoreTransaction({
          groupId: group.id,
          transactionId: txn.id,
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("FORBIDDEN");
      }, USER_ID);
    });

    it("returns NOT_FOUND for non-deleted transaction", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });
        const txn = await tx.transaction.create({
          data: {
            groupId: group.id,
            amount: 50,
            payerId: USER_ID,
            createdById: USER_ID,
            title: "Test transaction",
            transactionDetails: {
              create: { recipientId: OTHER_USER_ID, groupId: group.id, amount: 50 },
            },
          },
        });

        const result = await caller.group.restoreTransaction({
          groupId: group.id,
          transactionId: txn.id,
        });

        expect(result.error).not.toBeNull();
        expect(result.error!.code).toBe("NOT_FOUND");
      }, USER_ID);
    });
  });

  // ─── getGroupTransactions ──────────────────────────────────────────
  describe("getGroupTransactions", () => {
    it("returns all transactions for the group", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        await tx.transaction.createMany({
          data: [
            { groupId: group.id, amount: 50, payerId: USER_ID, createdById: USER_ID , title: "Test transaction" },
            { groupId: group.id, amount: 30, payerId: OTHER_USER_ID, createdById: OTHER_USER_ID , title: "Test transaction" },
          ],
        });

        const result = await caller.group.getGroupTransactions({ groupId: group.id });

        expect(result.error).toBeNull();
        expect(result.data!.length).toBe(2);
      }, USER_ID);
    });

    it("excludes soft-deleted transactions", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        await tx.transaction.createMany({
          data: [
            { groupId: group.id, amount: 50, payerId: USER_ID, createdById: USER_ID , title: "Test transaction" },
            {
              groupId: group.id,
              amount: 30,
              payerId: USER_ID,
              createdById: USER_ID,
              title: "Test transaction",
              deletedAt: new Date(),
            },
          ],
        });

        const result = await caller.group.getGroupTransactions({ groupId: group.id });

        expect(result.error).toBeNull();
        expect(result.data!.length).toBe(1);
      }, USER_ID);
    });

    it("filters by category", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        await tx.transaction.createMany({
          data: [
            {
              groupId: group.id,
              amount: 50,
              payerId: USER_ID,
              createdById: USER_ID,
              title: "Test transaction",
              category: "FOOD",
            },
            {
              groupId: group.id,
              amount: 30,
              payerId: USER_ID,
              createdById: USER_ID,
              title: "Test transaction",
              category: "TRAVEL",
            },
          ],
        });

        const result = await caller.group.getGroupTransactions({
          groupId: group.id,
          categories: ["FOOD"],
        });

        expect(result.error).toBeNull();
        expect(result.data!.length).toBe(1);
        expect(result.data![0]!.category).toBe("FOOD");
      }, USER_ID);
    });

    it("filters by payer", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        await tx.transaction.createMany({
          data: [
            { groupId: group.id, amount: 50, payerId: USER_ID, createdById: USER_ID , title: "Test transaction" },
            { groupId: group.id, amount: 30, payerId: OTHER_USER_ID, createdById: OTHER_USER_ID , title: "Test transaction" },
          ],
        });

        const result = await caller.group.getGroupTransactions({
          groupId: group.id,
          payerIds: [OTHER_USER_ID],
        });

        expect(result.error).toBeNull();
        expect(result.data!.length).toBe(1);
        expect(result.data![0]!.payerId).toBe(OTHER_USER_ID);
      }, USER_ID);
    });

    it("filters by date range", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        await tx.transaction.createMany({
          data: [
            {
              groupId: group.id,
              amount: 50,
              payerId: USER_ID,
              createdById: USER_ID,
              title: "Test transaction",
              transactionDate: new Date("2025-01-15"),
            },
            {
              groupId: group.id,
              amount: 30,
              payerId: USER_ID,
              createdById: USER_ID,
              title: "Test transaction",
              transactionDate: new Date("2025-06-15"),
            },
          ],
        });

        const result = await caller.group.getGroupTransactions({
          groupId: group.id,
          dateFrom: new Date("2025-01-01"),
          dateTo: new Date("2025-03-01"),
        });

        expect(result.error).toBeNull();
        expect(result.data!.length).toBe(1);
      }, USER_ID);
    });

    it("searches by title", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        await tx.transaction.createMany({
          data: [
            {
              groupId: group.id,
              amount: 50,
              payerId: USER_ID,
              createdById: USER_ID,
              title: "Pizza night",
            },
            {
              groupId: group.id,
              amount: 30,
              payerId: USER_ID,
              createdById: USER_ID,
              title: "Gas station",
            },
          ],
        });

        const result = await caller.group.getGroupTransactions({
          groupId: group.id,
          search: "pizza",
        });

        expect(result.error).toBeNull();
        expect(result.data!.length).toBe(1);
      }, USER_ID);
    });

    it("searches by category label (text match)", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        await tx.transaction.createMany({
          data: [
            {
              groupId: group.id,
              amount: 50,
              payerId: USER_ID,
              createdById: USER_ID,
              title: "Test transaction",
              category: "FOOD",
            },
            {
              groupId: group.id,
              amount: 30,
              payerId: USER_ID,
              createdById: USER_ID,
              title: "Test transaction",
              category: "TRAVEL",
            },
          ],
        });

        // "food" matches the label "Food" for FOOD category
        const result = await caller.group.getGroupTransactions({
          groupId: group.id,
          search: "food",
        });

        expect(result.error).toBeNull();
        expect(result.data!.length).toBe(1);
      }, USER_ID);
    });

    it("non-member cannot query transactions", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const thirdCaller = callerAs(THIRD_USER_ID);
        await expect(thirdCaller.group.getGroupTransactions({ groupId: group.id })).rejects.toThrow(
          TRPCError,
        );
      }, USER_ID);
    });
  });

  // ─── getSimpleBalances ─────────────────────────────────────────────
  describe("getSimpleBalances", () => {
    it("returns empty balances for group with no transactions", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.getSimpleBalances({ groupId: group.id });

        expect(result.error).toBeNull();
        expect(result.data).toEqual({});
      }, USER_ID);
    });

    it("non-member cannot query balances", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const thirdCaller = callerAs(THIRD_USER_ID);
        await expect(thirdCaller.group.getSimpleBalances({ groupId: group.id })).rejects.toThrow(
          TRPCError,
        );
      }, USER_ID);
    });
  });

  // ─── getDetailedBalances ───────────────────────────────────────────
  describe("getDetailedBalances", () => {
    it("returns empty result for group with no transactions", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const result = await caller.group.getDetailedBalances({ groupId: group.id });

        expect(result.error).toBeNull();
        expect(result.data!.userBalances).toEqual({});
        expect(result.data!.settlementPlan).toEqual([]);
      }, USER_ID);
    });

    it("non-member cannot query detailed balances", async () => {
      await withTestContext(async ({ caller, tx, callerAs }) => {
        const group = await seedGroupWithMembers({ caller, tx, callerAs });

        const thirdCaller = callerAs(THIRD_USER_ID);
        await expect(thirdCaller.group.getDetailedBalances({ groupId: group.id })).rejects.toThrow(
          TRPCError,
        );
      }, USER_ID);
    });
  });
});
