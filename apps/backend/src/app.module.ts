import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { LicenseModule } from './license/license.module';
import { AiModule } from './ai/ai.module';
import { CvModule } from './cv/cv.module';
import { SessionModule } from './session/session.module';
import { PaystackModule } from './paystack/paystack.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    LicenseModule,
    AiModule,
    CvModule,
    SessionModule,
    PaystackModule,
  ],
})
export class AppModule {}
