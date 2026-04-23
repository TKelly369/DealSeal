import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { asyncHandler } from "../util/async-handler.js";
import { recordAudit } from "../services/audit-service.js";
import { createAuthMiddleware } from "../middleware/auth.js";

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  displayName: z.string().min(1),
  organizationName: z.string().min(1),
  organizationSlug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function createAuthRouter(env: Env): Router {
  const r = Router();

  r.post(
    "/register",
    asyncHandler(async (req, res) => {
      const body = registerBody.parse(req.body);
      const exists = await prisma.user.findUnique({
        where: { email: body.email },
      });
      if (exists) {
        throw new HttpError(409, "Email in use", "EMAIL_IN_USE");
      }
      const slugTaken = await prisma.organization.findUnique({
        where: { slug: body.organizationSlug },
      });
      if (slugTaken) {
        throw new HttpError(409, "Slug in use", "SLUG_IN_USE");
      }
      const passwordHash = await bcrypt.hash(body.password, 12);
      const { user, org } = await prisma.$transaction(async (db) => {
        const org = await db.organization.create({
          data: { name: body.organizationName, slug: body.organizationSlug },
        });
        const user = await db.user.create({
          data: {
            email: body.email,
            passwordHash,
            displayName: body.displayName,
          },
        });
        await db.membership.create({
          data: {
            userId: user.id,
            orgId: org.id,
            roles: ["ADMIN"],
          },
        });
        await db.billingSubscription.create({
          data: {
            orgId: org.id,
            tier: "STARTER",
            status: "active",
          },
        });
        return { user, org };
      });

      await recordAudit({
        orgId: org.id,
        actorUserId: user.id,
        action: "REGISTER",
        resource: "Organization",
        resourceId: org.id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      const token = jwt.sign(
        { sub: user.id, orgId: org.id, roles: ["ADMIN"] },
        env.JWT_SECRET,
        { expiresIn: "12h" },
      );
      res.status(201).json({ token, userId: user.id, orgId: org.id });
    }),
  );

  r.post(
    "/login",
    asyncHandler(async (req, res) => {
      const body = loginBody.parse(req.body);
      const user = await prisma.user.findUnique({
        where: { email: body.email },
        include: { memberships: true },
      });
      if (!user) {
        throw new HttpError(401, "Invalid credentials", "AUTH_FAILED");
      }
      const ok = await bcrypt.compare(body.password, user.passwordHash);
      if (!ok) {
        throw new HttpError(401, "Invalid credentials", "AUTH_FAILED");
      }
      const membership = user.memberships[0];
      if (!membership) {
        throw new HttpError(403, "No organization membership", "NO_MEMBERSHIP");
      }
      const token = jwt.sign(
        {
          sub: user.id,
          orgId: membership.orgId,
          roles: membership.roles,
        },
        env.JWT_SECRET,
        { expiresIn: "12h" },
      );
      await recordAudit({
        orgId: membership.orgId,
        actorUserId: user.id,
        action: "LOGIN",
        resource: "Session",
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json({ token, userId: user.id, orgId: membership.orgId });
    }),
  );

  const requireAuth = createAuthMiddleware(env);

  r.get(
    "/me",
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await prisma.user.findUnique({
        where: { id: req.auth!.sub },
        select: {
          id: true,
          email: true,
          displayName: true,
          createdAt: true,
        },
      });
      if (!user) {
        throw new HttpError(404, "User not found", "NOT_FOUND");
      }
      res.json({
        user: {
          ...user,
          orgId: req.auth!.orgId,
          roles: req.auth!.roles,
        },
      });
    }),
  );

  r.post(
    "/logout",
    requireAuth,
    asyncHandler(async (req, res) => {
      await recordAudit({
        orgId: req.auth!.orgId,
        actorUserId: req.auth!.sub,
        action: "LOGOUT",
        resource: "Session",
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(204).end();
    }),
  );

  return r;
}
