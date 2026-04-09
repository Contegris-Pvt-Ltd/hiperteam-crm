---
sidebar_position: 4
title: Form Builder
---

# Form Builder

The Form Builder lets administrators organize form fields, reorder tabs, and control field visibility across all add/edit forms in the CRM.

Access it from **Settings → Form Builder** (this is the primary admin landing page).

![Screenshot: Form Builder admin page](../../static/img/screenshots/admin/form-builder-page.png)

## Selecting a Module

Use the module dropdown to switch between:
- **Leads**
- **Contacts**
- **Accounts**
- **Opportunities**

Each module has its own independent field configuration.

## Tab Structure

Fields are organized into tabs. Each module comes with default tabs:

### Leads
| Tab | Fields |
|---|---|
| Basic Info | First Name, Last Name, Email, Phone, Company, Job Title, Website, Account, Contact, Mobile |
| Lead Details | Pipeline, Stage, Priority, Source, Industry, Owner, Team |
| Address | Country, Address Line 1, Address Line 2, City, State, Postal Code |
| Communication | Do Not Contact, Do Not Email, Do Not Call |
| Other | Tags |

### Contacts
| Tab | Fields |
|---|---|
| Basic Info | First Name, Last Name, Email, Phone, Mobile, Job Title, Department, Account |
| Contact Details | Emails, Phones, Fax, Website |
| Address | Street, City, State, Postal Code, Country |
| Social Profiles | LinkedIn, Twitter, Facebook |
| Other | Source, Description, Tags |

### Accounts
| Tab | Fields |
|---|---|
| Basic Info | Name, Classification (B2B/B2C), Industry, Website, Account Type, Company Size, Annual Revenue |
| Contact Details | Email, Phone, Fax, Emails, Phones |
| Addresses | Billing & Shipping addresses |
| Social | LinkedIn, Twitter, Facebook |
| Other | Description, Tags |

### Opportunities
| Tab | Fields |
|---|---|
| Basic Info | Name, Account, Primary Contact, Pipeline, Stage, Priority, Source, Type |
| Deal Details | Amount, Currency, Probability, Close Date, Forecast Category, Next Step, Competitor, Owner, Team |
| Other | Description, Tags |

## Managing Fields

### Reorder Fields
Drag fields up or down within a tab using the grip handle on the left.

### Toggle Visibility
Click the **eye icon** next to any field to hide it from the form. Hidden fields:
- Won't appear on the add/edit form
- Data is still stored if previously entered
- Can be made visible again at any time

![Screenshot: Field visibility toggles](../../static/img/screenshots/admin/form-builder-fields.png)

### Reorder Tabs
Drag entire tabs to change their display order on the form.

### Rename Tabs
Click the **pencil icon** next to a tab name to rename it.

### Hide Tabs
Toggle an entire tab's visibility to hide all its fields at once.

## Custom Fields

Custom fields created in **Custom Fields** settings automatically appear here. You can:
- **Toggle** their visibility
- **Reorder** them within their tab
- **Delete** them (removes the custom field entirely)

:::tip
Use the Form Builder to organize your forms for different workflows. For example, hide advanced fields that sales reps don't need, keeping forms clean and fast.
:::

## Reset to Defaults

Click **Reset** to restore the original tab order, field order, and visibility for the selected module.

:::warning
Resetting will undo all customizations for that module. This cannot be undone.
:::

---

## Engagement Form Builder

The Engagement Form Builder (`Engagement > Forms`) lets you create web forms that capture data and trigger CRM actions.

### Form Types

| Type | Description |
|------|-------------|
| **Standard** | Collect data and execute CRM actions (create leads, contacts, accounts) |
| **Meeting Booking** | Let visitors book meetings directly on your calendar |
| **Landing Page** | Full-page form with SEO metadata and custom branding |

### Creating a Form

1. Navigate to **Engagement > Forms**.
2. Click **New Form** or **New Booking Page**.
3. Enter form name and description.
4. Use the drag-and-drop builder to add fields.

### Field Types

The field palette includes:

| Type | Description |
|------|-------------|
| Text | Single-line text input |
| Email | Email with validation |
| Phone | Phone number input |
| Number | Numeric input |
| Text Area | Multi-line text |
| Dropdown | Select from predefined options |
| Radio | Single choice from options |
| Checkbox | Boolean toggle |
| Date | Date picker |
| File Upload | File attachment |
| Heading | Section heading (non-input) |
| Paragraph | Descriptive text (non-input) |
| Divider | Visual separator (non-input) |

### Submit Actions

Configure what happens when a form is submitted. Actions execute in order, and each action can use data from previous ones (e.g., create a contact first, then create a lead linked to that contact).

#### Create Lead
Maps form fields to CRM lead fields. Automatically:
- Resolves the default pipeline and first stage
- Assigns the default qualification framework (BANT/CHAMP)
- Sets the default priority
- Formats phone numbers to E.164 international format
- Fires the `lead_created` workflow trigger

#### Create Contact
Maps form fields to CRM contact fields. If a previous "Create Account" action ran, the contact is automatically linked to that account.

#### Create Account
Creates a new account with type "prospect" from form data.

#### Webhook
Sends the form submission data to an external URL via HTTP POST.
- Payload includes: `formId`, `formName`, `data`, `submittedAt`
- Response status and body are logged in submission results

#### Send Email to Submitter
Sends a confirmation email to the submitter.
- Uses the email field mapped in the form
- Supports `{{field_name}}` placeholders in subject and body

### Field Mapping

Each CRM action has a field mapping section. Map form fields to CRM fields:

1. Select an action type (e.g., Create Lead).
2. For each CRM field, select the corresponding form field from the dropdown.
3. Fields left as "-- skip --" are not mapped.

**Custom Fields:** Custom fields from the CRM appear in a separate "Custom Fields" section with a `cf_` prefix. They are stored in the lead's `custom_fields` JSONB column.

### reCAPTCHA Protection

Enable Google reCAPTCHA v3 to prevent spam submissions:

1. Go to the **Settings** tab of your form.
2. Toggle **Require CAPTCHA**.
3. Ensure `RECAPTCHA_SECRET_KEY` is configured on the server.

Submissions with a score below 0.5 are rejected.

### Embedding Forms

Forms can be embedded on external websites:

- **iFrame** — embed the form directly in an iframe
- **JavaScript snippet** — load the form dynamically
- **Popup modal** — trigger the form from a button click

Copy the embed code from the form's **Share** tab.

### Submission Tracking

Every submission is recorded with:
- Form data and metadata
- Action results (success/error per action)
- IP address and user agent
- Timestamp

View submissions under the form's **Submissions** tab with filtering by date range and action status.

### Phone Number Formatting

Phone numbers submitted through forms are automatically formatted to E.164 international format:
1. Tries parsing the raw input directly
2. Falls back to the mapped country code field
3. Falls back to the tenant's base country from company settings
4. If all fail, stores the raw input as-is
