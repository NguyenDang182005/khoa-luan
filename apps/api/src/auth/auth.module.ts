import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { RolesGuard } from './guards/roles.guard';
import { requireSecret } from './require-secret';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: requireSecret(configService, 'JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '30d') as unknown as number,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, FirebaseAdminService, RolesGuard],
  exports: [AuthService, JwtModule, RolesGuard, JwtStrategy],
})
export class AuthModule {}

