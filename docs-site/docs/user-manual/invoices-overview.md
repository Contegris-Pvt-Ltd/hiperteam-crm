---
sidebar_position: 34
title: "Invoices Overview"
description: "Understand the Invoices module — statuses, creating invoices, fields, and how invoices connect to opportunities."
---

# Invoices Overview

The **Invoices** module handles billing — creating invoices, tracking payments, and managing the financial side of your customer relationships. Invoices can be generated from opportunities or created standalone.

## Invoices Module Overview

Invoices represent **billing documents** sent to clients for products or services rendered. The module supports the full invoice lifecycle from draft through payment and provides integration with external accounting systems.

![Screenshot: Invoices module list showing invoices with status badges and amounts](../../static/img/screenshots/invoices/invoices-list.png)

## Invoice Statuses

| Status | Description |
|---|---|
| **Draft** | Invoice created but not yet sent to the client |
| **Sent** | Invoice has been emailed or delivered to the client |
| **Partially Paid** | Some payment has been received but a balance remains |
| **Paid** | Invoice is fully paid |
| **Overdue** | Payment deadline has passed without full payment |
| **Cancelled** | Invoice has been cancelled (no longer valid) |
| **Void** | Invoice has been voided (nullified after being sent) |

:::info
Invoice status transitions follow a natural flow: Draft → Sent → Partially Paid/Paid. Overdue status is automatically applied when a sent invoice passes its due date without payment.
:::

## Creating Invoices

### From an Opportunity
When managing an opportunity, you can generate an invoice directly:

1. Open the opportunity detail page.
2. Go to the **Invoices** tab.
3. Click **Create Invoice**.
4. The invoice form pre-populates with:
   - Client information from the linked account
   - Line items from the opportunity's products
   - Amount from the opportunity value
5. Review, adjust if needed, and click **Save**.

### Standalone Invoice
1. Navigate to **Invoices** in the sidebar.
2. Click **+ New Invoice**.
3. Fill in the invoice form manually (see fields below).
4. Click **Save**.

## Invoice Fields

| Field | Description |
|---|---|
| **Invoice Number** | Unique identifier (auto-generated or manual) |
| **Invoice Date** | Date the invoice was created |
| **Due Date** | Payment deadline |
| **Client/Account** | The organization being billed |
| **Contact** | The billing contact at the organization |
| **Line Items** | Products/services with quantities, prices, and discounts |
| **Subtotal** | Sum of line items before tax and discount |
| **Discount** | Overall discount (percentage or fixed) |
| **Tax** | Tax amount or rate |
| **Total Amount** | Final amount due |
| **Notes** | Additional notes or payment instructions |
| **Terms** | Payment terms and conditions |
| **Status** | Current invoice status |
| **Linked Opportunity** | The opportunity this invoice was generated from |

:::tip
Always include clear payment terms and instructions on your invoices. This reduces payment delays and support inquiries about how to pay.
:::

For managing invoices in detail, see [Managing Invoices](./invoices-managing.md).
