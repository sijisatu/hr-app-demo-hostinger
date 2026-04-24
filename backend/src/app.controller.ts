import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import type { Request, Response } from "express";
import { AppService } from "./common/app.service";
import { DatabaseService } from "./common/database.service";
import { MetricsService } from "./common/metrics.service";
import { PublicRoute, Roles } from "./common/authz";
import type { AuthenticatedActor } from "./common/authz";
import { IdempotencyInterceptor } from "./common/idempotency.interceptor";
import { verifyAndExtractSessionToken } from "./common/session-token";
import {
  AttendanceHistoryQueryDto,
  AuditLogListQueryDto,
  CheckInDto,
  CheckOutDto,
  CreateEmployeeDto,
  CreateCompensationProfileDto,
  CreateDepartmentDto,
  CreateExportDto,
  EmployeeListQueryDto,
  ExportJobStatusQueryDto,
  CreateOvertimeDto,
  PayslipListQueryDto,
  ReimbursementRequestListQueryDto,
  CreateReimbursementClaimTypeDto,
  CreateReimbursementRequestDto,
  CreateTaxProfileDto,
  OvertimeApproveDto,
  CreatePayrollComponentDto,
  ChangePasswordDto,
  EmployeeLoginDto,
  ExportPayslipDto,
  GeneratePayrollRunDto,
  LeaveApproveDto,
  LeaveRequestDto,
  PublishPayrollRunDto,
  ReimbursementApproveDto,
  ReimbursementProcessDto,
  ResetEmployeePasswordDto,
  UploadEmployeeDocumentDto,
  UpdateEmployeeDto,
  UpdateCompensationProfileDto,
  UpdateDepartmentDto,
  UpdateReimbursementClaimTypeDto,
  UpdateReimbursementRequestDto,
  UpdateTaxProfileDto,
  UpdatePayrollComponentDto
} from "./common/dtos";

const FIVE_MB = 5 * 1024 * 1024;
const TEN_MB = 10 * 1024 * 1024;

const imageOnlyMimes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
const documentMimes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword"
]);
const leaveSupportingDocumentMimes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

function rejectInvalidFile(allowedMimes: Set<string>) {
  return (_: unknown, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
    if (!allowedMimes.has(file.mimetype)) {
      callback(new BadRequestException("Unsupported file type.") as unknown as Error, false);
      return;
    }
    callback(null, true);
  };
}

@Controller("api")
export class AppController {
  constructor(
    @Inject(AppService) private readonly appService: AppService,
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(MetricsService) private readonly metricsService: MetricsService
  ) {}

  private setNoStore(res: Response) {
    res.setHeader("Cache-Control", "no-store");
  }

  private setShortCache(res: Response, maxAgeSeconds = 30) {
    res.setHeader("Cache-Control", `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 2}`);
  }

  private async resolveActorFromRequest(request: Request) {
    const req = request as Request & {
      user?: AuthenticatedActor;
      cookies?: Record<string, string | undefined>;
      headers?: Record<string, string | string[] | undefined>;
    };
    if (req.user) {
      return req.user;
    }

    const rawCookieSession = req.cookies?.pp_session;
    const headerSession = req.headers?.["x-session-token"] ?? req.headers?.["x-session-key"];
    const tokenFromHeader = Array.isArray(headerSession) ? headerSession[0] : headerSession;
    const sessionSubject = verifyAndExtractSessionToken(rawCookieSession) ?? verifyAndExtractSessionToken(tokenFromHeader);
    if (!sessionSubject) {
      return undefined;
    }

    const actor = await this.appService.resolveSessionActor(sessionSubject);
    if (actor) {
      req.user = actor;
    }
    return actor ?? undefined;
  }

  @Get("health")
  @PublicRoute()
  async health(@Res({ passthrough: true }) res: Response) {
    this.setShortCache(res, 15);
    return this.wrap(await this.appService.health());
  }

  @Get("health/live")
  @PublicRoute()
  async liveness(@Res({ passthrough: true }) res: Response) {
    this.setShortCache(res, 10);
    return this.wrap({
      status: "live",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime())
    });
  }

  @Get("health/ready")
  @PublicRoute()
  async readiness(@Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
    const database = await this.databaseService.healthcheck();
    const ready = !this.databaseService.isEnabled() || database.status === "online";
    if (!ready) {
      res.status(503);
    }
    return this.wrap({
      status: ready ? "ready" : "not-ready",
      timestamp: new Date().toISOString(),
      checks: {
        database
      }
    });
  }

  @Get("ops/metrics")
  @PublicRoute()
  async metrics(@Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
    const requestMetrics = this.metricsService.getSnapshot();
    const queue = this.appService.getExportQueueMetrics();
    const database = await this.databaseService.healthcheck();
    const thresholds = {
      errorRateLast5mPercent: Number(process.env.OPS_ALERT_ERROR_RATE_PERCENT ?? 5),
      latencyP95Ms: Number(process.env.OPS_ALERT_P95_MS ?? 1200),
      queueDepth: Number(process.env.OPS_ALERT_QUEUE_DEPTH ?? 25)
    };

    const alerts: { severity: "warning" | "critical"; code: string; message: string }[] = [];
    if (requestMetrics.errorRateLast5mPercent >= thresholds.errorRateLast5mPercent) {
      alerts.push({
        severity: "critical",
        code: "HIGH_ERROR_RATE",
        message: `Error rate 5m ${requestMetrics.errorRateLast5mPercent}% melewati threshold ${thresholds.errorRateLast5mPercent}%`
      });
    }
    if (requestMetrics.latencyMs.last5mP95 >= thresholds.latencyP95Ms) {
      alerts.push({
        severity: "warning",
        code: "HIGH_P95_LATENCY",
        message: `Latency p95 5m ${requestMetrics.latencyMs.last5mP95}ms melewati threshold ${thresholds.latencyP95Ms}ms`
      });
    }
    if (queue.queued >= thresholds.queueDepth) {
      alerts.push({
        severity: "warning",
        code: "EXPORT_QUEUE_BACKLOG",
        message: `Queue depth ${queue.queued} melewati threshold ${thresholds.queueDepth}`
      });
    }
    if (this.databaseService.isEnabled() && database.status !== "online") {
      alerts.push({
        severity: "critical",
        code: "DATABASE_OFFLINE",
        message: database.message ?? "Database connection offline."
      });
    }

    return this.wrap({
      timestamp: new Date().toISOString(),
      thresholds,
      alerts,
      metrics: {
        requests: requestMetrics,
        database,
        exportQueue: queue
      }
    });
  }

  @Get("ops/audit-logs")
  @Roles("admin", "hr")
  async auditLogs(@Query() query: AuditLogListQueryDto, @Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
    return this.wrap(await this.appService.getAuditLogs(query));
  }

  @Get("dashboard/summary")
  @Roles("admin", "hr", "manager", "employee")
  async dashboardSummary(@Res({ passthrough: true }) res: Response) {
    this.setShortCache(res, 30);
    return this.wrap(await this.appService.getDashboardSummary());
  }

  @Get("employees")
  @Roles("admin", "hr", "manager", "employee")
  async employees(@Query() query: EmployeeListQueryDto, @Req() request: Request, @Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
    const actor = (request as Request & { user?: AuthenticatedActor }).user;
    return this.wrap(await this.appService.getEmployees(query, actor));
  }

  @Post("auth/employee-login")
  @PublicRoute()
  async employeeLogin(@Body() body: EmployeeLoginDto, @Req() request: Request) {
    return this.wrap(
      await this.appService.authenticateEmployee(body.username, body.password, {
        ipAddress: request.ip,
        userAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : null
      })
    );
  }

  @Get("auth/employee-session/:id")
  @PublicRoute()
  async employeeSession(@Param("id") id: string) {
    return this.wrap(await this.appService.getEmployeeSession(id));
  }

  @Get("auth/session/current")
  @PublicRoute()
  async currentSession(@Req() request: Request) {
    const actor = await this.resolveActorFromRequest(request);
    if (!actor) {
      throw new NotFoundException("Session not found");
    }
    return this.wrap(actor);
  }

  @Post("auth/logout")
  @PublicRoute()
  async logout(@Req() request: Request) {
    const rawCookieSession = (request as Request & { cookies?: Record<string, string | undefined> }).cookies?.pp_session;
    const headerSession =
      ((request as Request & { headers?: Record<string, string | string[] | undefined> }).headers?.["x-session-token"] as string | undefined) ??
      ((request as Request & { headers?: Record<string, string | string[] | undefined> }).headers?.["x-session-key"] as string | undefined);
    const sessionSubject = verifyAndExtractSessionToken(rawCookieSession) ?? verifyAndExtractSessionToken(headerSession);
    if (!sessionSubject) {
      return this.wrap({ revoked: false });
    }

    return this.wrap(await this.appService.revokeEmployeeSession(sessionSubject));
  }

  @Post("auth/change-password")
  @Roles("admin", "hr", "manager", "employee")
  async changePassword(
    @Body() body: ChangePasswordDto,
    @Req() request: Request
  ) {
    const actor = await this.resolveActorFromRequest(request);
    return this.wrap(await this.appService.changeOwnPassword(body, actor));
  }

  @Post("auth/reset-password")
  @Roles("admin", "hr")
  async resetEmployeePassword(
    @Body() body: ResetEmployeePasswordDto,
    @Req() request: Request
  ) {
    const actor = await this.resolveActorFromRequest(request);
    return this.wrap(await this.appService.resetEmployeePassword(body, actor));
  }

  @Post("employees")
  @Roles("admin", "hr")
  async createEmployee(@Body() body: CreateEmployeeDto, @Req() request: Request) {
    const actor = await this.resolveActorFromRequest(request);
    return this.wrap(await this.appService.createEmployee(body, actor));
  }

  @Patch("employees/:id")
  @Roles("admin", "hr")
  async updateEmployee(@Param("id") id: string, @Body() body: UpdateEmployeeDto, @Req() request: Request) {
    const actor = await this.resolveActorFromRequest(request);
    return this.wrap(await this.appService.updateEmployee(id, body, actor));
  }

  @Delete("employees/:id")
  @Roles("admin", "hr")
  async deleteEmployee(@Param("id") id: string, @Req() request: Request) {
    const actor = await this.resolveActorFromRequest(request);
    return this.wrap(await this.appService.deleteEmployee(id, actor));
  }

  @Get("employees/:id/documents")
  @Roles("admin", "hr", "manager", "employee")
  async employeeDocuments(@Param("id") id: string) {
    return this.wrap(await this.appService.getEmployeeDocuments(id));
  }

  @Post("employees/:id/documents")
  @Roles("admin", "hr")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: TEN_MB },
      fileFilter: rejectInvalidFile(documentMimes),
      storage: diskStorage({
        destination: (request, _, callback) => {
          const employeeId = String(request.params.id ?? "unknown-employee");
          const targetDir = path.resolve(process.cwd(), "storage", "documents", "employee-files", employeeId);
          mkdirSync(targetDir, { recursive: true });
          callback(null, targetDir);
        },
        filename: (_, file, callback) => {
          const extension = path.extname(file.originalname) || ".bin";
          callback(null, `${Date.now()}-${randomUUID().slice(0, 6)}${extension}`);
        }
      })
    })
  )
  async uploadEmployeeDocument(
    @Param("id") id: string,
    @Body() body: UploadEmployeeDocumentDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    const fileUrl = file ? `/storage/documents/employee-files/${id}/${file.filename}` : null;
    return this.wrap(await this.appService.uploadEmployeeDocument(id, body, file, fileUrl));
  }

  @Delete("employees/:id/documents/:documentId")
  @Roles("admin", "hr")
  async deleteEmployeeDocument(@Param("id") id: string, @Param("documentId") documentId: string) {
    return this.wrap(await this.appService.deleteEmployeeDocument(id, documentId));
  }

  @Get("assets/employees/:employeeId/documents/:documentId")
  @Roles("admin", "hr", "manager", "employee")
  async employeeDocumentAsset(
    @Param("employeeId") employeeId: string,
    @Param("documentId") documentId: string,
    @Req() request: Request,
    @Res() res: Response
  ) {
    const actor = await this.resolveActorFromRequest(request);
    const asset = await this.appService.getEmployeeDocumentAsset(employeeId, documentId, actor);
    return res.sendFile(asset.absolutePath);
  }

  @Get("compensation-profiles")
  @Roles("admin", "hr", "manager")
  async compensationProfiles() {
    return this.wrap(await this.appService.getCompensationProfiles());
  }

  @Get("departments")
  @Roles("admin", "hr", "manager")
  async departments() {
    return this.wrap(await this.appService.getDepartments());
  }

  @Post("departments")
  @Roles("admin", "hr")
  async createDepartment(@Body() body: CreateDepartmentDto, @Req() request: Request) {
    const actor = await this.resolveActorFromRequest(request);
    return this.wrap(await this.appService.createDepartment(body, actor));
  }

  @Patch("departments/:id")
  @Roles("admin", "hr")
  async updateDepartment(@Param("id") id: string, @Body() body: UpdateDepartmentDto, @Req() request: Request) {
    const actor = await this.resolveActorFromRequest(request);
    return this.wrap(await this.appService.updateDepartment(id, body, actor));
  }

  @Delete("departments/:id")
  @Roles("admin", "hr")
  async deleteDepartment(@Param("id") id: string, @Req() request: Request) {
    const actor = await this.resolveActorFromRequest(request);
    return this.wrap(await this.appService.deleteDepartment(id, actor));
  }

  @Post("compensation-profiles")
  @Roles("admin", "hr")
  async createCompensationProfile(@Body() body: CreateCompensationProfileDto) {
    return this.wrap(await this.appService.createCompensationProfile(body));
  }

  @Patch("compensation-profiles/:id")
  @Roles("admin", "hr")
  async updateCompensationProfile(@Param("id") id: string, @Body() body: UpdateCompensationProfileDto) {
    return this.wrap(await this.appService.updateCompensationProfile(id, body));
  }

  @Delete("compensation-profiles/:id")
  @Roles("admin", "hr")
  async deleteCompensationProfile(@Param("id") id: string) {
    return this.wrap(await this.appService.deleteCompensationProfile(id));
  }

  @Get("tax-profiles")
  @Roles("admin", "hr", "manager")
  async taxProfiles() {
    return this.wrap(await this.appService.getTaxProfiles());
  }

  @Post("tax-profiles")
  @Roles("admin", "hr")
  async createTaxProfile(@Body() body: CreateTaxProfileDto) {
    return this.wrap(await this.appService.createTaxProfile(body));
  }

  @Patch("tax-profiles/:id")
  @Roles("admin", "hr")
  async updateTaxProfile(@Param("id") id: string, @Body() body: UpdateTaxProfileDto) {
    return this.wrap(await this.appService.updateTaxProfile(id, body));
  }

  @Delete("tax-profiles/:id")
  @Roles("admin", "hr")
  async deleteTaxProfile(@Param("id") id: string) {
    return this.wrap(await this.appService.deleteTaxProfile(id));
  }

  @Get("attendance/history")
  @Roles("admin", "hr", "manager", "employee")
  async attendanceHistory(@Query() query: AttendanceHistoryQueryDto, @Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
    return this.wrap(await this.appService.getAttendanceHistory(query));
  }

  @Get("attendance/today")
  @Roles("admin", "hr", "manager", "employee")
  async attendanceToday(@Res({ passthrough: true }) res: Response) {
    this.setShortCache(res, 15);
    return this.wrap(await this.appService.getAttendanceToday());
  }

  @Get("attendance/overview")
  @Roles("admin", "hr", "manager", "employee")
  async attendanceOverview(@Res({ passthrough: true }) res: Response) {
    this.setShortCache(res, 20);
    return this.wrap(await this.appService.getAttendanceOverview());
  }

  @Get("attendance/overtime")
  @Roles("admin", "hr", "manager", "employee")
  async attendanceOvertime() {
    return this.wrap(await this.appService.getOvertimeRequests());
  }

  @Post("attendance/check-in")
  @Roles("admin", "hr", "manager", "employee")
  @UseInterceptors(
    FileInterceptor("photo", {
      limits: { fileSize: FIVE_MB },
      fileFilter: rejectInvalidFile(imageOnlyMimes),
      storage: diskStorage({
        destination: path.resolve(process.cwd(), "storage", "attendance-selfies"),
        filename: (_, file, callback) => {
          const extension = path.extname(file.originalname) || ".jpg";
          callback(null, `${Date.now()}-${randomUUID().slice(0, 6)}${extension}`);
        }
      })
    })
  )
  async checkIn(@Body() body: CheckInDto, @UploadedFile() file?: Express.Multer.File) {
    const photoUrl = file ? `/storage/attendance-selfies/${file.filename}` : null;
    return this.wrap(await this.appService.checkIn(body, photoUrl));
  }

  @Get("assets/attendance/:attendanceId/selfie")
  @Roles("admin", "hr", "manager", "employee")
  async attendanceSelfieAsset(@Param("attendanceId") attendanceId: string, @Req() request: Request, @Res() res: Response) {
    const actor = await this.resolveActorFromRequest(request);
    const asset = await this.appService.getAttendanceSelfieAsset(attendanceId, actor);
    return res.sendFile(asset.absolutePath);
  }

  @Post("attendance/check-out")
  @Roles("admin", "hr", "manager", "employee")
  async checkOut(@Body() body: CheckOutDto) {
    return this.wrap(await this.appService.checkOut(body));
  }

  @Post("attendance/overtime")
  @Roles("admin", "hr", "manager", "employee")
  async createOvertime(@Body() body: CreateOvertimeDto) {
    return this.wrap(await this.appService.createOvertimeRequest(body));
  }

  @Post("attendance/overtime/approve")
  @Roles("admin", "hr", "manager")
  @UseInterceptors(IdempotencyInterceptor)
  async approveOvertime(@Body() body: OvertimeApproveDto, @Req() request: Request) {
    const actor = (request as Request & { user?: AuthenticatedActor }).user;
    const payload = { ...body, actor: actor?.name ?? body.actor };
    return this.wrap(await this.appService.approveOvertimeRequest(payload, actor));
  }

  @Get("leave/history")
  @Roles("admin", "hr", "manager", "employee")
  async leaveHistory(@Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
    return this.wrap(await this.appService.getLeaveHistory());
  }

  @Post("leave/request")
  @Roles("admin", "hr", "manager", "employee")
  @UseInterceptors(
    FileInterceptor("supportingDocument", {
      limits: { fileSize: TEN_MB },
      fileFilter: rejectInvalidFile(leaveSupportingDocumentMimes),
      storage: diskStorage({
        destination: path.resolve(process.cwd(), "storage", "leave", "supporting-documents"),
        filename: (_, file, callback) => {
          const extension = path.extname(file.originalname) || ".bin";
          callback(null, `${Date.now()}-${randomUUID().slice(0, 6)}${extension}`);
        }
      })
    })
  )
  async requestLeave(@Body() body: LeaveRequestDto, @UploadedFile() file?: Express.Multer.File) {
    const supportingDocumentUrl = file ? `/storage/leave/supporting-documents/${file.filename}` : null;
    return this.wrap(await this.appService.requestLeave(body, file, supportingDocumentUrl));
  }

  @Post("leave/approve")
  @Roles("admin", "hr", "manager")
  @UseInterceptors(IdempotencyInterceptor)
  async approveLeave(@Body() body: LeaveApproveDto, @Req() request: Request) {
    const actor = (request as Request & { user?: AuthenticatedActor }).user;
    const payload = { ...body, actor: actor?.name ?? body.actor };
    return this.wrap(await this.appService.approveLeave(payload, actor));
  }

  @Get("reimbursement/claims")
  @Roles("admin", "hr", "manager", "employee")
  async reimbursementClaimTypes() {
    return this.wrap(await this.appService.getReimbursementClaimTypes());
  }

  @Post("reimbursement/claims")
  @Roles("admin", "hr")
  async createReimbursementClaimType(@Body() body: CreateReimbursementClaimTypeDto) {
    return this.wrap(await this.appService.createReimbursementClaimType(body));
  }

  @Patch("reimbursement/claims/:id")
  @Roles("admin", "hr")
  async updateReimbursementClaimType(@Param("id") id: string, @Body() body: UpdateReimbursementClaimTypeDto) {
    return this.wrap(await this.appService.updateReimbursementClaimType(id, body));
  }

  @Delete("reimbursement/claims/:id")
  @Roles("admin", "hr")
  async deleteReimbursementClaimType(@Param("id") id: string) {
    return this.wrap(await this.appService.deleteReimbursementClaimType(id));
  }

  @Get("reimbursement/requests")
  @Roles("admin", "hr", "manager", "employee")
  async reimbursementRequests(@Query() query: ReimbursementRequestListQueryDto, @Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
    return this.wrap(await this.appService.getReimbursementRequests(query));
  }

  @Post("reimbursement/requests")
  @Roles("admin", "hr", "manager", "employee")
  @UseInterceptors(
    FileInterceptor("receipt", {
      limits: { fileSize: TEN_MB },
      fileFilter: rejectInvalidFile(documentMimes),
      storage: diskStorage({
        destination: path.resolve(process.cwd(), "storage", "reimbursements", "receipts"),
        filename: (_, file, callback) => {
          const extension = path.extname(file.originalname) || ".bin";
          callback(null, `${Date.now()}-${randomUUID().slice(0, 6)}${extension}`);
        }
      })
    })
  )
  async createReimbursementRequest(@Body() body: CreateReimbursementRequestDto, @UploadedFile() file?: Express.Multer.File) {
    const receiptFileUrl = file ? `/storage/reimbursements/receipts/${file.filename}` : null;
    return this.wrap(await this.appService.createReimbursementRequest(body, file, receiptFileUrl));
  }

  @Patch("reimbursement/requests/:id")
  @Roles("admin", "hr", "manager", "employee")
  @UseInterceptors(
    FileInterceptor("receipt", {
      limits: { fileSize: TEN_MB },
      fileFilter: rejectInvalidFile(documentMimes),
      storage: diskStorage({
        destination: path.resolve(process.cwd(), "storage", "reimbursements", "receipts"),
        filename: (_, file, callback) => {
          const extension = path.extname(file.originalname) || ".bin";
          callback(null, `${Date.now()}-${randomUUID().slice(0, 6)}${extension}`);
        }
      })
    })
  )
  async updateReimbursementRequest(
    @Param("id") id: string,
    @Body() body: UpdateReimbursementRequestDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    const receiptFileUrl = file ? `/storage/reimbursements/receipts/${file.filename}` : null;
    return this.wrap(await this.appService.updateReimbursementRequest(id, body, file, receiptFileUrl));
  }

  @Post("reimbursement/requests/manager-approve")
  @Roles("admin", "manager")
  @UseInterceptors(IdempotencyInterceptor)
  async managerApproveReimbursement(@Body() body: ReimbursementApproveDto, @Req() request: Request) {
    const actor = await this.resolveActorFromRequest(request);
    return this.wrap(await this.appService.managerApproveReimbursement(body, actor));
  }

  @Post("reimbursement/requests/hr-process")
  @Roles("admin", "hr")
  @UseInterceptors(IdempotencyInterceptor)
  async hrProcessReimbursement(@Body() body: ReimbursementProcessDto, @Req() request: Request) {
    const actor = await this.resolveActorFromRequest(request);
    return this.wrap(await this.appService.hrProcessReimbursement(body, actor));
  }

  @Get("assets/reimbursements/:reimbursementId/receipt")
  @Roles("admin", "hr", "manager", "employee")
  async reimbursementReceiptAsset(@Param("reimbursementId") reimbursementId: string, @Req() request: Request, @Res() res: Response) {
    const actor = await this.resolveActorFromRequest(request);
    const asset = await this.appService.getReimbursementReceiptAsset(reimbursementId, actor);
    return res.sendFile(asset.absolutePath);
  }

  @Get("assets/leave/:leaveId/supporting-document")
  @Roles("admin", "hr", "manager", "employee")
  async leaveSupportingDocumentAsset(@Param("leaveId") leaveId: string, @Req() request: Request, @Res() res: Response) {
    const actor = await this.resolveActorFromRequest(request);
    const asset = await this.appService.getLeaveSupportingDocumentAsset(leaveId, actor);
    return res.sendFile(asset.absolutePath);
  }

  @Get("payroll/overview")
  @Roles("admin", "hr", "manager", "employee")
  async payrollOverview(@Res({ passthrough: true }) res: Response) {
    this.setShortCache(res, 45);
    return this.wrap(await this.appService.getPayrollOverview());
  }

  @Get("payroll/components")
  @Roles("admin", "hr", "manager")
  async payrollComponents() {
    return this.wrap(await this.appService.getPayrollComponents());
  }

  @Post("payroll/components")
  @Roles("admin", "hr")
  async createPayrollComponent(@Body() body: CreatePayrollComponentDto) {
    return this.wrap(await this.appService.createPayrollComponent(body));
  }

  @Patch("payroll/components/:id")
  @Roles("admin", "hr")
  async updatePayrollComponent(@Param("id") id: string, @Body() body: UpdatePayrollComponentDto) {
    return this.wrap(await this.appService.updatePayrollComponent(id, body));
  }

  @Delete("payroll/components/:id")
  @Roles("admin", "hr")
  async deletePayrollComponent(@Param("id") id: string) {
    return this.wrap(await this.appService.deletePayrollComponent(id));
  }

  @Get("payroll/runs")
  @Roles("admin", "hr", "manager")
  async payRuns(@Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
    return this.wrap(await this.appService.getPayRuns());
  }

  @Post("payroll/runs")
  @Roles("admin", "hr")
  @UseInterceptors(IdempotencyInterceptor)
  async generatePayrollRun(@Body() body: GeneratePayrollRunDto, @Req() request: Request) {
    const actor = await this.resolveActorFromRequest(request);
    return this.wrap(await this.appService.generatePayrollRun(body, actor));
  }

  @Post("payroll/runs/publish")
  @Roles("admin", "hr")
  @UseInterceptors(IdempotencyInterceptor)
  async publishPayrollRun(@Body() body: PublishPayrollRunDto, @Req() request: Request) {
    const actor = await this.resolveActorFromRequest(request);
    return this.wrap(await this.appService.publishPayrollRun(body, actor));
  }

  @Get("payroll/payslips")
  @Roles("admin", "hr", "manager", "employee")
  async payslips(@Query() query: PayslipListQueryDto, @Res({ passthrough: true }) res: Response) {
    this.setNoStore(res);
    return this.wrap(await this.appService.getPayslips(query));
  }

  @Post("payroll/payslips/export")
  @Roles("admin", "hr", "manager", "employee")
  @UseInterceptors(IdempotencyInterceptor)
  async exportPayslip(@Body() body: ExportPayslipDto, @Req() _request: Request) {
    return this.wrap(await this.appService.exportPayslip(body));
  }

  @Get("payroll/payslips/export/status")
  @Roles("admin", "hr", "manager", "employee")
  async exportPayslipStatus(@Query() query: ExportJobStatusQueryDto) {
    return this.wrap(await this.appService.getExportJobStatus(query.jobId));
  }

  @Post("reports/export")
  @Roles("admin", "hr", "manager")
  @UseInterceptors(IdempotencyInterceptor)
  async exportReport(@Body() body: CreateExportDto, @Req() _request: Request) {
    return this.wrap(await this.appService.generateExport(body));
  }

  @Get("reports/export/status")
  @Roles("admin", "hr", "manager")
  async exportReportStatus(@Query() query: ExportJobStatusQueryDto) {
    return this.wrap(await this.appService.getExportJobStatus(query.jobId));
  }

  private wrap(data: unknown) {
    return {
      success: true,
      data,
      error: null
    };
  }
}













