import { describe, it, expect } from "vitest";
import { withTestContext } from "../helpers/with-test-context";

const TEST_USER_ID = "test-user-getprofile";

const seedUser = {
  id: TEST_USER_ID,
  email: "testprofile@example.com",
  username: "testprofile",
  firstName: "Test",
  lastName: "User",
  venmoUsername: "testvenmo",
  cashappUsername: "testcashapp",
};

describe("userRouter", () => {
  describe("getProfile", () => {
    it("returns the current user's profile", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: seedUser });

        const result = await caller.user.getProfile();

        expect(result.error).toBeNull();
        expect(result.data).toMatchObject({
          id: TEST_USER_ID,
          email: seedUser.email,
          username: seedUser.username,
          firstName: seedUser.firstName,
          lastName: seedUser.lastName,
          venmoUsername: seedUser.venmoUsername,
          cashappUsername: seedUser.cashappUsername,
        });
        expect(result.data?.createdAt).toBeInstanceOf(Date);
      }, TEST_USER_ID);
    });

    it("returns NOT_FOUND for a deleted user", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({
          data: { ...seedUser, deletedAt: new Date() },
        });

        const result = await caller.user.getProfile();

        expect(result.data).toBeNull();
        expect(result.error?.code).toBe("NOT_FOUND");
      }, TEST_USER_ID);
    });

    it("returns NOT_FOUND when user does not exist", async () => {
      await withTestContext(async ({ caller }) => {
        const result = await caller.user.getProfile();

        expect(result.data).toBeNull();
        expect(result.error?.code).toBe("NOT_FOUND");
      }, "nonexistent-user-id");
    });

    it("returns null for optional fields when not set", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({
          data: {
            id: TEST_USER_ID,
            email: "minimal@example.com",
            firstName: "Minimal",
            lastName: "User",
          },
        });

        const result = await caller.user.getProfile();

        expect(result.error).toBeNull();
        expect(result.data?.username).toBeNull();
        expect(result.data?.venmoUsername).toBeNull();
        expect(result.data?.cashappUsername).toBeNull();
      }, TEST_USER_ID);
    });
  });

  describe("updateProfile", () => {
    const UPDATE_USER_ID = "test-user-updateprofile";
    const updateUser = {
      id: UPDATE_USER_ID,
      email: "updateprofile@example.com",
      firstName: "Update",
      lastName: "User",
    };

    it("updates payment usernames", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: updateUser });

        const result = await caller.user.updateProfile({
          venmoUsername: "myvenmo",
          cashappUsername: "mycashapp",
        });

        expect(result.error).toBeNull();

        const updated = await tx.user.findUnique({ where: { id: UPDATE_USER_ID } });
        expect(updated?.venmoUsername).toBe("myvenmo");
        expect(updated?.cashappUsername).toBe("mycashapp");
      }, UPDATE_USER_ID);
    });

    it("coerces empty payment usernames to null", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({
          data: { ...updateUser, venmoUsername: "existing", cashappUsername: "existing" },
        });

        await caller.user.updateProfile({
          venmoUsername: "",
          cashappUsername: "  ",
        });

        const updated = await tx.user.findUnique({ where: { id: UPDATE_USER_ID } });
        expect(updated?.venmoUsername).toBeNull();
        expect(updated?.cashappUsername).toBeNull();
      }, UPDATE_USER_ID);
    });

    it("sets a new username", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: updateUser });

        const result = await caller.user.updateProfile({ username: "newusername" });

        expect(result.error).toBeNull();

        const updated = await tx.user.findUnique({ where: { id: UPDATE_USER_ID } });
        expect(updated?.username).toBe("newusername");
      }, UPDATE_USER_ID);
    });

    it("lowercases the username via schema transform", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: updateUser });

        await caller.user.updateProfile({ username: "MyUserName" });

        const updated = await tx.user.findUnique({ where: { id: UPDATE_USER_ID } });
        expect(updated?.username).toBe("myusername");
      }, UPDATE_USER_ID);
    });

    it("rejects a profane username", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: updateUser });

        const result = await caller.user.updateProfile({ username: "ass" });

        expect(result.data).toBeNull();
        expect(result.error?.code).toBe("BAD_REQUEST");
      }, UPDATE_USER_ID);
    });

    it("rejects a duplicate username (case-insensitive)", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: updateUser });
        await tx.user.create({
          data: {
            id: "other-user-id",
            email: "other@example.com",
            firstName: "Other",
            lastName: "User",
            username: "takenname",
          },
        });

        const result = await caller.user.updateProfile({ username: "TakenName" });

        expect(result.data).toBeNull();
        expect(result.error?.code).toBe("CONFLICT");
      }, UPDATE_USER_ID);
    });

    it("allows the same user to keep their current username", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: { ...updateUser, username: "myname" } });

        const result = await caller.user.updateProfile({ username: "myname" });

        expect(result.error).toBeNull();
      }, UPDATE_USER_ID);
    });

    it("only updates the caller's own profile", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: updateUser });
        await tx.user.create({
          data: {
            id: "other-user-id",
            email: "other@example.com",
            firstName: "Other",
            lastName: "User",
            username: "othername",
          },
        });

        await caller.user.updateProfile({ venmoUsername: "changed" });

        const other = await tx.user.findUnique({ where: { id: "other-user-id" } });
        expect(other?.venmoUsername).toBeNull();
      }, UPDATE_USER_ID);
    });

    it("strips unknown fields from input", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: updateUser });

        // Intentionally passing unknown fields to verify Zod strips them before reaching the handler
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const result = await caller.user.updateProfile({
          venmoUsername: "valid",
          email: "hacked@evil.com",
          firstName: "Hacked",
        } as any);

        expect(result.error).toBeNull();

        const updated = await tx.user.findUnique({ where: { id: UPDATE_USER_ID } });
        expect(updated?.email).toBe(updateUser.email);
        expect(updated?.firstName).toBe(updateUser.firstName);
        expect(updated?.venmoUsername).toBe("valid");
      }, UPDATE_USER_ID);
    });

    it("rejects username that is too short", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: updateUser });

        await expect(caller.user.updateProfile({ username: "ab" })).rejects.toThrow();
      }, UPDATE_USER_ID);
    });

    it("rejects username with invalid characters", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: updateUser });

        await expect(caller.user.updateProfile({ username: "bad name!" })).rejects.toThrow();
      }, UPDATE_USER_ID);
    });
  });

  describe("getUserById", () => {
    const CALLER_ID = "test-caller-getbyid";
    const TARGET_ID = "test-target-getbyid";
    const callerUser = {
      id: CALLER_ID,
      email: "caller@example.com",
      firstName: "Caller",
      lastName: "User",
    };
    const targetUser = {
      id: TARGET_ID,
      email: "target@example.com",
      username: "targetuser",
      firstName: "Target",
      lastName: "User",
    };

    it("returns a safe user by ID", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        await tx.user.create({ data: targetUser });

        const result = await caller.user.getUserById(TARGET_ID);

        expect(result.error).toBeNull();
        expect(result.data).toMatchObject({
          id: TARGET_ID,
          username: "targetuser",
          firstName: "Target",
          lastName: "User",
        });
        expect(result.data?.createdAt).toBeInstanceOf(Date);
      }, CALLER_ID);
    });

    it("does not expose email in SafeUser response", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        await tx.user.create({ data: targetUser });

        const result = await caller.user.getUserById(TARGET_ID);

        expect(result.error).toBeNull();
        expect(result.data).not.toHaveProperty("email");
      }, CALLER_ID);
    });

    it("returns NOT_FOUND for a nonexistent user", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });

        const result = await caller.user.getUserById("does-not-exist");

        expect(result.data).toBeNull();
        expect(result.error?.code).toBe("NOT_FOUND");
      }, CALLER_ID);
    });

    it("returns NOT_FOUND for a deleted user", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        await tx.user.create({ data: { ...targetUser, deletedAt: new Date() } });

        const result = await caller.user.getUserById(TARGET_ID);

        expect(result.data).toBeNull();
        expect(result.error?.code).toBe("NOT_FOUND");
      }, CALLER_ID);
    });

    it("rejects empty string input", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });

        await expect(caller.user.getUserById("")).rejects.toThrow();
      }, CALLER_ID);
    });
  });

  describe("getGroups", () => {
    const USER_ID = "test-user-getgroups";
    const OTHER_USER_ID = "test-other-getgroups";
    const baseUser = {
      id: USER_ID,
      email: "getgroups@example.com",
      username: "getgroupsuser",
      firstName: "Groups",
      lastName: "User",
    };
    const otherUser = {
      id: OTHER_USER_ID,
      email: "othergroups@example.com",
      username: "othergroups",
      firstName: "Other",
      lastName: "User",
    };

    it("returns groups the user has joined", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: baseUser });
        await tx.user.create({ data: otherUser });
        const group = await tx.group.create({
          data: {
            name: "Test Group",
            slug: "test-group-1",
            createdById: USER_ID,
            members: {
              create: {
                memberId: USER_ID,
                invitedById: USER_ID,
                status: "JOINED",
                isAdmin: true,
              },
            },
          },
        });

        const result = await caller.user.getGroups();

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        expect(result.data![0]!.name).toBe("Test Group");
        expect(result.data![0]!.id).toBe(group.id);
      }, USER_ID);
    });

    it("excludes groups the user is only invited to", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: baseUser });
        await tx.user.create({ data: otherUser });
        await tx.group.create({
          data: {
            name: "Invited Group",
            slug: "invited-group-1",
            createdById: OTHER_USER_ID,
            members: {
              create: {
                memberId: USER_ID,
                invitedById: OTHER_USER_ID,
                status: "INVITED",
              },
            },
          },
        });

        const result = await caller.user.getGroups();

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(0);
      }, USER_ID);
    });

    it("excludes deleted groups", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: baseUser });
        await tx.group.create({
          data: {
            name: "Deleted Group",
            slug: "deleted-group-1",
            createdById: USER_ID,
            deletedAt: new Date(),
            members: {
              create: {
                memberId: USER_ID,
                invitedById: USER_ID,
                status: "JOINED",
                isAdmin: true,
              },
            },
          },
        });

        const result = await caller.user.getGroups();

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(0);
      }, USER_ID);
    });

    it("returns group members as SafeUser (no email)", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: baseUser });
        await tx.user.create({ data: otherUser });
        await tx.group.create({
          data: {
            name: "Members Group",
            slug: "members-group-1",
            createdById: USER_ID,
            members: {
              createMany: {
                data: [
                  { memberId: USER_ID, invitedById: USER_ID, status: "JOINED", isAdmin: true },
                  { memberId: OTHER_USER_ID, invitedById: USER_ID, status: "JOINED" },
                ],
              },
            },
          },
        });

        const result = await caller.user.getGroups();

        expect(result.data![0]!.groupUsers).toHaveLength(2);
        for (const user of result.data![0]!.groupUsers) {
          expect(user).not.toHaveProperty("email");
          expect(user).toHaveProperty("username");
          expect(user).toHaveProperty("firstName");
        }
      }, USER_ID);
    });

    // Known limitation: Prisma interactive transactions with nested Transaction
    // includes hang inside Vitest's worker pool. The balance calculation is tested
    // separately as a pure function via calculateGroupBalances.
    it.todo("includes balance when user is owed money");

    it("returns empty array when user has no groups", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: baseUser });

        const result = await caller.user.getGroups();

        expect(result.error).toBeNull();
        expect(result.data).toEqual([]);
      }, USER_ID);
    });
  });

  describe("getPendingInvites", () => {
    const USER_ID = "test-user-invites";
    const INVITER_ID = "test-inviter";
    const baseUser = {
      id: USER_ID,
      email: "invitee@example.com",
      username: "inviteeuser",
      firstName: "Invitee",
      lastName: "User",
    };
    const inviterUser = {
      id: INVITER_ID,
      email: "inviter@example.com",
      username: "inviteruser",
      firstName: "Inviter",
      lastName: "User",
    };

    it("returns pending invitations for the user", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: baseUser });
        await tx.user.create({ data: inviterUser });
        await tx.group.create({
          data: {
            name: "Invite Group",
            slug: "invite-group-1",
            createdById: INVITER_ID,
            members: {
              createMany: {
                data: [
                  {
                    memberId: INVITER_ID,
                    invitedById: INVITER_ID,
                    status: "JOINED",
                    isAdmin: true,
                  },
                  { memberId: USER_ID, invitedById: INVITER_ID, status: "INVITED" },
                ],
              },
            },
          },
        });

        const result = await caller.user.getPendingInvites();

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        expect(result.data![0]!.groupName).toBe("Invite Group");
        expect(result.data![0]!.memberCount).toBe(1);
        expect(result.data![0]!.invitedBy.id).toBe(INVITER_ID);
      }, USER_ID);
    });

    it("does not expose inviter email in response", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: baseUser });
        await tx.user.create({ data: inviterUser });
        await tx.group.create({
          data: {
            name: "Safe Invite Group",
            slug: "safe-invite-group-1",
            createdById: INVITER_ID,
            members: {
              createMany: {
                data: [
                  {
                    memberId: INVITER_ID,
                    invitedById: INVITER_ID,
                    status: "JOINED",
                    isAdmin: true,
                  },
                  { memberId: USER_ID, invitedById: INVITER_ID, status: "INVITED" },
                ],
              },
            },
          },
        });

        const result = await caller.user.getPendingInvites();

        expect(result.data![0]!.invitedBy).not.toHaveProperty("email");
      }, USER_ID);
    });

    it("excludes joined memberships from pending invites", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: baseUser });
        await tx.user.create({ data: inviterUser });
        await tx.group.create({
          data: {
            name: "Joined Group",
            slug: "joined-group-1",
            createdById: INVITER_ID,
            members: {
              createMany: {
                data: [
                  {
                    memberId: INVITER_ID,
                    invitedById: INVITER_ID,
                    status: "JOINED",
                    isAdmin: true,
                  },
                  { memberId: USER_ID, invitedById: INVITER_ID, status: "JOINED" },
                ],
              },
            },
          },
        });

        const result = await caller.user.getPendingInvites();

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(0);
      }, USER_ID);
    });

    it("excludes soft-deleted invitations", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: baseUser });
        await tx.user.create({ data: inviterUser });
        await tx.group.create({
          data: {
            name: "Revoked Group",
            slug: "revoked-group-1",
            createdById: INVITER_ID,
            members: {
              createMany: {
                data: [
                  {
                    memberId: INVITER_ID,
                    invitedById: INVITER_ID,
                    status: "JOINED",
                    isAdmin: true,
                  },
                  {
                    memberId: USER_ID,
                    invitedById: INVITER_ID,
                    status: "INVITED",
                    deletedAt: new Date(),
                  },
                ],
              },
            },
          },
        });

        const result = await caller.user.getPendingInvites();

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(0);
      }, USER_ID);
    });

    it("excludes invites from deleted groups", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: baseUser });
        await tx.user.create({ data: inviterUser });
        await tx.group.create({
          data: {
            name: "Deleted Group",
            slug: "deleted-invite-group-1",
            createdById: INVITER_ID,
            deletedAt: new Date(),
            members: {
              createMany: {
                data: [
                  {
                    memberId: INVITER_ID,
                    invitedById: INVITER_ID,
                    status: "JOINED",
                    isAdmin: true,
                  },
                  { memberId: USER_ID, invitedById: INVITER_ID, status: "INVITED" },
                ],
              },
            },
          },
        });

        const result = await caller.user.getPendingInvites();

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(0);
      }, USER_ID);
    });

    it("can see new invite after previous one was revoked (soft-deleted)", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: baseUser });
        await tx.user.create({ data: inviterUser });
        const group = await tx.group.create({
          data: {
            name: "Reinvite Group",
            slug: "reinvite-group-1",
            createdById: INVITER_ID,
            members: {
              create: {
                memberId: INVITER_ID,
                invitedById: INVITER_ID,
                status: "JOINED",
                isAdmin: true,
              },
            },
          },
        });

        // First invite — then revoked
        await tx.groupMember.create({
          data: {
            groupId: group.id,
            memberId: USER_ID,
            invitedById: INVITER_ID,
            status: "INVITED",
            deletedAt: new Date(),
          },
        });

        // No pending invites after revoke
        const afterRevoke = await caller.user.getPendingInvites();
        expect(afterRevoke.data).toHaveLength(0);

        // Re-invited with a new record (unique constraint on groupId+memberId means
        // the old soft-deleted record must be updated, not a new one created).
        // Simulate re-invite by updating the existing record.
        await tx.groupMember.updateMany({
          where: { groupId: group.id, memberId: USER_ID },
          data: { deletedAt: null, status: "INVITED" },
        });

        const afterReinvite = await caller.user.getPendingInvites();
        expect(afterReinvite.data).toHaveLength(1);
        expect(afterReinvite.data![0]!.groupName).toBe("Reinvite Group");
      }, USER_ID);
    });

    it("user who left a group can be reinvited", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: baseUser });
        await tx.user.create({ data: inviterUser });
        const group = await tx.group.create({
          data: {
            name: "Rejoin Group",
            slug: "rejoin-group-1",
            createdById: INVITER_ID,
            members: {
              create: {
                memberId: INVITER_ID,
                invitedById: INVITER_ID,
                status: "JOINED",
                isAdmin: true,
              },
            },
          },
        });

        // User was a member, then left (soft-deleted with JOINED status)
        await tx.groupMember.create({
          data: {
            groupId: group.id,
            memberId: USER_ID,
            invitedById: INVITER_ID,
            status: "JOINED",
            deletedAt: new Date(),
          },
        });

        // Re-invited by updating the record back to INVITED
        await tx.groupMember.updateMany({
          where: { groupId: group.id, memberId: USER_ID },
          data: { deletedAt: null, status: "INVITED" },
        });

        const result = await caller.user.getPendingInvites();
        expect(result.data).toHaveLength(1);
        expect(result.data![0]!.groupName).toBe("Rejoin Group");
      }, USER_ID);
    });

    it("returns empty array when user has no invites", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: baseUser });

        const result = await caller.user.getPendingInvites();

        expect(result.error).toBeNull();
        expect(result.data).toEqual([]);
      }, USER_ID);
    });
  });

  describe("searchUsers", () => {
    const CALLER_ID = "test-caller-search";
    const callerUser = {
      id: CALLER_ID,
      email: "searcher@example.com",
      username: "searcher",
      firstName: "Search",
      lastName: "Caller",
    };

    const searchableUsers = [
      {
        id: "search-user-1",
        email: "alice@example.com",
        username: "alice_wonder",
        firstName: "Alice",
        lastName: "Wonder",
      },
      {
        id: "search-user-2",
        email: "bob@example.com",
        username: "bobby_tables",
        firstName: "Bob",
        lastName: "Tables",
      },
      {
        id: "search-user-3",
        email: "carol@example.com",
        username: "carol_dev",
        firstName: "Carol",
        lastName: "Dev",
      },
    ];

    it("finds users by partial username match", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        for (const u of searchableUsers) {
          await tx.user.create({ data: u });
        }

        const result = await caller.user.searchUsers({ query: "alice" });

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        expect(result.data![0]!.username).toBe("alice_wonder");
      }, CALLER_ID);
    });

    it("matches partial username substrings", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        for (const u of searchableUsers) {
          await tx.user.create({ data: u });
        }

        // "bob" should match "bobby_tables"
        const result = await caller.user.searchUsers({ query: "bob" });

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        expect(result.data![0]!.username).toBe("bobby_tables");
      }, CALLER_ID);
    });

    it("username search is case-insensitive", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        for (const u of searchableUsers) {
          await tx.user.create({ data: u });
        }

        const result = await caller.user.searchUsers({ query: "ALICE" });

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        expect(result.data![0]!.username).toBe("alice_wonder");
      }, CALLER_ID);
    });

    it("finds users by exact email match", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        for (const u of searchableUsers) {
          await tx.user.create({ data: u });
        }

        const result = await caller.user.searchUsers({ query: "bob@example.com" });

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        expect(result.data![0]!.id).toBe("search-user-2");
      }, CALLER_ID);
    });

    it("email search requires full match (no partial)", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        for (const u of searchableUsers) {
          await tx.user.create({ data: u });
        }

        const result = await caller.user.searchUsers({ query: "bob@example" });

        // Contains "@" so treated as email search, but no exact match
        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(0);
      }, CALLER_ID);
    });

    it("email search is case-insensitive", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        for (const u of searchableUsers) {
          await tx.user.create({ data: u });
        }

        const result = await caller.user.searchUsers({ query: "BOB@EXAMPLE.COM" });

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
      }, CALLER_ID);
    });

    it("excludes the current user from results", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });

        const result = await caller.user.searchUsers({ query: "searcher" });

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(0);
      }, CALLER_ID);
    });

    it("excludes deleted users from results", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        await tx.user.create({
          data: { ...searchableUsers[0]!, deletedAt: new Date() },
        });

        const result = await caller.user.searchUsers({ query: "alice" });

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(0);
      }, CALLER_ID);
    });

    it("does not expose email in search results", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        for (const u of searchableUsers) {
          await tx.user.create({ data: u });
        }

        const result = await caller.user.searchUsers({ query: "alice" });

        expect(result.data![0]).not.toHaveProperty("email");
      }, CALLER_ID);
    });

    it("returns multiple matches for common substring", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        for (const u of searchableUsers) {
          await tx.user.create({ data: u });
        }

        // "_" appears in all usernames
        const result = await caller.user.searchUsers({ query: "_" });

        expect(result.error).toBeNull();
        expect(result.data!.length).toBeGreaterThanOrEqual(3);
      }, CALLER_ID);
    });

    it("returns empty for no matches", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        for (const u of searchableUsers) {
          await tx.user.create({ data: u });
        }

        const result = await caller.user.searchUsers({ query: "zzzznonexistent" });

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(0);
      }, CALLER_ID);
    });

    it("caps results at 10 users", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        for (let i = 0; i < 15; i++) {
          await tx.user.create({
            data: {
              id: `bulk-user-${i}`,
              email: `bulk${i}@example.com`,
              username: `bulkuser_${i}`,
              firstName: "Bulk",
              lastName: `User${i}`,
            },
          });
        }

        const result = await caller.user.searchUsers({ query: "bulkuser" });

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(10);
      }, CALLER_ID);
    });
  });

  describe("checkUsernameAvailability", () => {
    const CALLER_ID = "test-caller-checkname";
    const callerUser = {
      id: CALLER_ID,
      email: "checker@example.com",
      username: "checker",
      firstName: "Check",
      lastName: "User",
    };

    it("returns available for an unused username", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });

        const result = await caller.user.checkUsernameAvailability({
          username: "totallynewname",
        });

        expect(result.error).toBeNull();
        expect(result.data?.available).toBe(true);
      }, CALLER_ID);
    });

    it("returns unavailable for a taken username", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        await tx.user.create({
          data: {
            id: "other-check-user",
            email: "taken@example.com",
            username: "takenname",
            firstName: "Taken",
            lastName: "User",
          },
        });

        const result = await caller.user.checkUsernameAvailability({
          username: "takenname",
        });

        expect(result.error).toBeNull();
        expect(result.data?.available).toBe(false);
      }, CALLER_ID);
    });

    it("availability check is case-insensitive", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        await tx.user.create({
          data: {
            id: "case-check-user",
            email: "casecheck@example.com",
            username: "myname",
            firstName: "Case",
            lastName: "User",
          },
        });

        const result = await caller.user.checkUsernameAvailability({
          username: "MyName",
        });

        expect(result.error).toBeNull();
        expect(result.data?.available).toBe(false);
      }, CALLER_ID);
    });

    it("returns error for a profane username", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });

        const result = await caller.user.checkUsernameAvailability({
          username: "ass",
        });

        expect(result.data).toBeNull();
        expect(result.error?.code).toBe("BAD_REQUEST");
      }, CALLER_ID);
    });

    it("checks against soft-deleted users (DB unique constraint)", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });
        await tx.user.create({
          data: {
            id: "deleted-name-user",
            email: "deletedname@example.com",
            username: "ghostname",
            firstName: "Ghost",
            lastName: "User",
            deletedAt: new Date(),
          },
        });

        const result = await caller.user.checkUsernameAvailability({
          username: "ghostname",
        });

        // Should be unavailable because DB unique constraint spans all rows including deleted
        expect(result.error).toBeNull();
        expect(result.data?.available).toBe(false);
      }, CALLER_ID);
    });

    it("rejects input that fails schema validation", async () => {
      await withTestContext(async ({ caller, tx }) => {
        await tx.user.create({ data: callerUser });

        await expect(caller.user.checkUsernameAvailability({ username: "ab" })).rejects.toThrow();
      }, CALLER_ID);
    });
  });
});
