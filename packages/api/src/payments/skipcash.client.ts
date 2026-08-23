import { createHmac, randomUUID } from 'node:crypto';

export type SkipCashCreateInput = {
  amount: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  transactionId: string;
  custom1?: string;
  subject?: string;
  description?: string;
  returnUrl?: string;
  webhookUrl?: string;
  onlyDebitCard?: boolean;
};

export type SkipCashCreateResult = {
  id: string;
  payUrl: string;
  status?: string | number;
  statusId?: number;
};

export type SkipCashPaymentStatus = {
  id: string;
  status?: string | number;
  statusId?: number;
  custom1?: string;
};

export class SkipCashClient {
  constructor(
    private readonly config: {
      secretKey: string;
      keyId: string;
      clientId: string;
      apiUrl: string;
    },
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv): SkipCashClient | null {
    const secretKey = env.SKIPCASH_SECRET_KEY?.trim() ?? '';
    const keyId = env.SKIPCASH_KEY_ID?.trim() ?? '';
    const clientId = env.SKIPCASH_CLIENT_ID?.trim() ?? '';
    if (!secretKey || !keyId || !clientId) return null;

    const useSandbox = env.SKIPCASH_USE_SANDBOX === 'true' || env.SKIPCASH_SANDBOX === 'true';
    const apiUrl = (
      useSandbox
        ? env.SKIPCASH_SANDBOX_URL?.trim() || 'https://skipcashtest.azurewebsites.net'
        : env.SKIPCASH_PRODUCTION_URL?.trim() || env.SKIPCASH_API_URL?.trim() || 'https://api.skipcash.app'
    ).replace(/\/$/, '');

    return new SkipCashClient({ secretKey, keyId, clientId, apiUrl });
  }

  private signCreate(parts: string[]): string {
    const combined = parts.join(',');
    return createHmac('sha256', this.config.secretKey).update(combined).digest('base64');
  }

  private signVerify(paymentId: string): string {
    return this.signCreate([`PaymentId=${paymentId}`, `KeyId=${this.config.keyId}`]);
  }

  async createPayment(input: SkipCashCreateInput): Promise<SkipCashCreateResult> {
    const uid = randomUUID();
    const request: Record<string, string | boolean> = {
      Uid: uid,
      KeyId: this.config.keyId,
      Amount: input.amount.toFixed(2),
      FirstName: input.firstName,
      LastName: input.lastName,
      Phone: input.phone,
      Email: input.email,
      Street: '',
      City: '',
      State: '',
      Country: '',
      PostalCode: '',
      TransactionId: input.transactionId,
      Custom1: input.custom1 ?? '',
    };
    if (input.subject) request.Subject = input.subject;
    if (input.description) request.Description = input.description;
    if (input.returnUrl) request.ReturnUrl = input.returnUrl;
    if (input.webhookUrl) request.WebhookUrl = input.webhookUrl;
    if (input.onlyDebitCard !== undefined) request.OnlyDebitCard = input.onlyDebitCard;

    const signatureParts = [
      `Uid=${request.Uid}`,
      `KeyId=${request.KeyId}`,
      `Amount=${request.Amount}`,
      `FirstName=${request.FirstName}`,
      `LastName=${request.LastName}`,
      `Phone=${request.Phone}`,
      `Email=${request.Email}`,
    ];
    if (input.transactionId.trim()) {
      signatureParts.push(`TransactionId=${input.transactionId}`);
    }
    if (input.custom1?.trim()) {
      signatureParts.push(`Custom1=${input.custom1}`);
    }

    const res = await fetch(`${this.config.apiUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        Authorization: this.signCreate(signatureParts),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const json = (await res.json()) as {
      resultObj?: { id?: string; payUrl?: string; paymentUrl?: string; status?: string | number; statusId?: number };
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(json.message || json.error || `SkipCash create failed (${res.status})`);
    }

    const result = json.resultObj ?? {};
    const id = result.id ?? '';
    const payUrl = result.payUrl || result.paymentUrl || '';
    if (!id || !payUrl) {
      throw new Error('SkipCash create returned incomplete response');
    }
    return { id, payUrl, status: result.status, statusId: result.statusId };
  }

  async getPayment(paymentId: string): Promise<SkipCashPaymentStatus> {
    const res = await fetch(`${this.config.apiUrl}/api/v1/payments/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
      headers: {
        Authorization: this.signVerify(paymentId),
        'Content-Type': 'application/json',
      },
    });

    const json = (await res.json()) as {
      resultObj?: SkipCashPaymentStatus;
      status?: string | number;
      statusId?: number;
      custom1?: string;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(json.message || json.error || `SkipCash verify failed (${res.status})`);
    }

    const result = (json.resultObj ?? json) as SkipCashPaymentStatus;
    return {
      id: result.id ?? paymentId,
      status: result.status ?? json.status,
      statusId: result.statusId ?? json.statusId,
      custom1: result.custom1 ?? json.custom1,
    };
  }
}

export function mapSkipCashPaid(status: unknown): boolean {
  if (status === 2) return true;
  const s = String(status ?? '').toLowerCase();
  return s === 'paid' || s === 'success' || s === 'completed' || s === 'captured';
}
