import { Module } from "@nestjs/common";

import { AUTH_REPOSITORY, PASSWORD_SERVICE, TOKEN_SERVICE } from "./auth.constants";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GoogleIdentityService } from "./google-identity.service";
import { PasswordService } from "./password.service";
import { PostgresAuthRepository } from "./postgres-auth.repository";
import { TokenService } from "./token.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { DatabaseModule } from "../database/database.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_REPOSITORY,
      useClass: PostgresAuthRepository,
    },
    AuthService,
    PasswordService,
    TokenService,
    GoogleIdentityService,
    JwtAuthGuard,
    RolesGuard,
    {
      provide: PASSWORD_SERVICE,
      useExisting: PasswordService,
    },
    {
      provide: TOKEN_SERVICE,
      useExisting: TokenService,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
