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
