import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppService } from "./app.service";
import { verifyAndExtractSessionToken } from "./session-token";

export type UserRole = "admin" | "hr" | "manager" | "employee";
export type AuthenticatedActor = {
  sessionKey: string;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  position: string;
};

const PUBLIC_ROUTE_KEY = "isPublicRoute";
const ALLOWED_ROLES_KEY = "allowedRoles";
const backendAuthMode = (process.env.ENFORCE_BACKEND_AUTH ?? "true").trim().toLowerCase();
const enforceBackendAuth =
  backendAuthMode !== "false";

export const PublicRoute = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(ALLOWED_ROLES_KEY, roles);

function requiresAuthenticatedRead(request: { method?: string; path?: string; originalUrl?: string } | undefined) {
  return Boolean(request?.method);
}

function readSessionTokenFromRequest(
  request: {
    cookies?: Record<string, string | undefined>;
    headers?: Record<string, string | string[] | undefined>;
  } | undefined
) {
  const rawCookieSession = request?.cookies?.pp_session;
  const headerSession = request?.headers?.["x-session-token"] ?? request?.headers?.["x-session-key"];
  const tokenFromHeader = Array.isArray(headerSession) ? headerSession[0] : headerSession;
  return verifyAndExtractSessionToken(rawCookieSession) ?? verifyAndExtractSessionToken(tokenFromHeader);
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly appService: AppService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext) {
    if (!enforceBackendAuth) {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    if (!requiresAuthenticatedRead(request)) {
      return true;
    }
    const extractedSession = readSessionTokenFromRequest(request);
    if (!extractedSession) {
      throw new UnauthorizedException("Session is required.");
    }

    const actor = await this.appService.resolveSessionActor(extractedSession);
    if (!actor) {
      throw new UnauthorizedException("Session is invalid.");
    }

    request.user = actor;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    if (!enforceBackendAuth) {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    if (!requiresAuthenticatedRead(request)) {
      return true;
    }

    const allowedRoles = this.reflector.getAllAndOverride<UserRole[]>(ALLOWED_ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }
    const actor = request?.user as AuthenticatedActor | undefined;
    if (!actor) {
      throw new UnauthorizedException("Session is required.");
    }
    if (!allowedRoles.includes(actor.role)) {
      throw new ForbiddenException("You are not allowed to access this resource.");
    }

    return true;
  }
}
