---
sidebar_position: 2
title: "Logging In"
description: "Learn how to log in to HiperTeam CRM, manage your session, reset your password, and accept team invitations."
---

# Logging In

HiperTeam CRM uses a secure, multi-tenant authentication system. Each organization has its own isolated workspace, and you need valid credentials to access yours.

## The Login Page

When you navigate to your HiperTeam CRM URL, you will see the login page with the following fields:

1. **Tenant Slug** — a short identifier for your organization (e.g., `acme-corp`)
2. **Email Address** — your registered email
3. **Password** — your account password

![Screenshot: Login page with tenant slug, email, and password fields](../../static/img/screenshots/auth/login-page.png)

Enter all three fields and click **Sign In** to access your workspace.

:::info What is a Tenant Slug?
HiperTeam CRM is multi-tenant, meaning many organizations share the same platform but each has completely isolated data. Your **tenant slug** is a unique short name that identifies your organization — for example, `acme-corp` or `globex`. Your administrator will provide this when setting up your account.
:::

## Multi-Tenant Login

If you belong to multiple organizations on HiperTeam CRM, you can log in to each by changing the tenant slug on the login page. Your email and password may differ between tenants, as each workspace manages its own user accounts independently.

## Forgot Password

If you have forgotten your password:

1. On the login page, click the **Forgot Password?** link below the password field.
2. Enter your **tenant slug** and **email address**.
3. Click **Send Reset Link**.
4. Check your inbox for an email from HiperTeam CRM containing a reset link.
5. Click the link in the email — it will open a password reset page.

:::warning
The reset link expires after a limited time. If it has expired, request a new one by repeating the steps above.
:::

## Reset Password

After clicking the reset link from your email:

1. Enter your **new password** in the password field.
2. Confirm it in the **confirm password** field.
3. Click **Reset Password**.
4. You will be redirected to the login page. Sign in with your new credentials.

:::tip
Choose a strong password with at least 8 characters, including uppercase, lowercase, numbers, and special characters.
:::

## Accepting Team Invitations

When an administrator invites you to join their HiperTeam CRM workspace:

1. You will receive an **invitation email** with a unique link.
2. Click the link to open the invitation acceptance page.
3. Fill in your **name** and set a **password** for your account.
4. Click **Accept Invitation** to complete your registration.
5. You will be redirected to the login page — sign in with your new credentials.

:::note
Your role and permissions are pre-configured by the administrator who invited you. If you need additional access, contact your admin after logging in.
:::

## Session Management

HiperTeam CRM uses JSON Web Tokens (JWT) for authentication. Here is what you should know:

- **Sessions persist** across browser tabs — if you are logged in on one tab, you are logged in on all tabs.
- **Tokens auto-refresh** — the system automatically refreshes your session token in the background, so you do not get logged out during active use.
- **Idle timeout** — if you are inactive for an extended period, your session may expire. You will be redirected to the login page and need to sign in again.

## Logging Out

To log out of HiperTeam CRM:

1. Click your **avatar** or **user icon** in the top-right corner of the header bar.
2. Select **Logout** from the dropdown menu.
3. You will be redirected to the login page.

:::warning
Always log out when using a shared or public computer to protect your account and your organization's data.
:::

![Screenshot: User menu dropdown showing Logout option](../../static/img/screenshots/auth/user-menu-logout.png)
