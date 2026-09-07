"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInstallmentSchedule = generateInstallmentSchedule;
exports.generatePaymentScheduleFallback = generatePaymentScheduleFallback;
exports.resolveDownPaymentPercent = resolveDownPaymentPercent;
exports.planForVehicle = planForVehicle;
exports.calculateAmortizedMonthlyPayment = calculateAmortizedMonthlyPayment;
exports.buildPlanFromPricingSnapshot = buildPlanFromPricingSnapshot;
const date_utils_1 = require("./date-utils");
const pricing_1 = require("./pricing");
const tenure_1 = require("./tenure");
function splitMonthlyAmountAcrossDays(monthAmount, dim) {
    if (dim <= 0)
        return [];
    const totalMinor = Math.round(monthAmount * 100);
    const regularMinor = Math.round((monthAmount / dim) * 100);
    const amounts = [];
    for (let d = 0; d < dim - 1; d += 1) {
        amounts.push(regularMinor / 100);
    }
    amounts.push((totalMinor - regularMinor * (dim - 1)) / 100);
    return amounts;
}
function generateInstallmentSchedule(args) {
    const { startDate, totalMonths, carValue, downPayment, annualRentalRate, annualRatePercent, paymentInterval, reviewMode = false, } = args;
    const schedule = [];
    const now = (0, date_utils_1.startOfDay)();
    const intervalValue = (paymentInterval ?? 'Monthly').toString().trim().toLowerCase();
    const isDaily = intervalValue === 'daily';
    const hasPricing = carValue !== undefined && downPayment !== undefined && totalMonths > 0;
    const ratePercent = annualRatePercent ??
        (annualRentalRate !== undefined ? annualRentalRate * 100 : undefined);
    let installmentAmounts = [];
    if (hasPricing && ratePercent !== undefined) {
        installmentAmounts = (0, pricing_1.buildInstallmentAmounts)({
            price: carValue,
            downPayment,
            annualRatePercent: ratePercent,
            tenureMonths: totalMonths,
        });
    }
    else if (args.monthlyPayment && totalMonths > 0) {
        const flat = (0, pricing_1.roundMoney)(args.monthlyPayment);
        installmentAmounts = Array.from({ length: totalMonths }, () => flat);
    }
    const statusFor = (dueDate, granularity) => {
        const isPast = granularity === 'day' ? (0, date_utils_1.isBeforeDay)(dueDate, now) : (0, date_utils_1.isBeforeMonth)(dueDate, now);
        const isCurrent = granularity === 'day' ? (0, date_utils_1.isSameDay)(dueDate, now) : (0, date_utils_1.isSameMonth)(dueDate, now);
        if (isPast)
            return reviewMode ? 'due' : 'paid';
        if (isCurrent)
            return 'active';
        return 'upcoming';
    };
    if (isDaily) {
        let currentDate = (0, date_utils_1.startOfDay)(startDate);
        for (let monthIndex = 0; monthIndex < totalMonths; monthIndex++) {
            const monthStart = (0, date_utils_1.startOfMonth)(currentDate);
            const dim = (0, date_utils_1.daysInMonth)(monthStart);
            const monthAmount = installmentAmounts[monthIndex] ?? 0;
            const dailyAmounts = splitMonthlyAmountAcrossDays(monthAmount, dim);
            for (let dayInMonth = 0; dayInMonth < dim; dayInMonth++) {
                const dueDate = (0, date_utils_1.addDays)(monthStart, dayInMonth);
                const paymentAmount = dailyAmounts[dayInMonth] ?? 0;
                const status = statusFor(dueDate, 'day');
                const dueDateFormatted = (0, date_utils_1.formatDateYmd)(dueDate);
                schedule.push({
                    dueDate: dueDateFormatted,
                    amount: (0, pricing_1.roundMoney)(paymentAmount),
                    status,
                    paidDate: status === 'paid' ? dueDateFormatted : undefined,
                    paymentType: 'installment',
                });
            }
            currentDate = (0, date_utils_1.addMonths)(monthStart, 1);
        }
    }
    else {
        const firstDueDate = new Date(startDate);
        for (let i = 0; i < totalMonths; i++) {
            const dueDate = (0, date_utils_1.addMonths)(firstDueDate, i);
            const dueDateFormatted = (0, date_utils_1.formatDateYmd)(dueDate);
            const paymentAmount = installmentAmounts[i] ?? 0;
            const status = statusFor(dueDate, 'month');
            schedule.push({
                dueDate: dueDateFormatted,
                amount: (0, pricing_1.roundMoney)(paymentAmount),
                status,
                paidDate: status === 'paid' ? dueDateFormatted : undefined,
                paymentType: 'installment',
            });
        }
    }
    return schedule;
}
function generatePaymentScheduleFallback(args) {
    const plan = args.installmentPlan;
    if (plan.schedule?.length)
        return plan.schedule;
    const tenureMonths = (0, tenure_1.parseTenureToMonths)(plan.tenure || '12 Months');
    const listPrice = args.vehiclePrice ?? 0;
    const downPayment = Number(plan.downPayment) || 0;
    const ratePercent = plan.annualRentalRate != null
        ? plan.annualRentalRate <= 1
            ? plan.annualRentalRate * 100
            : plan.annualRentalRate
        : 0;
    const startDate = (0, date_utils_1.addMonths)((0, date_utils_1.startOfMonth)(new Date()), 1);
    return generateInstallmentSchedule({
        startDate,
        totalMonths: tenureMonths,
        carValue: listPrice,
        downPayment,
        annualRatePercent: ratePercent,
        paymentInterval: plan.interval,
        reviewMode: true,
    });
}
function resolveDownPaymentPercent(installmentPlan, templateVehiclePrice) {
    if (!installmentPlan)
        return 0;
    if (installmentPlan.paymentStructure?.downPaymentPercent != null) {
        return installmentPlan.paymentStructure.downPaymentPercent;
    }
    const down = Number(installmentPlan.downPayment) || 0;
    if (templateVehiclePrice <= 0)
        return 0;
    return (0, pricing_1.roundMoney)((down / templateVehiclePrice) * 100);
}
function planForVehicle(template, vehiclePrice, downPaymentPercent) {
    if (!template)
        return null;
    const templatePrice = Number(template.totalAmount) ||
        (Number(template.downPayment) || 0) +
            (template.schedule?.reduce((s, r) => s + (Number(r.amount) || 0), 0) ?? 0);
    const templateDown = Number(template.downPayment) || 0;
    const templateLoan = Math.max(templatePrice - templateDown, 0);
    const downPayment = (0, pricing_1.roundMoney)((vehiclePrice * downPaymentPercent) / 100);
    const loanAmount = Math.max(vehiclePrice - downPayment, 0);
    const scale = templateLoan > 0 ? loanAmount / templateLoan : 1;
    const schedule = (template.schedule ?? []).map((row) => ({
        ...row,
        amount: (0, pricing_1.roundMoney)((Number(row.amount) || 0) * scale),
        status: 'upcoming',
        paidDate: undefined,
        paidAmount: undefined,
    }));
    return {
        ...template,
        downPayment,
        monthlyAmount: (0, pricing_1.roundMoney)((template.monthlyAmount || 0) * scale),
        totalAmount: (0, pricing_1.roundMoney)(vehiclePrice + (Number(template.totalAmount) - templatePrice || 0) * scale),
        schedule,
    };
}
function calculateAmortizedMonthlyPayment(principal, annualPercent, months) {
    if (months <= 0 || principal <= 0)
        return 0;
    const r = annualPercent / 100 / 12;
    if (r <= 0)
        return (0, pricing_1.roundMoney)(principal / months);
    const pow = Math.pow(1 + r, months);
    return (0, pricing_1.roundMoney)((principal * r * pow) / (pow - 1));
}
function buildPlanFromPricingSnapshot(args) {
    const snap = args.pricingSnapshot;
    const tenor = Number(snap.tenor ?? snap.tenure ?? 12);
    const listPrice = Number(snap.list_price ?? snap.selling_price ?? args.vehiclePrice ?? 0);
    const downPayment = Number(snap.down_payment ?? 0);
    const rate = Number(snap.rate ?? 0);
    const monthly = Number(snap.monthly ?? 0);
    const startDate = (0, date_utils_1.addMonths)((0, date_utils_1.startOfMonth)(new Date()), 1);
    const schedule = generateInstallmentSchedule({
        startDate,
        totalMonths: tenor,
        carValue: listPrice,
        downPayment,
        annualRatePercent: rate,
        paymentInterval: args.interval ?? 'Monthly',
        reviewMode: true,
    });
    const scheduleTotal = (0, pricing_1.sumInstallmentAmounts)(schedule.map((r) => Number(r.amount)));
    return {
        tenure: args.tenureLabel ?? `${tenor} Months`,
        interval: args.interval ?? 'Monthly',
        monthlyAmount: schedule[0]?.amount ?? monthly,
        totalAmount: (0, pricing_1.roundMoney)(downPayment + scheduleTotal),
        downPayment,
        schedule,
        annualRentalRate: rate / 100,
        calculationMethod: 'amortized_fixed',
    };
}
//# sourceMappingURL=generate-schedule.js.map