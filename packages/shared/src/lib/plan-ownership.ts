import { roundMoney } from './pricing';

export type PlanOwnershipResult = {
  customerOwnership: number;
  bloxOwnership: number;
  loanAmount: number;
  principalPerMonth: number;
};

export type BalloonOwnershipParams = {
  vehiclePrice: number;
  downPayment: number;
  installmentPercent: number;
  balloonPercent: number;
  tenureMonths: number;
  paymentIndex: number;
  balloonPaid?: boolean;
};

/** Per-row ownership for standard dynamic-rent / amortized plans. */
export function calculatePlanOwnership(
  vehiclePrice: number,
  downPayment: number,
  tenureMonths: number,
  paymentIndex: number,
): PlanOwnershipResult {
  const loanAmount = vehiclePrice - downPayment;
  const principalPerMonth = tenureMonths > 0 ? loanAmount / tenureMonths : 0;

  const calculatedCustomerOwnership = downPayment + principalPerMonth * (paymentIndex + 1);
  const customerOwnership = Math.min(calculatedCustomerOwnership, vehiclePrice);
  const bloxOwnership = Math.max(vehiclePrice - customerOwnership, 0);

  return {
    customerOwnership: roundMoney(customerOwnership),
    bloxOwnership: roundMoney(bloxOwnership),
    loanAmount: roundMoney(loanAmount),
    principalPerMonth: roundMoney(principalPerMonth),
  };
}

/** Per-row ownership for balloon payment plans. */
export function calculateBalloonPlanOwnership(
  params: BalloonOwnershipParams,
): PlanOwnershipResult {
  const {
    vehiclePrice,
    downPayment,
    installmentPercent,
    balloonPercent,
    tenureMonths,
    paymentIndex,
    balloonPaid = false,
  } = params;

  const totalInstallmentAmount = vehiclePrice * (installmentPercent / 100);
  const principalPerMonth = tenureMonths > 0 ? totalInstallmentAmount / tenureMonths : 0;
  const customerOwnership = downPayment + principalPerMonth * (paymentIndex + 1);
  const maxOwnershipWithoutBalloon = vehiclePrice * ((100 - balloonPercent) / 100);
  const finalCustomerOwnership = balloonPaid
    ? vehiclePrice
    : Math.min(customerOwnership, maxOwnershipWithoutBalloon);

  const bloxOwnership = Math.max(vehiclePrice - finalCustomerOwnership, 0);

  return {
    customerOwnership: roundMoney(finalCustomerOwnership),
    bloxOwnership: roundMoney(bloxOwnership),
    loanAmount: roundMoney(vehiclePrice - downPayment),
    principalPerMonth: roundMoney(principalPerMonth),
  };
}

export function rowOwnershipShares(args: {
  vehiclePrice: number;
  downPayment: number;
  tenureMonths: number;
  paymentIndex: number;
  amount: number;
  calculationMethod?: string;
  paymentStructure?: {
    installmentPercent?: number;
    balloonPercent?: number;
  };
  balloonPaid?: boolean;
}): { customerShare: number; bloxShare: number } {
  const isBalloon = args.calculationMethod === 'balloon_payment';
  const ownership = isBalloon
    ? calculateBalloonPlanOwnership({
        vehiclePrice: args.vehiclePrice,
        downPayment: args.downPayment,
        installmentPercent: args.paymentStructure?.installmentPercent ?? 0,
        balloonPercent: args.paymentStructure?.balloonPercent ?? 0,
        tenureMonths: args.tenureMonths,
        paymentIndex: args.paymentIndex,
        balloonPaid: args.balloonPaid,
      })
    : calculatePlanOwnership(
        args.vehiclePrice,
        args.downPayment,
        args.tenureMonths,
        args.paymentIndex,
      );

  const prevOwnership = isBalloon
    ? calculateBalloonPlanOwnership({
        vehiclePrice: args.vehiclePrice,
        downPayment: args.downPayment,
        installmentPercent: args.paymentStructure?.installmentPercent ?? 0,
        balloonPercent: args.paymentStructure?.balloonPercent ?? 0,
        tenureMonths: args.tenureMonths,
        paymentIndex: Math.max(0, args.paymentIndex - 1),
        balloonPaid: args.balloonPaid,
      })
    : calculatePlanOwnership(
        args.vehiclePrice,
        args.downPayment,
        args.tenureMonths,
        Math.max(0, args.paymentIndex - 1),
      );

  const customerShare = roundMoney(
    ownership.customerOwnership - prevOwnership.customerOwnership,
  );
  const bloxShare = roundMoney(Math.max(args.amount - customerShare, 0));

  return { customerShare, bloxShare };
}
