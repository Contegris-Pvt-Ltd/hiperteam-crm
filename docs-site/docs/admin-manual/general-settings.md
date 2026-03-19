---
sidebar_position: 35
title: "General Settings"
description: "Configure company-wide settings in HiperTeam CRM — company info, timezone, date format, currency, language, session timeout, and industry management."
---

# General Settings

General Settings control organization-wide configurations that affect all users — company identity, locale preferences, security policies, and data classification options.

Navigate to **Admin > General Settings**.

![Screenshot: General settings page](../../static/img/screenshots/admin/general-settings.png)

## Company Settings

### Company Name

The company name appears in:
- The application header
- Email notifications and templates
- Exported documents and reports
- The login page

1. Enter your **Company Name**.
2. Click **Save**.

### Company Logo

Upload your company logo for branding throughout the application.

1. Click **Upload Logo**.
2. Select an image file (PNG, JPG, or SVG; recommended size: 200x50px).
3. Preview the logo in the header.
4. Click **Save**.

:::tip
Use a logo with a transparent background (PNG or SVG) for the best appearance in both light and dark modes.
:::

### Timezone

Set the organization's default timezone. This affects:
- How timestamps are displayed
- When scheduled tasks trigger
- Report date calculations
- Notification delivery timing

1. Select your **timezone** from the dropdown (e.g., "America/New_York", "Europe/London", "Asia/Singapore").
2. Click **Save**.

:::info
Individual users can set their own timezone in personal settings, which overrides the organization default for their display. System operations (cron jobs, scheduled workflows) always use the organization timezone.
:::

## Date and Time Format

Configure how dates and times are displayed throughout the application.

### Date Format Options

| Format | Example |
|--------|---------|
| `MM/DD/YYYY` | 03/18/2026 |
| `DD/MM/YYYY` | 18/03/2026 |
| `YYYY-MM-DD` | 2026-03-18 |
| `DD MMM YYYY` | 18 Mar 2026 |
| `MMM DD, YYYY` | Mar 18, 2026 |

### Time Format Options

| Format | Example |
|--------|---------|
| **12-hour** | 2:30 PM |
| **24-hour** | 14:30 |

1. Select your preferred **date format**.
2. Select your preferred **time format**.
3. Click **Save**.

## Currency Settings

Configure the default currency for monetary fields (deal amounts, budgets, revenue).

1. Select the **default currency** from the dropdown (e.g., USD, EUR, GBP, AUD, SGD).
2. Set the **currency symbol position**: before ($100) or after (100$).
3. Set the **decimal separator**: period (100.00) or comma (100,00).
4. Set the **thousands separator**: comma (1,000) or period (1.000).
5. Click **Save**.

:::warning
Changing the currency setting does **not** convert existing monetary values. It only changes the display symbol. If you switch from USD to EUR, existing amounts remain the same number — they are not recalculated with exchange rates.
:::

## Language Selection

Set the default language for the application interface.

1. Select the **language** from the dropdown.
2. Click **Save**.

Currently supported: English.

:::info
Additional language packs may be available in future releases. The system is built with internationalization support.
:::

## Session Timeout Configuration

Control how long a user session remains active without interaction.

1. Set the **session timeout** duration:
   - 15 minutes (high security)
   - 30 minutes (recommended)
   - 1 hour (standard)
   - 4 hours (low security)
   - 8 hours (convenience)
2. Set the **idle warning** — show a warning dialog N minutes before timeout.
3. Toggle **remember me** — allow users to extend their session with a "Remember Me" checkbox on login.
4. Click **Save**.

:::tip
For organizations handling sensitive data (financial, healthcare), use a shorter timeout (15-30 minutes). For teams that reference the CRM throughout the day, 1-4 hours reduces login friction.
:::

## Industries Management

Industries are classification options used primarily for Account records. Manage the list of available industries.

### Adding an Industry

1. Scroll to the **Industries** section.
2. Click **Add Industry**.
3. Enter the industry name (e.g., "Technology", "Healthcare", "Financial Services", "Manufacturing", "Retail", "Education").
4. Save.

### Editing and Deleting Industries

- Click an industry to **edit** its name.
- Click **Delete** to remove an industry. If accounts use this industry, you will be prompted to select a replacement.

### Default Industry List

A starter list is provided:
- Technology
- Healthcare
- Financial Services
- Manufacturing
- Retail & E-commerce
- Education
- Government
- Professional Services
- Media & Entertainment
- Real Estate

:::tip
Customize the industry list to match your target market. Remove industries you do not sell to and add niche verticals specific to your business.
:::

## Outbound Email Defaults

Configure defaults for all outbound emails sent from the CRM:

- **Default From Address** — the sender address for system emails
- **Default Reply-To** — where replies should go
- **Email Footer** — compliance text added to all outbound emails (e.g., unsubscribe link, company address)
- **Track Opens** — enable/disable email open tracking
- **Track Clicks** — enable/disable link click tracking

See [Email Integration](./email-integration.md) for full email configuration details.

## Best Practices

1. **Set timezone first** — this affects how every timestamp is displayed. Get it right early.
2. **Match date format to your region** — US teams use MM/DD/YYYY; most of the world uses DD/MM/YYYY. Mismatched formats cause confusion.
3. **Document your settings** — keep a record of all general settings for disaster recovery and new admin onboarding.
4. **Review session timeout** — balance security with usability based on your team's work patterns.
5. **Keep industries curated** — a focused industry list improves data quality in account records.

---

Next: [API Keys](./api-keys.md) — Manage API access for third-party integrations.
