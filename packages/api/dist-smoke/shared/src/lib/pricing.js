"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundMoney = roundMoney;
exports.toMinor = toMinor;
exports.fromMinor = fromMinor;
exports.computeExactMonthlyPayment = computeExactMonthlyPayment;
exports.buildInstallmentAmounts = buildInstallmentAmounts;
exports.estimateMonthlyPayment = estimateMonthlyPayment;
exports.sumInstallmentAmounts = sumInstallmentAmounts;
exports.financedTotal = financedTotal;
exports.clampDownPaymentPct = clampDownPaymentPct;
exports.buildPricingSnapshot = buildPricingSnapshot;
exports.installmentAmountsFromPricingSnapshot = installmentAmountsFromPricingSnapshot;
exports.paymentInputFromPricingSnapshot = paymentInputFromPricingSnapshot;
exports.buildPrincipalAmounts = buildPrincipalAmounts;
exports.principalAmountsFromPricingSnapshot = principalAmountsFromPricingSnapshot;
exports.principalCollectedFromInstallment = principalCollectedFromInstallment;
const MINOR = 100;
function roundMoney(amount) {
    return Math.round(amount * MINOR) / MINOR;
}
function toMinor(major) {
    return Math.round(major * MINOR);
}
function fromMinor(minor) {
    return minor / MINOR;
}
function computeExactMonthlyPayment(opts) {
    const principal = Math.max(opts.price - opts.downPayment, 0);
    const n = opts.tenureMonths;
    if (n <= 0)
        return 0;
    const r = opts.annualRatePercent / 100 / 12;
    if (r === 0)
        return principal / n;
    const factor = Math.pow(1 + r, n);
    return (principal * r * factor) / (factor - 1);
}
function buildInstallmentAmounts(opts) {
    const n = opts.tenureMonths;
    if (n <= 0)
        return [];
    const exactMonthly = computeExactMonthlyPayment(opts);
    const totalMinor = Math.round(exactMonthly * n * MINOR);
    const regularMinor = Math.round(exactMonthly * MINOR);
    const amounts = [];
    for (let sequence = 1; sequence < n; sequence += 1) {
        amounts.push(fromMinor(regularMinor));
    }
    const priorMinor = regularMinor * (n - 1);
    amounts.push(fromMinor(totalMinor - priorMinor));
    return amounts;
}
function estimateMonthlyPayment(opts) {
    return buildInstallmentAmounts(opts)[0] ?? 0;
}
function sumInstallmentAmounts(amounts) {
    return roundMoney(amounts.reduce((sum, amount) => sum + amount, 0));
}
function financedTotal(opts) {
    return sumInstallmentAmounts(buildInstallmentAmounts(opts));
}
function clampDownPaymentPct(downPct, minDownPaymentPct, maxPct = 80) {
    const min = Number(minDownPaymentPct);
    const safe = Number.isFinite(downPct) ? downPct : min;
    return Math.min(Math.max(safe, min), maxPct);
}
function buildPricingSnapshot(input) {
    const safeDownPct = clampDownPaymentPct(input.downPaymentPct ?? input.minDownPaymentPct, input.minDownPaymentPct);
    const downPayment = roundMoney((input.listPrice * safeDownPct) / 100);
    const paymentInput = {
        price: input.listPrice,
        downPayment,
        annualRatePercent: input.annualRatePercent,
        tenureMonths: input.tenureMonths,
    };
    const amounts = buildInstallmentAmounts(paymentInput);
    return {
        list_price: input.listPrice,
        down_payment: downPayment,
        down_payment_pct: safeDownPct,
        tenor: input.tenureMonths,
        rate: input.annualRatePercent,
        monthly: amounts[0] ?? 0,
        financed_total: sumInstallmentAmounts(amounts),
    };
}
function installmentAmountsFromPricingSnapshot(snapshot) {
    const tenor = Number(snapshot.tenor ?? snapshot.tenure ?? 0);
    return buildInstallmentAmounts({
        price: Number(snapshot.list_price),
        downPayment: Number(snapshot.down_payment),
        annualRatePercent: Number(snapshot.rate),
        tenureMonths: tenor,
    });
}
function paymentInputFromPricingSnapshot(snapshot) {
    return {
        price: Number(snapshot.list_price),
        downPayment: Number(snapshot.down_payment),
        annualRatePercent: Number(snapshot.rate),
        tenureMonths: Number(snapshot.tenor ?? snapshot.tenure ?? 0),
    };
}
function buildPrincipalAmounts(opts) {
    const payments = buildInstallmentAmounts(opts);
    const n = payments.length;
    if (n === 0)
        return [];
    let balanceMinor = toMinor(Math.max(opts.price - opts.downPayment, 0));
    const r = opts.annualRatePercent / 100 / 12;
    const principals = [];
    for (let i = 0; i < n; i += 1) {
        const paymentMinor = toMinor(payments[i]);
        let principalMinor = 0;
        if (balanceMinor > 0) {
            if (r === 0) {
                principalMinor = i === n - 1 ? balanceMinor : Math.min(paymentMinor, balanceMinor);
            }
            else {
                const interestMinor = toMinor(roundMoney(fromMinor(balanceMinor) * r));
                principalMinor = paymentMinor - interestMinor;
                if (i === n - 1 || principalMinor > balanceMinor) {
                    principalMinor = balanceMinor;
                }
                if (principalMinor < 0) {
                    principalMinor = 0;
                }
            }
        }
        principals.push(fromMinor(principalMinor));
        balanceMinor = Math.max(0, balanceMinor - principalMinor);
    }
    return principals;
}
function principalAmountsFromPricingSnapshot(snapshot) {
    return buildPrincipalAmounts(paymentInputFromPricingSnapshot(snapshot));
}
function principalCollectedFromInstallment(paidAmount, scheduleAmount, scheduledPrincipal) {
    if (paidAmount <= 0 || scheduleAmount <= 0 || scheduledPrincipal <= 0) {
        return 0;
    }
    if (paidAmount >= scheduleAmount) {
        return roundMoney(scheduledPrincipal);
    }
    return roundMoney((paidAmount / scheduleAmount) * scheduledPrincipal);
}
//# sourceMappingURL=pricing.js.map