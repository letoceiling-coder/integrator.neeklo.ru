import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

/**
 * Validates & narrows request data against a Zod schema. Contracts are shared with the frontend,
 * so the same schema guards both sides of the wire.
 */
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'validation_error',
        message: 'Request validation failed',
        details: result.error.flatten(),
      });
    }
    return result.data;
  }
}
