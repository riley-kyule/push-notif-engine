import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import { loadAuthConfig } from "./config/auth.config";
import type { AuthenticatedUser, AuthTokens, JwtPayload } from "./auth.types";

@Injectable()
export class TokenService {
  createTokenPair(user: AuthenticatedUser): AuthTokens {
    const config = loadAuthConfig();
    const refreshId = crypto.randomUUID();

    const accessToken = jwt.sign(
      {
        email: user.email,
        role: user.role,
        type: "access",
      } satisfies Omit<JwtPayload, "sub">,
      config.accessTokenSecret,
      {
        subject: user.id,
        expiresIn: config.accessTokenTtlSeconds,
        jwtid: crypto.randomUUID(),
      },
    );

    const refreshToken = jwt.sign(
      {
        email: user.email,
        role: user.role,
        type: "refresh",
      } satisfies Omit<JwtPayload, "sub">,
      config.refreshTokenSecret,
      {
        subject: user.id,
        expiresIn: config.refreshTokenTtlSeconds,
        jwtid: refreshId,
      },
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: config.accessTokenTtlSeconds,
      refreshTokenExpiresIn: config.refreshTokenTtlSeconds,
    };
  }

  verifyAccessToken(token: string): JwtPayload {
    const config = loadAuthConfig();
    return jwt.verify(token, config.accessTokenSecret) as JwtPayload;
  }

  verifyRefreshToken(token: string): JwtPayload {
    const config = loadAuthConfig();
    return jwt.verify(token, config.refreshTokenSecret) as JwtPayload;
  }
}
