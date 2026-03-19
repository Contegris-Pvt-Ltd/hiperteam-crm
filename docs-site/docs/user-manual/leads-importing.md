---
sidebar_position: 20
title: "Importing Leads"
description: "Bulk import leads from CSV and Excel files using the step-by-step import wizard with field mapping and duplicate detection."
---

# Importing Leads

HiperTeam CRM supports bulk import of leads from spreadsheet files. The import wizard guides you through uploading, previewing, mapping columns, and executing the import.

## Import Wizard Overview

The import process consists of four steps:

1. **Upload** — select your file
2. **Preview** — review the data and columns
3. **Map Fields** — match your file columns to CRM lead fields
4. **Execute** — run the import

Navigate to **Leads** and click the **Import** button to start the wizard.

![Screenshot: Lead import wizard showing the four-step progress indicator](../../static/img/screenshots/leads/import-wizard-steps.png)

## Supported Formats

The import wizard supports:

| Format | Extension | Max Size |
|---|---|---|
| Comma-Separated Values | `.csv` | 50 MB |
| Excel Workbook | `.xlsx` | 50 MB |
| Legacy Excel | `.xls` | 50 MB |

:::tip
For best results, use CSV or XLSX format with a header row in the first row. Clean your data before importing — remove empty rows, fix formatting issues, and ensure consistent data entry.
:::

## Step 1: Upload File

1. Click **Choose File** or drag and drop your file onto the upload area.
2. The system validates the file format and size.
3. Click **Next** to proceed to the preview step.

:::warning
Files larger than 50 MB will be rejected. If your file is too large, split it into smaller batches.
:::

## Step 2: Preview and Column Mapping

After uploading, the wizard displays a **preview** of your file:

- The first few rows of data are shown in a table
- Each column from your file is listed
- The system attempts to **auto-detect** matching CRM fields based on column headers

Review the preview to verify:
- Data is being parsed correctly
- Columns are recognized
- No obvious data issues

![Screenshot: Import preview showing file data with auto-detected column mappings](../../static/img/screenshots/leads/import-preview.png)

## Step 3: Field Mapping Configuration

In this step, you match each column from your file to a lead field in the CRM:

1. For each file column, select the corresponding **CRM field** from a dropdown.
2. Columns that are not mapped will be skipped (data not imported).
3. Required CRM fields must be mapped to proceed.

**Mapping options:**
- **Auto-mapped** — the system matched columns automatically (verify these are correct)
- **Manual mapping** — select the correct CRM field from the dropdown
- **Skip** — leave the mapping blank to skip this column

:::info
Custom fields appear in the mapping dropdown alongside standard fields. You can map to any field your administrator has configured for the Leads module.
:::

## Step 4: Import Execution

1. Review your mappings one final time.
2. Click **Start Import** to begin.
3. The import is **queued for background processing** — you do not need to keep the page open.
4. A progress indicator shows the status:
   - **Queued** — waiting to start
   - **Processing** — actively importing records
   - **Completed** — all records processed
   - **Completed with Errors** — some records failed

![Screenshot: Import progress indicator showing processing status with record count](../../static/img/screenshots/leads/import-progress.png)

## Tracking Import Progress

After starting an import:

- A notification appears when the import completes.
- Navigate to **Admin > Batch Jobs** to see the full import history with status, record counts, and error details.
- Each import job shows:
  - Total records in file
  - Successfully imported count
  - Failed record count
  - Processing duration

## Handling Errors

If some records fail to import:

1. Open the completed import job in **Batch Jobs**.
2. Click **Download Failed Records** to get a file containing only the rows that failed.
3. Each failed row includes an **error message** explaining why it failed (e.g., missing required field, invalid email format, duplicate detected).
4. Fix the issues in the downloaded file.
5. Re-import the corrected file.

:::tip
Common import errors include: missing required fields, invalid email or phone formats, values that do not match dropdown options, and duplicate email addresses. Clean these up before re-importing.
:::

## Saving Import Templates

If you regularly import leads from the same source with the same column layout:

1. After configuring your field mapping in Step 3, look for the **Save Template** option.
2. Give the template a name (e.g., "HubSpot Export", "Trade Show Leads").
3. Next time you import, select the saved template to auto-apply your field mappings.

This saves time and ensures consistency across repeated imports.

## Duplicate Detection During Import

The import process checks for duplicates based on configurable criteria (typically email address):

- **Duplicate found** — the record is flagged and either skipped or merged based on your settings
- **No duplicate** — the record is created as a new lead

:::note
Duplicate handling behavior is configured by your administrator. The default behavior is typically to skip duplicates, but it can be set to update existing records with new data.
:::
