import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser, Public } from '../guards';
import type { User } from '@prisma/client';
import { MobileAuthService } from './mobile-auth.service';

class MobileSignInDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
}

class MobileSignUpDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() qid?: string;
  @IsOptional() @IsIn(['en', 'ar']) preferredLanguage?: 'en' | 'ar';
}

class MobileRefreshDto {
  @IsString() refresh_token!: string;
}

class MobileSignOutDto {
  @IsOptional() @IsString() refresh_token?: string;
}

class PasswordResetRequestDto {
  @IsEmail() email!: string;
}

class PasswordResetConfirmDto {
  @IsString() token!: string;
  @IsString() @MinLength(8) password!: string;
}

class ChangePasswordDto {
  @IsString() @MinLength(8) currentPassword!: string;
  @IsString() @MinLength(8) newPassword!: string;
}

@Controller('auth/mobile')
export class MobileAuthController {
  constructor(private readonly auth: MobileAuthService) {}

  @Public()
  @HttpCode(200)
  @Post('sign-in')
  signIn(@Body() dto: MobileSignInDto) {
    return this.auth.signIn(dto.email, dto.password);
  }

  @Public()
  @Post('sign-up')
  signUp(@Body() dto: MobileSignUpDto) {
    return this.auth.signUp(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: MobileRefreshDto) {
    return this.auth.refresh(dto.refresh_token);
  }

  @HttpCode(200)
  @Post('sign-out')
  signOut(@CurrentUser() user: User, @Body() dto: MobileSignOutDto) {
    return this.auth.signOut(dto.refresh_token, user.id);
  }

  @Public()
  @HttpCode(200)
  @Post('password-reset/request')
  requestReset(@Body() dto: PasswordResetRequestDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Public()
  @HttpCode(200)
  @Post('password-reset/confirm')
  confirmReset(@Body() dto: PasswordResetConfirmDto) {
    return this.auth.confirmPasswordReset(dto.token, dto.password);
  }

  @HttpCode(200)
  @Post('change-password')
  changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
