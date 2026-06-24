import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";

interface ExpressLikeResponse {
  status(code: number): { json(body: unknown): unknown };
}

// Every controller wraps a successful response as { success: true, data }.
// Without this filter, thrown errors fell through to Nest's default shape
// ({ statusCode, message, error }) instead -- callers had to branch on two
// different envelopes depending on whether the request succeeded. This
// normalizes every error response to { success: false, error: { message,
// statusCode } } so the dashboard (and any other client) only has one shape
// to read from.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<ExpressLikeResponse>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.resolveMessage(exception, statusCode);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? exception.message : "Unhandled exception", exception instanceof Error ? exception.stack : undefined);
    }

    response.status(statusCode).json({
      success: false,
      error: { message, statusCode },
    });
  }

  private resolveMessage(exception: unknown, statusCode: number): string {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === "string") {
        return body;
      }

      if (body && typeof body === "object" && "message" in body) {
        const message = (body as { message?: unknown }).message;
        if (Array.isArray(message) && message.length > 0) {
          // class-validator emits one string per failed field -- join them
          // so the user sees every problem at once instead of just the first.
          return message.join(" ");
        }
        if (typeof message === "string" && message.trim().length > 0) {
          return message;
        }
      }
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Don't leak internals (stack traces, DB driver errors) to the client --
      // only 4xx validation/business errors carry a specific message.
      return "Something went wrong on our end. Please try again.";
    }

    return exception instanceof Error && exception.message ? exception.message : "Something went wrong. Please try again.";
  }
}
