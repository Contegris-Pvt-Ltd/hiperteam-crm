---
sidebar_position: 1
title: "Authentication API"
description: "Complete endpoint reference for login, registration, token refresh, invitations, and password management"
---

# Authentication API

Base path: `/auth`

All auth endpoints are **public** (no JWT required) unless noted otherwise.

## POST /auth/register

Create a new tenant and admin user.

```bash
POST /auth/register
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "admin@acme.com",
  "password": "SecurePass123!",
  "companyName": "Acme Corporation",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@acme.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin",
    "roleLevel": 100
  },
  "tenant": {
    "id": "tenant-uuid",
    "slug": "acme-corporation",
    "companyName": "Acme Corporation"
  }
}
```

**Errors:**

| Code | Description |
|------|-------------|
| 400 | Invalid input (weak password, missing fields) |
| 409 | Email or company name already exists |

## POST /auth/login

Authenticate and receive JWT tokens.

```bash
POST /auth/login
Content-Type: application/json
```

**Request Body:**

```json
{
  "tenantSlug": "acme-corporation",
  "email": "admin@acme.com",
  "password": "SecurePass123!"
}
```

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@acme.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin",
    "roleLevel": 100,
    "avatar": "/uploads/avatars/uuid.jpg",
    "departmentId": "dept-uuid",
    "teamIds": ["team-uuid-1"]
  }
}
```

**Errors:**

| Code | Description |
|------|-------------|
| 401 | Invalid credentials |
| 404 | Tenant not found |

## GET /auth/me

Get current authenticated user info.

:::note
Requires JWT authentication.
:::

```bash
GET /auth/me
Authorization: Bearer <accessToken>
```

**Response (200):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@acme.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "admin",
  "roleLevel": 100,
  "avatar": "/uploads/avatars/uuid.jpg",
  "departmentId": "dept-uuid",
  "teamIds": ["team-uuid-1"],
  "permissions": { "leads": { "view": true, "create": true, "edit": true, "delete": true } },
  "tenant": {
    "slug": "acme-corporation",
    "companyName": "Acme Corporation"
  }
}
```

## POST /auth/refresh

Exchange a refresh token for new access and refresh tokens.

```bash
POST /auth/refresh
Content-Type: application/json
```

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**

| Code | Description |
|------|-------------|
| 401 | Invalid or expired refresh token |

## GET /auth/invite/validate

Validate an invitation token before accepting.

```bash
GET /auth/invite/validate?token=abc123def456
```

**Response (200):**

```json
{
  "valid": true,
  "email": "newuser@acme.com",
  "tenantName": "Acme Corporation",
  "invitedBy": "John Doe",
  "roleName": "Sales Representative"
}
```

**Errors:**

| Code | Description |
|------|-------------|
| 400 | Token expired or already used |
| 404 | Invalid token |

## POST /auth/invite/accept

Accept an invitation and create a user account.

```bash
POST /auth/invite/accept
Content-Type: application/json
```

**Request Body:**

```json
{
  "token": "abc123def456",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Response (201):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "new-user-uuid",
    "email": "newuser@acme.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "user",
    "roleLevel": 10
  }
}
```

## POST /auth/forgot-password

Request a password reset email.

```bash
POST /auth/forgot-password
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "admin@acme.com",
  "tenantSlug": "acme-corporation"
}
```

**Response (200):**

```json
{
  "message": "If the email exists, a reset link has been sent."
}
```

:::tip Security
This endpoint always returns success regardless of whether the email exists, to prevent email enumeration attacks.
:::

## GET /auth/reset-password/validate

Validate a password reset token.

```bash
GET /auth/reset-password/validate?token=reset-token-123
```

**Response (200):**

```json
{
  "valid": true,
  "email": "admin@acme.com"
}
```

## POST /auth/reset-password

Reset password using a valid token.

```bash
POST /auth/reset-password
Content-Type: application/json
```

**Request Body:**

```json
{
  "token": "reset-token-123",
  "newPassword": "NewSecurePass456!"
}
```

**Response (200):**

```json
{
  "message": "Password reset successfully"
}
```

## POST /auth/change-password

Change password for the authenticated user.

:::note
Requires JWT authentication.
:::

```bash
POST /auth/change-password
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request Body:**

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Response (200):**

```json
{
  "message": "Password changed successfully"
}
```

**Errors:**

| Code | Description |
|------|-------------|
| 400 | New password does not meet requirements |
| 401 | Current password is incorrect |
