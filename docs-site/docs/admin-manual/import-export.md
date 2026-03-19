---
sidebar_position: 32
title: "Import & Export"
description: "Bulk import and export data in HiperTeam CRM — CSV and Excel support, column mapping, duplicate detection, templates, and best practices."
---

# Import & Export

The Import/Export system enables bulk data operations — bringing large datasets into the CRM and extracting data for external analysis. The system supports CSV, XLSX, and XLS formats with intelligent column mapping and duplicate detection.

Navigate to the module you want to import into, then click **Import**, or access **Admin > Batch Jobs** for import management.

![Screenshot: Import wizard overview](../../static/img/screenshots/admin/import-wizard.png)

## Import System Overview

The import process follows these steps:

```
Upload File → Map Columns → Configure Options → Preview → Execute → Review Results
```

Imports run as background jobs (using a job queue), so you can continue working while the import processes.

## Supported Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| **CSV** | `.csv` | Comma-separated values, UTF-8 encoding recommended |
| **Excel (modern)** | `.xlsx` | Excel 2007+ format, preferred |
| **Excel (legacy)** | `.xls` | Excel 97-2003 format, supported but not recommended |

:::tip
Use `.xlsx` format whenever possible. It handles special characters, dates, and large datasets more reliably than CSV.
:::

## Import Wizard Walkthrough

### Step 1: Upload File

1. Navigate to the module (e.g., Leads, Contacts, Accounts).
2. Click the **Import** button.
3. Select or drag-and-drop your file.
4. The system reads the file headers and previews the first few rows.

### Step 2: Column Mapping

The system attempts to auto-map columns based on header names:

| File Column | CRM Field | Status |
|-------------|-----------|--------|
| First Name | First Name | Auto-mapped |
| Last Name | Last Name | Auto-mapped |
| Company | Account Name | Auto-mapped |
| Phone Number | Phone | Auto-mapped |
| Custom Rating | — | Unmapped (manual) |

1. Review auto-mapped columns.
2. For unmapped columns, select the target CRM field from the dropdown.
3. Mark columns to **skip** if they should not be imported.
4. Click **Next**.

![Screenshot: Column mapping interface](../../static/img/screenshots/admin/import-column-mapping.png)

:::warning
Ensure date columns are mapped to date fields and number columns to number fields. Type mismatches will cause import errors for those records.
:::

### Step 3: Configure Options

- **Duplicate Detection**: Choose how to handle potential duplicates:
  - **Skip duplicates** — do not import records that match existing ones
  - **Update duplicates** — overwrite existing records with imported data
  - **Create duplicates** — import all records regardless of matches
- **Duplicate Match Field**: Which field to match on (email, phone, name + company)
- **Default Values**: Set default values for fields not in the import file
- **Owner Assignment**: Assign all imported records to a specific user or distribute round-robin

### Step 4: Preview

Review a preview of the first 10-20 records as they will appear in the CRM:

- Verify field mapping is correct.
- Check for data formatting issues.
- Confirm duplicate detection is working as expected.

### Step 5: Execute

1. Click **Start Import**.
2. The import job is queued and processed in the background.
3. You receive a notification when the import completes.
4. View progress on the [Batch Jobs](./batch-jobs.md) page.

## Saving Import Templates

Save your column mapping configuration as a template for reuse:

1. After completing the column mapping step, click **Save as Template**.
2. Enter a **template name** (e.g., "Salesforce Lead Export", "Marketing CSV Format").
3. The template stores the column-to-field mappings.
4. On future imports, select the template to auto-apply the same mapping.

:::tip
Create templates for each data source you regularly import from. This saves time and reduces mapping errors.
:::

## Duplicate Detection Settings

Configure how the system identifies duplicates:

| Strategy | Match Fields | Use When |
|----------|-------------|----------|
| **Email Match** | Email address | Contacts with reliable emails |
| **Phone Match** | Phone number | Leads with phone numbers |
| **Name + Company** | First name + Last name + Company | When email is unavailable |
| **Custom** | Any combination of fields | Advanced deduplication needs |

:::info
Duplicate detection compares imported records against **existing CRM records** and against **other records in the same import file**. Both checks help prevent duplicates.
:::

## Export Functionality

### Exporting Data

1. Navigate to any module's list view.
2. Apply filters to select the records you want to export.
3. Click the **Export** button.
4. Choose the format:
   - **CSV** — universal compatibility
   - **Excel (.xlsx)** — preserves formatting and data types
5. Select which columns to include.
6. Click **Export**.
7. The file downloads or is available on the [Batch Jobs](./batch-jobs.md) page for large exports.

### Export Scope

Exports respect [record access scoping](./record-access.md). Users can only export records they have permission to view. Admins with "All" scope can export the complete dataset.

:::warning
Exported files may contain sensitive data (emails, phone numbers, financial information). Ensure exports are handled according to your organization's data protection policies.
:::

## Best Practices for Data Imports

1. **Clean your data first** — remove duplicates, fix formatting, and validate emails before importing. Garbage in, garbage out.
2. **Start with a small test** — import 10-20 records first to verify mapping and data quality before importing thousands.
3. **Use templates** — save and reuse mappings for recurring imports.
4. **Back up before bulk updates** — if using "Update duplicates" mode, export existing data first as a backup.
5. **Assign owners** — ensure every imported record has an owner. Unowned records fall outside team scoping and can become invisible.
6. **Review failed records** — download the failed records file from Batch Jobs and fix the issues before re-importing.
7. **Schedule large imports** — import during off-peak hours to minimize impact on system performance.

---

Next: [Batch Jobs](./batch-jobs.md) — Monitor import and export job progress.
