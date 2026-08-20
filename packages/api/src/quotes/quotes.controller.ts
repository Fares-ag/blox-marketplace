import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { IsEmail, IsNumber, IsString, Min } from 'class-validator';
import { CurrentUser, Public, Roles } from '../auth/guards';
import { PaginationQueryDto } from '../common/pagination.dto';
import { QuotesService } from './quotes.service';

class CreateQuoteDto {
  @IsString() productId!: string;
  @IsEmail() customerEmail!: string;
  @IsNumber() @Min(1) negotiatedPrice!: number;
  @IsString() expiresAt!: string;
}

@Controller()
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Roles(UserRole.dealer_agent)
  @Post('dealer/quotes')
  create(@CurrentUser() user: User, @Body() dto: CreateQuoteDto) {
    return this.quotes.create(user, dto);
  }

  @Roles(UserRole.dealer_agent)
  @Get('dealer/quotes')
  list(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    return this.quotes.listForDealer(user, query);
  }

  @Roles(UserRole.dealer_agent)
  @HttpCode(200)
  @Post('dealer/quotes/:id/revoke')
  revoke(@CurrentUser() user: User, @Param('id') id: string) {
    return this.quotes.revoke(user, id);
  }

  @Public()
  @Get('quotes/:token')
  resolve(@Param('token') token: string, @CurrentUser() user?: User) {
    return this.quotes.resolveByToken(token, user ?? null);
  }
}
