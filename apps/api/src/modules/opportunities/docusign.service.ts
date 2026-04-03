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
// eslint-disable-next-line @typescript-eslint/no-require-imports
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

    const cfg =
      typeof row.config === 'string' ? JSON.parse(row.config) : row.config;

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
      throw new BadRequestException(
        'DocuSign authentication failed. Check tenant integration settings.',
      );
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
      this.logger.error(
        'DocuSign createEnvelope failed',
        error?.message || error,
      );
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
      const envelope = await envelopesApi.getEnvelope(
        config.accountId,
        envelopeId,
      );
      const recipientResult = await envelopesApi.listRecipients(
        config.accountId,
        envelopeId,
      );

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
      this.logger.error(
        'DocuSign getEnvelopeStatus failed',
        error?.message || error,
      );
      throw new BadRequestException('Failed to get DocuSign envelope status');
    }
  }

  // ============================================================
  // SEND ENVELOPE FOR CONTRACT — reads uploaded document
  // ============================================================
  async sendEnvelopeForContract(
    schemaName: string,
    contractId: string,
    tenantId: string,
  ): Promise<{ envelopeId: string }> {
    const config = await this.getConfig(tenantId);
    if (!config) {
      throw new BadRequestException('DocuSign is not configured for this tenant');
    }

    // Fetch contract with document
    const [contract] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".contracts WHERE id = $1 AND deleted_at IS NULL`,
      [contractId],
    );
    if (!contract) {
      throw new BadRequestException('Contract not found');
    }
    if (!contract.document_url) {
      throw new BadRequestException('Contract has no uploaded document. Please upload a document before sending via DocuSign.');
    }

    // Fetch the document from URL and convert to base64
    let pdfBase64: string;
    try {
      pdfBase64 = await this.fetchDocumentAsBase64(contract.document_url);
    } catch (error: any) {
      this.logger.error('Failed to fetch contract document for DocuSign', error?.message);
      throw new BadRequestException('Failed to read contract document. Please re-upload the document.');
    }

    // Fetch signatories
    const signatories = await this.dataSource.query(
      `SELECT name, email, sign_order FROM "${schemaName}".contract_signatories
       WHERE contract_id = $1 ORDER BY sign_order ASC`,
      [contractId],
    );

    const recipients: EnvelopeRecipient[] = signatories.map((s: any, idx: number) => ({
      name: s.name,
      email: s.email,
      recipientId: String(idx + 1),
      routingOrder: String(s.sign_order),
    }));

    // Create envelope
    const result = await this.createEnvelope(
      config,
      contract.title,
      pdfBase64,
      recipients,
    );

    // Store envelope_id on contract
    await this.dataSource.query(
      `UPDATE "${schemaName}".contracts
       SET docusign_envelope_id = $1, docusign_status = 'sent', updated_at = NOW()
       WHERE id = $2`,
      [result.envelopeId, contractId],
    );

    return result;
  }

  // ============================================================
  // HANDLE WEBHOOK — DocuSign Connect callback
  // ============================================================
  async handleWebhook(
    schemaName: string,
    payload: any,
  ): Promise<{ processed: boolean }> {
    const envelopeId =
      payload?.envelopeId || payload?.EnvelopeStatus?.EnvelopeID;
    const status = payload?.status || payload?.EnvelopeStatus?.Status;

    if (!envelopeId) {
      this.logger.warn('DocuSign webhook: no envelopeId in payload');
      return { processed: false };
    }

    this.logger.log(
      `DocuSign webhook: envelope=${envelopeId}, status=${status}`,
    );

    // Find contract by docusign_envelope_id
    const [contract] = await this.dataSource.query(
      `SELECT id, status FROM "${schemaName}".contracts
       WHERE docusign_envelope_id = $1 AND deleted_at IS NULL`,
      [envelopeId],
    );

    if (!contract) {
      this.logger.warn(
        `DocuSign webhook: no contract found for envelope ${envelopeId}`,
      );
      return { processed: false };
    }

    // Handle individual recipient status updates
    const recipientStatuses =
      payload?.EnvelopeStatus?.RecipientStatuses ||
      payload?.recipientStatuses ||
      [];

    for (const recipient of recipientStatuses) {
      const recipientEmail = recipient?.Email || recipient?.email;
      const recipientStatus = (recipient?.Status || recipient?.status || '').toLowerCase();
      const declineReason = recipient?.DeclineReason || recipient?.declineReason || null;

      if (!recipientEmail) continue;

      if (recipientStatus === 'completed' || recipientStatus === 'signed') {
        await this.dataSource.query(
          `UPDATE "${schemaName}".contract_signatories
           SET status = 'signed', signed_at = NOW()
           WHERE contract_id = $1 AND LOWER(email) = LOWER($2) AND status != 'signed'`,
          [contract.id, recipientEmail],
        );
      } else if (recipientStatus === 'declined') {
        await this.dataSource.query(
          `UPDATE "${schemaName}".contract_signatories
           SET status = 'declined', decline_reason = $3
           WHERE contract_id = $1 AND LOWER(email) = LOWER($2)`,
          [contract.id, recipientEmail, declineReason],
        );
      }
    }

    // Map DocuSign envelope-level status to contract status
    const statusMap: Record<string, string> = {
      completed: 'fully_signed',
      declined: 'terminated',
      voided: 'terminated',
    };

    const newStatus = statusMap[status?.toLowerCase()];
    if (!newStatus) {
      // For partial updates (e.g. "sent", "delivered"), just update docusign_status
      if (status) {
        await this.dataSource.query(
          `UPDATE "${schemaName}".contracts
           SET docusign_status = $2, updated_at = NOW()
           WHERE id = $1`,
          [contract.id, status.toLowerCase()],
        );
      }
      this.logger.log(
        `DocuSign webhook: status "${status}" noted, no contract status change`,
      );
      return { processed: true };
    }

    // Update contract status
    await this.dataSource.query(
      `UPDATE "${schemaName}".contracts
       SET status = $2, docusign_status = $3, updated_at = NOW()
       WHERE id = $1`,
      [contract.id, newStatus, status?.toLowerCase()],
    );

    // If completed, mark all signatories as signed (fallback)
    if (newStatus === 'fully_signed') {
      await this.dataSource.query(
        `UPDATE "${schemaName}".contract_signatories
         SET status = 'signed', signed_at = COALESCE(signed_at, NOW())
         WHERE contract_id = $1 AND status != 'signed'`,
        [contract.id],
      );
    }

    this.logger.log(
      `DocuSign webhook: contract ${contract.id} updated to ${newStatus}`,
    );
    return { processed: true };
  }

  // ============================================================
  // HELPER — fetch a URL and return base64
  // ============================================================
  private fetchDocumentAsBase64(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? require('https') : require('http');
      protocol.get(url, (res: any) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          return this.fetchDocumentAsBase64(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
        res.on('error', reject);
      }).on('error', reject);
    });
  }
}
