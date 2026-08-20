import { Injectable, Logger } from '@nestjs/common';

import type { ApplicationDocument } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { StorageService } from '../../storage/storage.service';

import { ActivityService } from '../../common/activity.service';

import { ZohoAuthService } from './zoho-auth.service';

import { ZohoConfig } from './zoho-config';

import { mapApplicationToZohoLead, type ApplicationForZoho } from './zoho-lead.mapper';

type ZohoLeadResponse = {
  data?: Array<{
    code: string;
    details?: { id?: string };
    message?: string;
    status?: string;
  }>;
};

type ZohoAttachmentListResponse = {
  data?: Array<{ id?: string; File_Name?: string; file_name?: string }>;
};

/** Outcome of an update against a specific Zoho lead id. */
type UpdateOutcome = 'updated' | 'not_found';

@Injectable()
export class ZohoCrmService {
  private readonly logger = new Logger(ZohoCrmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: ZohoAuthService,
    private readonly config: ZohoConfig,
    private readonly activity: ActivityService,
    private readonly storage: StorageService,
  ) {}

  async syncApplicationToZoho(
    applicationId: string,
    actorUserId?: string,
  ): Promise<{ zohoLeadId: string | null; error?: string; documentsUploaded?: number }> {
    if (!this.config.enabled) {
      const configError = this.config.configurationError;
      if (!configError) {
        // Zoho simply isn't set up in this environment.
        return { zohoLeadId: null, error: 'zoho_not_configured' };
      }
      // Z5/Z6: credentials exist but routing is wrong — never fail silently.
      this.logger.error(
        `Zoho sync skipped for ${applicationId}: ${configError}. Set ZOHO_API_DOMAIN explicitly.`,
      );
      await this.recordFailure(applicationId, configError, actorUserId);
      return { zohoLeadId: null, error: 'zoho_misconfigured' };
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        product: true,
        company: { select: { id: true, name: true } },
        offer: true,
        financePartner: true,
        documents: true,
      },
    });

    if (!app) return { zohoLeadId: null, error: 'application_not_found' };

    if (app.financePartner?.crmAdapter !== 'zoho') {
      return { zohoLeadId: null, error: 'partner_not_zoho' };
    }

    try {
      const leadPayload = mapApplicationToZohoLead(
        app as ApplicationForZoho,
        this.config.requestSubmittedTo,
      );

      let leadId: string | null = app.zohoLeadId;

      if (leadId) {
        const outcome = await this.updateLead(leadId, leadPayload);
        if (outcome === 'not_found') {
          // Z4: the lead was deleted or merged in Zoho. Drop the stale id and
          // re-link, instead of 404-ing on every future sync forever.
          this.logger.warn(
            `Zoho lead ${leadId} no longer exists for application ${applicationId}; re-linking.`,
          );
          leadId = null;
        }
      }

      if (!leadId) {
        const existingId = await this.findLeadIdByEmail(app.customerEmail);
        if (existingId) {
          const outcome = await this.updateLead(existingId, leadPayload);
          leadId = outcome === 'not_found' ? await this.createLead(leadPayload) : existingId;
        } else {
          leadId = await this.createLead(leadPayload);
        }
      }

      if (!leadId) throw new Error('zoho_lead_resolution_failed');

      const documentsUploaded = await this.syncDocuments(leadId, app.documents);

      await this.prisma.application.update({
        where: { id: applicationId },
        data: {
          zohoLeadId: leadId,
          zohoSyncedAt: new Date(),
          zohoSyncError: null,
          zohoSyncAttempts: 0,
          zohoNextRetryAt: null,
        },
      });

      await this.activity.log({
        actorUserId,
        entityType: 'application',
        entityId: applicationId,
        action: 'crm_export',
        toValue: leadId,
        metadata: {
          provider: 'zoho',
          partnerCode: app.financePartner?.code,
          documentsUploaded,
        },
      });

      return { zohoLeadId: leadId, documentsUploaded };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'zoho_sync_failed';
      this.logger.error(`Zoho sync failed for ${applicationId}: ${message}`);
      await this.recordFailure(applicationId, message, actorUserId);
      return { zohoLeadId: null, error: message };
    }
  }

  /**
   * Persists a sync failure on the application and in the audit log. Defensive:
   * this runs on error paths (including fire-and-forget syncs), so it must never
   * throw a second error over the first.
   */
  private async recordFailure(
    applicationId: string,
    message: string,
    actorUserId?: string,
  ): Promise<void> {
    try {
      const current = await this.prisma.application.findUnique({
        where: { id: applicationId },
        select: { zohoSyncAttempts: true },
      });
      const attempts = (current?.zohoSyncAttempts ?? 0) + 1;
      const backoffMinutes = Math.min(Math.pow(2, attempts) * 5, 24 * 60);

      await this.prisma.application.update({
        where: { id: applicationId },
        data: {
          zohoSyncError: message.slice(0, 500),
          zohoSyncAttempts: attempts,
          zohoNextRetryAt: new Date(Date.now() + backoffMinutes * 60_000),
        },
      });
    } catch {
      /* application may have been deleted; the log below still records it */
    }
    try {
      await this.activity.log({
        actorUserId,
        entityType: 'application',
        entityId: applicationId,
        action: 'crm_export_failed',
        toValue: message.slice(0, 200),
        metadata: { provider: 'zoho' },
      });
    } catch {
      /* never mask the original failure */
    }
  }

  private async createLead(payload: Record<string, unknown>): Promise<string> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(`${this.config.apiDomain}/crm/v8/Leads`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: [payload] }),
    });

    const body = (await res.json()) as ZohoLeadResponse;
    if (!res.ok) {
      throw new Error(JSON.stringify(body));
    }

    const row = body.data?.[0];
    if (row?.code !== 'SUCCESS' || !row.details?.id) {
      throw new Error(row?.message ?? JSON.stringify(body));
    }

    return row.details.id;
  }

  /**
   * Updates a specific lead. Returns 'not_found' (rather than throwing) when the
   * lead no longer exists, so the caller can re-link instead of failing forever.
   * Only an explicit 404 / RESOURCE_NOT_FOUND counts as missing — other errors
   * still throw, so a bad payload can never be mistaken for a deleted lead.
   */
  private async updateLead(id: string, payload: Record<string, unknown>): Promise<UpdateOutcome> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(`${this.config.apiDomain}/crm/v8/Leads/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: [payload] }),
    });

    if (res.status === 404) return 'not_found';

    const body = (await res.json()) as ZohoLeadResponse;
    if (!res.ok) {
      throw new Error(JSON.stringify(body));
    }

    const row = body.data?.[0];
    if (row?.code === 'RESOURCE_NOT_FOUND') return 'not_found';
    if (row?.code !== 'SUCCESS') {
      throw new Error(row?.message ?? JSON.stringify(body));
    }
    return 'updated';
  }

  /**
   * Z7: uses the search API's dedicated `email` parameter. The previous criteria
   * string interpolated the raw address into `(Email:equals:...)`, which breaks
   * for addresses containing `(`, `)` or `,` — legal characters that would
   * produce a malformed query and, in turn, a duplicate lead.
   */
  private async findLeadIdByEmail(email: string): Promise<string | null> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(
      `${this.config.apiDomain}/crm/v8/Leads/search?email=${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      },
    );

    if (res.status === 204) return null;

    if (!res.ok) {
      // Preserved behaviour: fall through to creating a lead rather than losing
      // it. Logged because it is the one path that can produce a duplicate.
      this.logger.warn(
        `Zoho lead search failed (${res.status}) for ${email}; a duplicate lead may be created.`,
      );
      return null;
    }

    const body = (await res.json()) as { data?: Array<{ id: string }> };
    return body.data?.[0]?.id ?? null;
  }

  private async syncDocuments(leadId: string, documents: ApplicationDocument[]): Promise<number> {
    if (documents.length === 0) return 0;

    const existingNames = await this.listAttachmentNames(leadId);
    let uploaded = 0;

    for (const doc of documents) {
      const originalName = doc.storagePath.split('/').pop() ?? `${doc.category}.pdf`;
      const fileName = `blox-${doc.category}-${originalName}`;
      if (existingNames.has(fileName)) continue;

      try {
        const { buffer, contentType } = await this.storage.readKyc(doc.storagePath);
        await this.uploadAttachment(leadId, fileName, buffer, contentType);
        existingNames.add(fileName);
        uploaded += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'attachment_upload_failed';
        this.logger.warn(`Zoho attachment upload failed (${doc.category}): ${message}`);
      }
    }

    return uploaded;
  }

  private async listAttachmentNames(leadId: string): Promise<Set<string>> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(`${this.config.apiDomain}/crm/v8/Leads/${leadId}/Attachments`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });

    if (res.status === 204) return new Set();
    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`Zoho attachment list failed (${res.status}): ${text.slice(0, 200)}`);
      return new Set();
    }

    const body = (await res.json()) as ZohoAttachmentListResponse;
    const names = (body.data ?? [])
      .map((row) => row.File_Name ?? row.file_name ?? '')
      .filter(Boolean);
    return new Set(names);
  }

  private async uploadAttachment(
    leadId: string,
    fileName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    const token = await this.auth.getAccessToken();
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(buffer)], { type: contentType || 'application/octet-stream' }),
      fileName,
    );

    const res = await fetch(`${this.config.apiDomain}/crm/v8/Leads/${leadId}/Attachments`, {
      method: 'POST',
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      body: form,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`attachment_upload_failed (${res.status}): ${text.slice(0, 300)}`);
    }

    let body: ZohoLeadResponse;
    try {
      body = JSON.parse(text) as ZohoLeadResponse;
    } catch {
      return;
    }

    const row = body.data?.[0];
    if (row && row.code !== 'SUCCESS') {
      throw new Error(row.message ?? text.slice(0, 300));
    }
  }
}
