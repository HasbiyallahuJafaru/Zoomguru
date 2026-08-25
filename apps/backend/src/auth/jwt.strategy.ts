import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { touchSession } from './sessions';

interface JwtPayload {
  sub: string;
  email: string;
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    if (!process.env.JWT_SECRET) {
      throw new Error('[JwtStrategy] JWT_SECRET environment variable is required. Set it before starting.');
    }
    const secret = process.env.JWT_SECRET;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<{ userId: string; email: string; sid: string }> {
    // No `sid` means the token predates the session cap. Those are rejected
    // outright, so every user signs in again on deploy and no pre-cap token
    // keeps working. Every token issued from now on carries one.
    if (!payload.sid) {
      throw new UnauthorizedException('session_revoked');
    }

    if (!(await touchSession(payload.sub, payload.sid))) {
      throw new UnauthorizedException('session_revoked');
    }
    return { userId: payload.sub, email: payload.email, sid: payload.sid };
  }
}
