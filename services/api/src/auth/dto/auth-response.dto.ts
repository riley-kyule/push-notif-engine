import type { AuthenticatedUser, AuthTokens } from "../auth.types";

export interface AuthResponseDto {
  user: AuthenticatedUser;
  tokens: AuthTokens;
}
