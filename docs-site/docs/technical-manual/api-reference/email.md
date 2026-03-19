---
sidebar_position: 16
title: Email API
---

# Email API

## Account Management

| Method | Endpoint | Description |
|---|---|---|
| GET | `/email/accounts` | List connected accounts |
| DELETE | `/email/accounts/:id` | Disconnect account |
| POST | `/email/connect/imap` | Connect IMAP/SMTP account |
| POST | `/email/test-imap` | Test IMAP connection |
| GET | `/email/connect/gmail` | Get Gmail OAuth URL |
| GET | `/email/connect/microsoft` | Get Microsoft OAuth URL |
| POST | `/email/accounts/:id/sync` | Trigger manual sync |

## Email Operations

| Method | Endpoint | Description |
|---|---|---|
| GET | `/email` | List emails (query: accountId, direction, isRead, isStarred, search, page, limit) |
| GET | `/email/:id` | Get email with full body |
| GET | `/email/thread/:threadId` | Get thread messages |
| POST | `/email/send` | Send new email |
| POST | `/email/:id/reply` | Reply to email |
| POST | `/email/:id/forward` | Forward email |
| PATCH | `/email/:id/read` | Mark read/unread |
| PATCH | `/email/:id/star` | Toggle star |
| DELETE | `/email/:id` | Delete email |
| POST | `/email/bulk/delete` | Bulk delete |
| POST | `/email/bulk/read` | Bulk mark read/unread |

## Entity Linking

| Method | Endpoint | Description |
|---|---|---|
| POST | `/email/:id/link` | Link email to entity |
| DELETE | `/email/:id/link` | Unlink email from entity |
| GET | `/email/linked/:entityType/:entityId` | Get entity's emails |

## Inbox Rules

| Method | Endpoint | Description |
|---|---|---|
| GET | `/email/rules` | List rules |
| POST | `/email/rules` | Create rule |
| PATCH | `/email/rules/:id` | Update rule |
| DELETE | `/email/rules/:id` | Delete rule |

## Providers

| Provider | Auth | Setup |
|---|---|---|
| Gmail | OAuth 2.0 | One-click connect |
| Microsoft 365 | OAuth 2.0 | One-click connect |
| IMAP/SMTP | Password | Manual host/port config |
