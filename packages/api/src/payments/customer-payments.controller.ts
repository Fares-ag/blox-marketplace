import { Controller, Get } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/guards';
import { CustomerPaymentsService } from './customer-payments.service';

@Controller('customer/payments')
export class CustomerPaymentsController {
  constructor(private readonly payments: CustomerPaymentsService) {}

  @Roles(UserRole.customer)
  @Get('hub')
  hub(@CurrentUser() user: User) {
    return this.payments.paymentsHub(user);
  }

  @Roles(UserRole.customer)
  @Get('deferral-status')
  deferralStatus(@CurrentUser() user: User) {
    return this.payments.deferralStatus(user);
  }
}
