import { randomUUID } from "node:crypto";

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";

interface ExpressLikeRequest {
  method?: string;
  originalUrl?: string;
  url?: string;
}

interface ExpressLikeResponse {
  setHeader?(name: string, value: string): void;
  status(code: number): { json(body: unknown): unknown };
}

interface ErrorWithCode extends Error {
  code?: string;
  cause?: unknown;
}

interface PublicError {
  statusCode: number;
  code: string;
  message: string;
  retryable: boolean;
  details?: string[];
}

const STATUS_CODES: Record<number, { code: string; message: string; retryable: boolean }> = {
  400: { code: "BAD_REQUEST", message: "The request is invalid. Check the submitted values and try again.", retryable: false },
  401: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required or the supplied credentials are invalid.", retryable: false },
  403: { code: "ACCESS_DENIED", message: "Your account does not have permission to perform this action.", retryable: false },
  404: { code: "NOT_FOUND", message: "The requested resource could not be found.", retryable: false },
  405: { code: "METHOD_NOT_ALLOWED", message: "This endpoint does not support the requested HTTP method.", retryable: false },
  409: { code: "CONFLICT", message: "The request conflicts with the resource's current state.", retryable: false },
  413: { code: "PAYLOAD_TOO_LARGE", message: "The submitted payload is larger than this endpoint allows.", retryable: false },
  415: { code: "UNSUPPORTED_MEDIA_TYPE", message: "The submitted content type is not supported by this endpoint.", retryable: false },
  422: { code: "UNPROCESSABLE_ENTITY", message: "The request is valid JSON but contains values that cannot be processed.", retryable: false },
  429: { code: "RATE_LIMITED", message: "Too many requests were received. Wait briefly before retrying.", retryable: true },
  502: { code: "UPSTREAM_ERROR", message: "An external service returned an invalid response. Retry shortly.", retryable: true },
  503: { code: "SERVICE_UNAVAILABLE", message: "A required service is temporarily unavailable. Retry shortly.", retryable: true },
  504: { code: "UPSTREAM_TIMEOUT", message: "A required service did not respond in time. Retry shortly.", retryable: true },
};

// Every controller wraps a successful response as { success: true, data }.
// This filter keeps errors in one stable envelope and adds a machine-readable
// code, retry guidance, validation details, and a support reference. Internal
// exception text and stack traces remain server-only.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ExpressLikeRequest>();
    const response = http.getResponse<ExpressLikeResponse>();
    const errorId = randomUUID();
    const resolved = this.resolveError(exception, errorId);

    if (resolved.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const method = request?.method ?? "UNKNOWN";
      const path = request?.originalUrl ?? request?.url ?? "unknown-path";
      const internal = exception instanceof Error ? exception : new Error("Non-Error exception received");
      this.logger.error(
        `[${errorId}] ${method} ${path} ${resolved.code}: ${internal.message}`,
        internal.stack,
      );
    }

    response.setHeader?.("X-Error-Id", errorId);
    response.status(resolved.statusCode).json({
      success: false,
      error: {
        message: resolved.message,
        statusCode: resolved.statusCode,
        code: resolved.code,
        retryable: resolved.retryable,
        errorId,
        ...(resolved.details ? { details: resolved.details } : {}),
      },
    });
  }

  private resolveError(exception: unknown, errorId: string): PublicError {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const fallback = statusCode === HttpStatus.INTERNAL_SERVER_ERROR
        ? {
            code: "INTERNAL_ERROR",
            message: `The server encountered an unexpected error while processing this request. Retry once; if it fails again, contact support with error reference ${errorId}.`,
            retryable: true,
          }
        : STATUS_CODES[statusCode] ?? {
            code: `HTTP_${statusCode}`,
            message: "The request could not be completed. Review the request and retry if appropriate.",
            retryable: statusCode >= 500,
          };
      const details = this.resolveHttpMessages(exception).filter((message) => !this.isGenericHttpMessage(message));
      return {
        statusCode,
        code: fallback.code,
        message: details.length > 0 ? details.join(" ") : fallback.message,
        retryable: fallback.retryable,
        ...(details.length > 1 ? { details } : {}),
      };
    }

    const error = this.findCodedError(exception);
    const code = error?.code;

    if (code === "23505") {
      return {
        statusCode: HttpStatus.CONFLICT,
        code: "RESOURCE_ALREADY_EXISTS",
        message: "A record with the same unique value already exists. Use a different value or reuse the original request's idempotency key.",
        retryable: false,
      };
    }
    if (code === "23503") {
      return {
        statusCode: HttpStatus.CONFLICT,
        code: "RELATED_RESOURCE_CONFLICT",
        message: "This operation references a missing record or a record that is still in use.",
        retryable: false,
      };
    }
    if (code === "23502" || code === "22P02" || code === "22001") {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: "INVALID_DATA",
        message: "One or more submitted values are missing, malformed, or too long.",
        retryable: false,
      };
    }
    if (code === "42P01" || code === "42703") {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: "DATABASE_SCHEMA_OUTDATED",
        message: `The service database is not up to date. Run the pending migrations, then retry. Error reference: ${errorId}.`,
        retryable: true,
      };
    }
    if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "EPIPE" || code === "ENOTFOUND") {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: "DEPENDENCY_UNAVAILABLE",
        message: `A required database, queue, or external service could not be reached. Check service health and retry. Error reference: ${errorId}.`,
        retryable: true,
      };
    }
    if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT" || (exception instanceof Error && exception.name === "AbortError")) {
      return {
        statusCode: HttpStatus.GATEWAY_TIMEOUT,
        code: "DEPENDENCY_TIMEOUT",
        message: `A required service timed out before the request completed. Retry shortly. Error reference: ${errorId}.`,
        retryable: true,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_ERROR",
      message: `The server encountered an unexpected error while processing this request. Retry once; if it fails again, contact support with error reference ${errorId}.`,
      retryable: true,
    };
  }

  private resolveHttpMessages(exception: HttpException): string[] {
    const body = exception.getResponse();
    if (typeof body === "string" && body.trim()) {
      return [body];
    }
    if (!body || typeof body !== "object" || !("message" in body)) {
      return [];
    }

    const message = (body as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
    }
    return typeof message === "string" && message.trim() ? [message] : [];
  }

  private isGenericHttpMessage(message: string): boolean {
    return [
      "bad request",
      "unauthorized",
      "forbidden resource",
      "not found",
      "conflict",
      "internal server error",
      "something went wrong on our end. please try again.",
    ].includes(message.trim().toLowerCase());
  }

  private findCodedError(exception: unknown): ErrorWithCode | null {
    let current = exception;
    for (let depth = 0; depth < 4; depth += 1) {
      if (!(current instanceof Error)) {
        return null;
      }
      const coded = current as ErrorWithCode;
      if (coded.code) {
        return coded;
      }
      current = coded.cause;
    }
    return null;
  }
}
