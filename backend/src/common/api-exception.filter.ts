import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const requestId = response.getHeader("X-Request-Id");

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.extractMessage(exception, status);

    if (status >= 500) {
      const error = exception instanceof Error ? exception : new Error(String(exception));
      console.error(JSON.stringify({
        event: "http.error",
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: status,
        message: error.message,
        stack: error.stack ?? null,
        timestamp: new Date().toISOString()
      }));
    }

    response.status(status).json({
      success: false,
      data: null,
      error: message,
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      method: request.method
    });
  }

  private extractMessage(exception: unknown, status: number) {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === "string" && payload.trim().length > 0) {
        return payload;
      }
      if (Array.isArray((payload as { message?: unknown })?.message)) {
        const messages = ((payload as { message: unknown[] }).message ?? [])
          .map((entry) => String(entry))
          .filter(Boolean);
        if (messages.length > 0) {
          return messages.join("; ");
        }
      }
      if (typeof (payload as { message?: unknown })?.message === "string") {
        const message = String((payload as { message?: unknown }).message ?? "").trim();
        if (message.length > 0) {
          return message;
        }
      }
      return exception.message || "Request failed.";
    }
    if (status >= 500) {
      return "Internal server error.";
    }
    return "Request failed.";
  }
}
