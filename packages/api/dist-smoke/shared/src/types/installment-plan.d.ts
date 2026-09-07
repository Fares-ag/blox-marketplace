export type PaymentStatus = 'due' | 'active' | 'paid' | 'unpaid' | 'partially_paid' | 'upcoming' | 'pending' | 'overdue';
export type InstallmentCalculationMethod = 'dynamic_rent' | 'amortized_fixed' | 'balloon_payment';
export type PaymentScheduleRow = {
    id?: string;
    dueDate: string;
    amount: number;
    status: PaymentStatus | string;
    paidDate?: string;
    transactionId?: string;
    paidAmount?: number;
    remainingAmount?: number;
    isDeferred?: boolean;
    isPartiallyDeferred?: boolean;
    originalDueDate?: string;
    originalAmount?: number;
    paymentMethod?: 'bank_account' | 'cheque' | 'cash';
    proofDocument?: {
        name: string;
        url: string;
        uploadedAt: string;
    };
    receiptUrl?: string;
    receiptGeneratedAt?: string;
    paymentType?: 'down_payment' | 'installment' | 'balloon_payment';
    isBalloon?: boolean;
    sequence?: number;
};
export type InstallmentPlan = {
    tenure: string;
    interval: string;
    monthlyAmount: number;
    totalAmount: number;
    downPayment?: number;
    schedule: PaymentScheduleRow[];
    annualRentalRate?: number;
    calculationMethod?: InstallmentCalculationMethod;
    annualInterestRate?: number;
    balloonPayment?: {
        amount?: number;
        percentage?: number;
        dueDate?: string;
    };
    paymentStructure?: {
        downPaymentPercent?: number;
        installmentPercent?: number;
        balloonPercent?: number;
    };
};
