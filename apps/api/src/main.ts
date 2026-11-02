import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // #20: P2025 (Prisma record not found) → 404 thay vì 500
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS — allow Web, Mobile (Expo), and n8n
  app.enableCors({
    origin: [
      process.env.WEB_URL ?? 'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.N8N_URL ?? 'http://localhost:5678',
      'http://localhost:19000', // Expo Go
      'http://localhost:19006', // Expo Web
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // n8n may send extra fields
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('HR System API')
    .setDescription(
      'Hệ thống quản lý nhân sự + Multi-Agent (n8n) - REST API Documentation',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      { type: 'apiKey', name: 'x-api-key', in: 'header' },
      'x-api-key',
    )
    .addTag('Auth', 'Xác thực & phân quyền')
    .addTag('Employees', 'Quản lý nhân viên')
    .addTag('Departments', 'Quản lý phòng ban')
    .addTag('Attendance', 'Chấm công')
    .addTag('Leave', 'Đơn xin nghỉ')
    .addTag('Payroll', 'Bảng lương')
    .addTag('Contracts', 'Hợp đồng lao động')
    .addTag('Salary Config', 'Cấu hình hệ số lương')
    .addTag('Onboarding', 'Quy trình onboarding')
    .addTag('AI Context (n8n)', 'Endpoint dành riêng cho n8n Agent')
    .addTag('Notifications', 'Thông báo real-time (WebSocket)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 HR System API is running on: http://localhost:${port}/api/v1`);
  console.log(`📖 API Documentation: http://localhost:${port}/docs`);
  console.log(`🔌 WebSocket: ws://localhost:${port}/notifications`);
}

bootstrap();
