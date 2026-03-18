---
sidebar_position: 35
title: "Managing Invoices"
description: "Create, edit, send, record payments, download PDFs, integrate with Xero, and track overdue invoices."
---

# Managing Invoices

This chapter covers the day-to-day operations for working with invoices — creating them, managing line items, sending to clients, recording payments, and tracking overdue balances.

## Invoice List

Navigate to **Invoices** in the sidebar to view all invoices. The list can be filtered by:

- **Status** — Draft, Sent, Partially Paid, Paid, Overdue, Cancelled, Void
- **Date Range** — filter by invoice date or due date
- **Client/Account** — invoices for a specific organization
- **Search** — find invoices by number or client name

![Screenshot: Invoice list with status filters and search bar](../../static/img/screenshots/invoices/invoice-list-filters.png)

## Creating and Editing Invoices

### Creating
1. Click **+ New Invoice**.
2. Fill in the header fields:
   - **Client/Account** — select the organization
   - **Contact** — select the billing contact
   - **Invoice Date** and **Due Date**
   - **Invoice Number** — auto-generated or enter manually
3. Add line items (see below).
4. Set discount and tax.
5. Add notes and payment terms.
6. Click **Save** as Draft.

### Editing
1. Open the invoice.
2. Click **Edit** (available for Draft invoices).
3. Modify fields and line items.
4. Click **Save**.

:::warning
Once an invoice is **Sent**, editing is restricted. If you need to change a sent invoice, void it and create a new one.
:::

## Line Items Management

Line items detail what the client is being billed for:

1. Click **Add Line Item**.
2. Select a **product** from your catalog (or enter a custom item).
3. Enter **quantity** and **unit price**.
4. Optionally enter a **discount** per line.
5. The line **total** calculates automatically.

You can:
- **Reorder** line items by drag-and-drop
- **Edit** any line item by clicking on it
- **Remove** line items using the delete button
- **Add multiple items** by repeating the process

The invoice **subtotal**, **tax**, **discount**, and **total** update in real time.

![Screenshot: Invoice line items editor with products, quantities, prices, and totals](../../static/img/screenshots/invoices/invoice-line-items.png)

## Sending Invoices via Email

To send an invoice to the client:

1. Open the invoice (must be in Draft or Sent status).
2. Click **Send Invoice** (or the email icon).
3. A compose dialog opens with:
   - **To** — pre-filled with the billing contact's email
   - **Subject** — pre-filled with the invoice number
   - **Body** — a customizable email template
   - **Attachment** — the invoice PDF is auto-attached
4. Review and click **Send**.

The invoice status changes to **Sent** upon successful delivery.

## Recording Payments

When a payment is received:

1. Open the invoice.
2. Click **Record Payment**.
3. Enter:
   - **Payment Amount** — the amount received
   - **Payment Date** — when the payment was made
   - **Payment Method** — bank transfer, credit card, check, etc.
   - **Reference Number** — transaction or check number
4. Click **Save**.

If the payment is less than the total, the status changes to **Partially Paid** with the remaining balance shown. When fully paid, the status changes to **Paid**.

:::tip
Record payments promptly to keep your financial data accurate. This affects dashboard revenue metrics and account balance reports.
:::

## Downloading PDF

To download an invoice as a PDF:

1. Open the invoice.
2. Click **Download PDF** (or the PDF icon).
3. A professionally formatted PDF downloads containing all invoice details, line items, and totals.

The PDF can be shared with clients, printed, or archived.

## Xero Integration

If your organization uses **Xero** for accounting, invoices can be pushed to Xero:

1. Open the invoice.
2. Click **Push to Xero** (available if the integration is configured).
3. The invoice is created in your Xero account with all details.
4. A sync status indicator shows whether the push was successful.

:::info
The Xero integration must be configured by your administrator. Contact your admin if you do not see the Xero option on invoices.
:::

## Overdue Tracking

Invoices that pass their **due date** without being fully paid are automatically marked as **Overdue**:

- Overdue invoices are highlighted in the list view with a red status badge
- Dashboard widgets can show total overdue amount
- Notifications can be configured to alert you when invoices become overdue
- Filter the invoice list by "Overdue" status to see all past-due invoices

![Screenshot: Overdue invoice highlighted in red with past-due indicator](../../static/img/screenshots/invoices/overdue-invoice.png)
