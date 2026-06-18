import { createParamDecorator, ExecutionContext, InternalServerErrorException } from "@nestjs/common";

import type { AuthenticatedUser } from "../auth.types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new InternalServerErrorException("Authenticated user missing from request");
    }

    return request.user;
  },
);
