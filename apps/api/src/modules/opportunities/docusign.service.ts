// ============================================================
// FILE: apps/api/src/modules/opportunities/docusign.service.ts
//
// DocuSign integration service for e-signing contracts.
// Uses JWT authentication with DocuSign eSignature REST API.
//
// Reads config from public.tenant_integrations (per-tenant).
// ============================================================
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const docusign = require('docusign-esign');

interface DocuSignConfig {
  integrationKey: string;
  userId: string;
  accountId: string;
  privateKey: string;
  basePath: string;
  oauthServer: string;
}

interface EnvelopeRecipient {
  name: string;
  email: string;
  recipientId: string;
  routingOrder: string;
}

@Injectable()
export class DocuSignService {
  private readonly logger = new Logger(DocuSignService.name);

  constructor(private readonly dataSource: DataSource) {}

  // ============================================================
  // GET CONFIG — reads from public.tenant_integrations
  // ============================================================
  async getConfig(tenantId: string): Promise<DocuSignConfig | null> {
    const [row] = await this.dataSource.query(
      `SELECT config FROM public.tenant_integrations
       WHERE tenant_id = $1 AND provider = 'docusign' AND is_enabled = true`,
      [tenantId],
    );
    if (!row) return null;

    const cfg = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;

    return {
      integrationKey: cfg.integrationKey || cfg.integration_key,
      userId: cfg.userId || cfg.user_id,
      accountId: cfg.accountId || cfg.account_id,
      privateKey: cfg.privateKey || cfg.private_key,
      basePath: cfg.basePath || 'https://demo.docusign.net/restapi',
      oauthServer: cfg.oauthServer || 'account-d.docusign.com',
    };
  }

  // ============================================================
  // GET API CLIENT — JWT auth, returns authenticated ApiClient
  // ============================================================
  async getApiClient(config: DocuSignConfig): Promise<any> {
    const apiClient = new docusign.ApiClient();
    apiClient.setBasePath(config.basePath);
    apiClient.setOAuthBasePath(config.oauthServer);

    const scopes = ['signature', 'impersonation'];

    try {
      const result = await apiClient.requestJWTUserToken(
        config.integrationKey,
        config.userId,
        scopes,
        Buffer.from(config.privateKey, 'utf-8'),
        3600,
      );

      apiClient.addDefaultHeader(
        'Authorization',
        `Bearer ${result.body.access_token}`,
      );

      return apiClient;
    } catch (error: any) {
      this.logger.error('DocuSign JWT auth failed', error?.message || error);
      throw new BadRequestException('DocuSign authentication failed. Check tenant integration settings.');
    }
  }

  // ============================================================
  // CREATE ENVELOPE — sends a contract PDF for signing
  // ============================================================
  async createEnvelope(
    config: DocuSignConfig,
    contractTitle: string,
    pdfBase64: string,
    recipients: EnvelopeRecipient[],
  ): Promise<{ envelopeId: string }> {
    const apiClient = await this.getApiClient(config);
    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    const document = new docusign.Document();
    document.documentBase64 = pdfBase64;
    document.name = contractTitle;
    document.fileExtension = 'pdf';
    document.documentId = '1';

    const signers = recipients.map((r) => {
      const signer = new docusign.Signer();
      signer.email = r.email;
      signer.name = r.name;
      signer.recipientId = r.recipientId;
      signer.routingOrder = r.routingOrder;
      return signer;
    });

    const recipientsObj = new docusign.Recipients();
    recipientsObj.signers = signers;

    const envelopeDefinition = new docusign.EnvelopeDefinition();
    envelopeDefinition.emailSubject = `Please sign: ${contractTitle}`;
    envelopeDefinition.documents = [document];
    envelopeDefinition.recipients = recipientsObj;
    envelopeDefinition.status = 'sent';

    try {
      const result = await envelopesApi.createEnvelope(config.accountId, {
        envelopeDefinition,
      });

      this.logger.log(`DocuSign envelope created: ${result.envelopeId}`);
      return { envelopeId: result.envelopeId };
    } catch (error: any) {
      this.logger.error('DocuSign createEnvelope failed', error?.message || error);
      throw new BadRequestException('Failed to create DocuSign envelope');
    }
  }

  // ============================================================
  // GET ENVELOPE STATUS
  // ============================================================
  async getEnvelopeStatus(
    config: DocuSignConfig,
    envelopeId: string,
  ): Promise<{ status: string; recipients: any[] }> {
    const apiClient = await this.getApiClient(config);
    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    try {
      const envelope = await envelopesApi.getEnvelope(config.accountId, envelopeId);
      const recipientResult = await envelopesApi.listRecipients(config.accountId, envelopeId);

      return {
        status: envelope.status,
        recipients: (recipientResult.signers || []).map((s: any) => ({
          email: s.email,
          name: s.name,
          status: s.status,
          signedDateTime: s.signedDateTime,
          routingOrder: s.routingOrder,
        })),
      };
    } catch (error: any) {
      this.logger.error('DocuSign getEnvelopeStatus failed', error?.message || error);
      throw new BadRequestException('Failed to get DocuSign envelope status');
    }
  }

  // ============================================================
  // HANDLE WEBHOOK — DocuSign Connect callback
  // ============================================================
  async handleWebhook(
    schemaName: string,
    payload: any,
  ): Promise<{ processed: boolean }> {
    const envelopeId = payload?.envelopeId || payload?.EnvelopeStatus?.EnvelopeID;
    const status = payload?.status || payload?.EnvelopeStatus?.Status;

    if (!envelopeId) {
      this.logger.warn('DocuSign webhook: no envelopeId in payload');
      return { processed: false };
    }

    this.logger.log(`DocuSign webhook: envelope=${envelopeId}, status=${status}`);

    // Find contract by docusign_envelope_id
    const [contract] = await this.dataSource.query(
      `SELECT id, status FROM "${schemaName}".contracts
       WHERE docusign_envelope_id = $1 AND deleted_at IS NULL`,
      [envelopeId],
    );

    if (!contract) {
      this.logger.warn(`DocuSign webhook: no contract found for envelope ${envelopeId}`);
      return { processed: false };
    }

    // Map DocuSign status to contract status
    const statusMap: Record<string, string> = {
      completed: 'fully_signed',
      declined: 'terminated',
      voided: 'terminated',
    };

    const newStatus = statusMap[status?.toLowerCase()];
    if (!newStatus) {
      this.logger.log(`DocuSign webhook: unhandled status "${status}", skipping`);
      return { processed: false };
    }

    // Update contract status
    await this.dataSource.query(
      `UPDATE "${schemaName}".contracts
       SET status = $2, docusign_status = $3, updated_at = NOW()
       WHERE id = $1`,
      [contract.id, newStatus, status?.toLowerCase()],
    );

    // If completed, mark all signatories as signed
    if (newStatus === 'fully_signed') {
      await this.dataSource.query(
        `UPDATE "${schemaName}".contract_signatories
         SET status = 'signed', signed_at = NOW()
         WHERE contract_id = $1 AND status != 'signed'`,
        [contract.id],
      );
    }

    // If declined/voided, find the decliner from payload and mark them
    if (newStatus === 'terminated' && payload?.EnvelopeStatus?.RecipientStatuses) {
      const declinedRecipient = payload.EnvelopeStatus.RecipientStatuses.find(
        (r: any) => r.Status === 'Declined',
      );
      if (declinedRecipient) {
        await this.dataSource.query(
          `UPDATE "${schemaName}".contract_signatories
           SET status = 'declined'
           WHERE contract_id = $1 AND email = $2`,
          [contract.id, declinedRecipient.Email],
        );
      }
    }

    this.logger.log(`DocuSign webhook: contract ${contract.id} updated to ${newStatus}`);
    return { processed: true };
  }
}
