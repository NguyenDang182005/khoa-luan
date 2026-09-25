import { Controller, Post, Body, Get, Request, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AuthService, LoginMeta } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { LoginDto } from "./dto/login.dto";

interface FirebaseLoginRequest { idToken: string; rememberMe?: boolean; }

/** Lấy IP + trình duyệt từ request Express */
function metaFrom(req: any): LoginMeta {
  return {
    ip: req.ip ?? req.headers?.["x-forwarded-for"] ?? null,
    userAgent: req.headers?.["user-agent"] ?? null,
  };
}


@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Đăng nhập bằng email/password (HR Admin)" })
  async login(@Request() req: any, @Body() dto: LoginDto) {
    return this.authService.login(dto, metaFrom(req));
  }

  @Post("firebase")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Đăng nhập bằng Firebase (Google / Facebook OAuth)" })
  async loginWithFirebase(@Request() req: any, @Body() dto: FirebaseLoginRequest) {
    return this.authService.loginWithFirebase(dto, metaFrom(req));
  }

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Lấy thông tin profile" })
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Đổi mật khẩu theo SecurityPolicy — thu hồi các phiên khác" })
  async changePassword(
    @Request() req: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(
      req.user.sub,
      body?.currentPassword,
      body?.newPassword,
      req.user.sid,
    );
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Đăng xuất" })
  async logout(@Request() req: any, @Body() body: { refreshToken: string }) {
    return this.authService.logout(req.user.sub, body.refreshToken);
  }
}
