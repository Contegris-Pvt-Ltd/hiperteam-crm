---
sidebar_position: 17
title: Invoices API
---

# Invoices API

## Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/invoices` | List invoices (query: status, page, limit) |
| GET | `/invoices/:id` | Get invoice with line items + payments |
| POST | `/invoices` | Create invoice |
| PUT | `/invoices/:id` | Update invoice |
| DELETE | `/invoices/:id` | Soft delete |
| POST | `/invoices/:id/send` | Mark as sent |
| POST | `/invoices/:id/cancel` | Cancel invoice |
| POST | `/invoices/:id/payments` | Record payment |
| GET | `/invoices/:id/payments` | Payment history |
| GET | `/invoices/:id/pdf` | Download PDF |
| POST | `/invoices/:id/send-email` | Email invoice |
| POST | `/invoices/:id/push-xero` | Push to Xero |

## Invoice Statuses

`draft` → `sent` → `partially_paid` → `paid`

Also: `overdue` (auto-detected), `cancelled`, `void`

## Payment Methods

`bank_transfer`, `credit_card`, `cash`, `cheque`, `paypal`, `stripe`, `other`
