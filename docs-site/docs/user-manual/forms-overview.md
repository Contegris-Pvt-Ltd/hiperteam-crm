---
sidebar_position: 39
title: Forms
---

# Forms

Forms allow you to create custom web forms for lead capture, data collection, and meeting scheduling. Each form gets a unique public URL that can be shared or embedded on your website.

![Screenshot: Forms list page](../../static/img/screenshots/user/forms-list.png)

## Form Types

| Type | Description | Use Case |
|---|---|---|
| **Standard Form** | Collects data and triggers CRM actions | Lead capture, surveys, contact forms |
| **Meeting Booking** | Calendar-integrated booking page | Sales calls, demos, consultations |

## Creating a Form

1. Navigate to **Engagement → Forms**
2. Click **New Form** (or **New Booking Page** for meetings)
3. You'll be taken to the **Form Builder**

## Form Statuses

| Status | Description |
|---|---|
| **Draft** | Work in progress — not publicly accessible |
| **Active** | Live and accepting submissions |
| **Inactive** | Temporarily paused — public link shows unavailable |
| **Archived** | Hidden from list but data retained |

## Managing Forms

From the forms list, you can:
- **Search** forms by name
- **Filter** by status (draft, active, inactive, archived)
- **Duplicate** a form to create a copy
- **Preview** the public form
- **Copy Link** to share the public URL
- **Embed** to get iframe/script/popup code
- **Delete** forms you no longer need

:::tip
Each form shows its **submission count** so you can quickly see which forms are performing well.
:::

## Form Builder

The form builder is a visual drag-and-drop editor with three panels:

![Screenshot: Form builder with drag-and-drop fields, canvas, and properties panel](../../static/img/screenshots/forms/form-builder.png)

### Left Panel — Field Palette

Add fields by clicking or dragging:

| Field Type | Description |
|---|---|
| **Text** | Single-line text input |
| **Email** | Email with format validation |
| **Phone** | Phone number input |
| **Number** | Numeric input |
| **Date** | Date picker |
| **Textarea** | Multi-line text |
| **Select** | Dropdown with options |
| **Radio** | Single-choice radio buttons |
| **Checkbox** | Multi-choice checkboxes |
| **File** | File upload |
| **Heading** | Section heading (non-input) |
| **Paragraph** | Descriptive text (non-input) |
| **Divider** | Visual separator (non-input) |

### Center Panel — Canvas

Preview your form as visitors will see it. Click any field to select it and configure its properties.

### Right Panel — Settings

Five configuration tabs:

#### Fields Tab
Configure the selected field:
- **Label** — Display name
- **Field Name** — Submission key (auto-generated from label)
- **Placeholder** — Hint text inside the field
- **Required** — Make the field mandatory
- **Width** — Full width or half width (side-by-side layout)
- **Options** — For select/radio/checkbox: add, edit, remove choices

#### Actions Tab
Configure what happens after form submission:

| Action | Description |
|---|---|
| **Create Lead** | Creates a new lead in your CRM |
| **Create Contact** | Creates a new contact |
| **Create Account** | Creates a new account |
| **Webhook** | POST form data to an external URL |
| **Send Email** | Send a confirmation email to the submitter |

Each CRM action includes **field mapping** — connect your form fields to CRM fields (first name, email, company, etc.).

:::note
Actions execute in order. Later actions can reference entities created by earlier ones (e.g., link a contact to an account).
:::

#### Settings Tab
- **Success Message** — Shown after successful submission
- **Redirect URL** — Redirect instead of showing success message
- **Allow Multiple Submissions** — Let the same person submit again
- **Require CAPTCHA** — Enable reCAPTCHA v3 protection
- **Notification Emails** — Comma-separated emails to notify on new submissions

**Landing Page Mode:**
- Enable to wrap your form in a full landing page
- **Hero Title & Subtitle** — Main headline
- **Background Color** — Hero section color
- **SEO Title & Description** — For search engines
- **Content Sections** — Add text, images, or call-to-action blocks

#### Branding Tab
- **Logo URL** — Your company logo
- **Primary Color** — Button and accent color
- **Background Color** — Form background
- **Header Text** — Text above the form
- **Footer Text** — Text below the form

#### Meeting Tab (Booking Forms Only)
See [Scheduling & Booking Pages](./scheduling-booking) for details.

## Form Submissions

Click any form to view its submissions.

### Summary View

![Screenshot: Form submission analytics](../../static/img/screenshots/user/form-submissions-summary.png)

- **Stats Cards** — Total responses, last 7 days, last 30 days, action success rate
- **30-Day Trend** — Bar chart showing daily submission volume
- **Per-Field Breakdown:**
  - Choice fields: donut charts with percentages
  - Number fields: average, min, max values
  - Text fields: sample of recent responses

### Responses View

- **Filter** by date range and action status (success/error)
- **Expand** each response to see full form data
- **Action Results** — See if CRM actions succeeded or failed
- **Retry** failed webhook actions
- **Export CSV** — Download all responses

## Sharing & Embedding

### Public Link
Every active form has a public URL:
```
https://yourdomain.com/f/{tenant-slug}/{token}
```

### Embedding Options

**iFrame:**
```html
<iframe src="https://yourdomain.com/f/tenant/token"
        width="100%" height="600" frameborder="0"></iframe>
```

**JavaScript:**
```html
<div id="intellicon-form-{id}"></div>
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = 'https://yourdomain.com/f/tenant/token';
    iframe.style = 'width:100%;height:600px;border:none;';
    document.getElementById('intellicon-form-{id}').appendChild(iframe);
  })();
</script>
```

**Popup Modal:**
A button that opens the form in an overlay modal.

:::warning
Forms must be in **Active** status to accept public submissions. Draft and inactive forms will show an error page.
:::
