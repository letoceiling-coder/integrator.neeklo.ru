import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConcurrencyError, DomainError, NotFoundError } from '@neeklo/kernel';

/** Maps kernel/domain errors and Nest HTTP exceptions to a consistent problem response. */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof NotFoundError) {
      return void res.status(HttpStatus.NOT_FOUND).json(this.body(exception.code, exception.message, exception.details));
    }
    if (exception instanceof ConcurrencyError) {
      return void res.status(HttpStatus.CONFLICT).json(this.body(exception.code, exception.message, exception.details));
    }
    if (exception instanceof DomainError) {
      return void res.status(HttpStatus.UNPROCESSABLE_ENTITY).json(this.body(exception.code, exception.message, exception.details));
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const payload =
        typeof response === 'object' ? (response as Record<string, unknown>) : { message: response };
      return void res.status(status).json({ code: payload.code ?? 'http_error', ...payload });
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    return void res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(this.body('internal_error', 'An unexpected error occurred'));
  }

  private body(code: string, message: string, details?: Record<string, unknown>) {
    return { code, message, ...(details ? { details } : {}) };
  }
}
