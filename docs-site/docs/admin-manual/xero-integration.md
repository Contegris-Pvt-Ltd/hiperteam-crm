---
sidebar_position: 29
title: "Xero Integration"
description: "Set up and manage the Xero accounting integration in Intellicon CRM — OAuth setup, contact matching, invoice sync, and troubleshooting."
---

# Xero Integration

The Xero integration connects Intellicon CRM to your Xero accounting platform, enabling bi-directional sync of contacts, accounts, and invoices. This eliminates double data entry and keeps your sales and accounting data aligned.

Navigate to **Admin > Integrations > Xero**.

![Screenshot: Xero integration setup page](../../static/img/screenshots/admin/xero-integration.png)

## Xero Integration Setup

### OAuth Consent Flow

1. Click **Connect to Xero**.
2. You are redirected to Xero's login page.
3. Sign in with your Xero admin account.
4. Select the **Xero organization** you want to connect.
5. Review the permissions Intellicon CRM is requesting:
   - Read and write Contacts
   - Read and write Invoices
   - Read Chart of Accounts
6. Click **Allow Access**.
7. You are redirected back to Intellicon CRM with a success message.

![Screenshot: Xero OAuth consent screen](../../static/img/screenshots/admin/xero-oauth.png)

:::info
The OAuth token expires periodically. Intellicon CRM automatically refreshes it. If the refresh fails (e.g., Xero credentials changed), you will need to reconnect.
:::

## Contact/Account Matching

When syncing, the system needs to match CRM contacts and accounts to Xero contacts.

### Automatic Matching

The system attempts to match records by:
1. **Email address** — exact match
2. **Company name** — fuzzy match
3. **Phone number** — exact match

### Manual Matching

For records that cannot be auto-matched:
1. Navigate to the **Matching** tab.
2. View the list of unmatched CRM records and Xero contacts.
3. Manually link records by selecting the correct Xero contact for each CRM record.
4. Click **Save Matches**.

![Screenshot: Contact matching interface](../../static/img/screenshots/admin/xero-matching.png)

:::tip
Run manual matching after the initial connection to ensure key accounts are correctly linked before enabling auto-sync.
:::

## Auto-Sync Configuration

Configure what data syncs and how often:

1. Select the **Sync Settings** tab.
2. Configure:
   - **Sync Direction**: CRM to Xero, Xero to CRM, or Both
   - **Sync Frequency**: Every 15 min, hourly, daily, or manual only
   - **Contact Sync**: Enable/disable contact synchronization
   - **Invoice Sync**: Enable/disable invoice synchronization
   - **New Record Behavior**: Auto-create in the target system or queue for review
3. Save.

| Setting | Recommended |
|---------|-------------|
| Direction | Bi-directional |
| Frequency | Hourly |
| Contact Sync | Enabled |
| Invoice Sync | Enabled |
| New Records | Queue for review (initially) |

## Manual Sync Operations

To trigger a sync manually:

1. Click **Sync Now** on the Xero integration page.
2. Select what to sync: Contacts, Invoices, or All.
3. The sync job starts and you can monitor progress in [Batch Jobs](./batch-jobs.md).

:::warning
Manual syncs process all records, not just changes. For large datasets, this can take several minutes. Avoid triggering manual syncs during peak business hours.
:::

## Pushing Invoices to Xero

When invoices are created in Intellicon CRM, they can be pushed to Xero:

1. Ensure invoice sync is enabled in Sync Settings.
2. When an invoice is created or finalized in the CRM, it is queued for Xero sync.
3. The invoice appears in Xero with:
   - Linked Xero contact
   - Line items and amounts
   - Due date and reference number
   - Payment status (synced back from Xero when paid)

## Field Mapping

View and configure how CRM fields map to Xero fields:

1. Select the **Field Mapping** tab.
2. Review the default mappings:

| CRM Field | Xero Field |
|-----------|------------|
| Account Name | Contact Name |
| Email | Email Address |
| Phone | Phone Number |
| Billing Address | Address (POBOX) |
| Tax ID | Tax Number |
| Invoice Amount | Total |
| Invoice Date | Date |
| Due Date | Due Date |

3. Customize mappings for custom fields if needed.
4. Save.

## Troubleshooting Xero Sync

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Token expired" error | OAuth token refresh failed | Reconnect to Xero via OAuth |
| Duplicate contacts in Xero | Auto-matching failed | Review and fix matching manually |
| Invoice amounts differ | Currency conversion | Verify currency settings in both systems |
| Sync stuck at "Processing" | API rate limit reached | Wait 1 hour and retry; Xero limits to 60 calls/minute |
| "Organisation not found" | Connected to wrong Xero org | Disconnect and reconnect, selecting the correct organization |

### Checking Sync Logs

1. Go to the **Sync Log** tab on the Xero integration page.
2. View recent sync operations with status (success/failed), records processed, and error details.
3. Click on a failed record to see the specific Xero API error message.

:::danger
If you disconnect and reconnect Xero, all existing matches are preserved. However, if you connect to a **different** Xero organization, matches will be invalid and need to be rebuilt.
:::

## Best Practices

1. **Start with manual sync** to verify data quality before enabling auto-sync.
2. **Review matches carefully** — incorrect matches cause data corruption in both systems.
3. **Monitor weekly** — check the sync log for recurring errors.
4. **Use staging first** — if Xero offers a demo company, test the integration there before connecting to production.
5. **Keep field mappings current** — update mappings when you add custom fields.

---

Next: [Google Calendar](./google-calendar.md) — Set up two-way calendar synchronization.
