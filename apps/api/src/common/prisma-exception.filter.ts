import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@repo/database';

/**
 * #20: Prisma P2025 = "record not found" → trả 404 thay vì 500.
 * Áp dụng toàn cục trong main.ts.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if (exception.code === 'P2025') {
      return response.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Không tìm thấy dữ liệu',
        path: request?.url,
      });
    }

    this.logger.error(`Prisma ${exception.code}: ${exception.message}`);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Lỗi cơ sở dữ liệu',
      path: request?.url,
    });
  }
}