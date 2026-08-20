import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from './jwt-user.interface';

export const GetUser = createParamDecorator(
  (_data, ctx: ExecutionContext): JwtUser => {
    const req = ctx.switchToHttp().getRequest<{ user: JwtUser }>();
    return req.user;
  },
);
