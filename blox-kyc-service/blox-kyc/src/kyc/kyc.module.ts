import { Module } from '@nestjs/common';
import { KycController } from './kyc.controller';
import { KycCaseService } from './kyc-case.service';
import { DecisioningService } from './case-engine/decisioning.service';
import { CheckRegistryService } from './checks/check-registry.service';
import { ConsentService } from './consent/consent.service';
import { KYC_CHECK } from './checks/check.types';
import { QidCheckAdapter } from './checks/adapters/qid.adapter';
import { PassportCheckAdapter } from './checks/adapters/passport.adapter';
import { DocAuthenticityCheckAdapter } from './checks/adapters/doc-authenticity.adapter';
import { IdentityBindingCheckAdapter } from './checks/adapters/identity-binding.adapter';
import { BankStatementCheckAdapter } from './checks/adapters/bank-statement.adapter';
import { AmlScreeningCheckAdapter } from './checks/adapters/aml-screening.adapter';
import { BureauCheckAdapter } from './checks/adapters/bureau.adapter';

@Module({
  controllers: [KycController],
  providers: [
    KycCaseService,
    DecisioningService,
    CheckRegistryService,
    ConsentService,
    QidCheckAdapter,
    PassportCheckAdapter,
    DocAuthenticityCheckAdapter,
    IdentityBindingCheckAdapter,
    BankStatementCheckAdapter,
    AmlScreeningCheckAdapter,
    BureauCheckAdapter,
    {
      provide: KYC_CHECK,
      useFactory: (
        qid: QidCheckAdapter,
        passport: PassportCheckAdapter,
        docAuth: DocAuthenticityCheckAdapter,
        binding: IdentityBindingCheckAdapter,
        bank: BankStatementCheckAdapter,
        aml: AmlScreeningCheckAdapter,
        bureau: BureauCheckAdapter,
      ) => [qid, passport, docAuth, binding, bank, aml, bureau],
      inject: [
        QidCheckAdapter,
        PassportCheckAdapter,
        DocAuthenticityCheckAdapter,
        IdentityBindingCheckAdapter,
        BankStatementCheckAdapter,
        AmlScreeningCheckAdapter,
        BureauCheckAdapter,
      ],
    },
  ],
})
export class KycModule {}
