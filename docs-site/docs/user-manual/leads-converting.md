---
sidebar_position: 19
title: "Converting & Disqualifying Leads"
description: "Learn when and how to convert leads into contacts, accounts, and opportunities, or disqualify them with documented reasons."
---

# Converting & Disqualifying Leads

The ultimate goal of lead management is to determine which leads deserve further investment. Qualified leads are **converted** into full CRM records, while unqualified leads are **disqualified** with documented reasons.

## When to Convert a Lead

Convert a lead when:

- The prospect meets your qualification criteria (budget, authority, need, timeline)
- You are ready to move from prospecting to active deal management
- You have enough information to create a meaningful contact, account, and opportunity record

:::info
Conversion is typically done from the "Qualified" stage, but your organization may have different criteria. Follow your team's guidelines on when leads are ready for conversion.
:::

## Conversion Check (Duplicate Detection)

Before creating new records, the conversion process checks for **existing duplicates**:

1. The system searches for contacts with the same email address.
2. It searches for accounts with a matching company name.
3. If matches are found, you are notified and can choose to:
   - **Link to existing records** — associate the lead with the existing contact/account instead of creating duplicates
   - **Create new records anyway** — proceed with creating fresh records (use with caution)

![Screenshot: Conversion duplicate detection dialog showing matched contacts and accounts](../../static/img/screenshots/leads/conversion-duplicates.png)

:::tip
Always review duplicate matches carefully. Linking to existing records keeps your CRM clean and ensures all history is consolidated on one record instead of being split across duplicates.
:::

## Conversion Process

To convert a lead:

1. Open the lead detail page.
2. Click the **Convert** button.
3. The conversion dialog opens with three sections:

### Contact Creation
- First name, last name, email, and phone are pre-filled from the lead
- Review and edit as needed
- Or select an existing contact if a duplicate was detected

### Account Creation
- Company name is pre-filled from the lead
- Add industry, website, and other account details
- Or select an existing account if a duplicate was detected

### Opportunity Creation
- Opportunity name is pre-filled (usually based on the lead name)
- Set the **value/amount**, **expected close date**, and **pipeline stage**
- Select the pipeline for the new opportunity

4. Review all three sections.
5. Click **Convert** to complete the process.

![Screenshot: Lead conversion dialog with Contact, Account, and Opportunity sections](../../static/img/screenshots/leads/conversion-dialog.png)

## What Happens After Conversion

When a lead is successfully converted:

1. A new **Contact** is created (or the existing one is linked).
2. A new **Account** is created (or the existing one is linked).
3. A new **Opportunity** is created and linked to the contact and account.
4. The lead is marked as **Converted** and its stage changes to the final converted state.
5. The lead record becomes **read-only** — no further edits are allowed.
6. All notes, activities, and history from the lead are preserved.
7. You are redirected to the new opportunity detail page.

:::note
The original lead record is retained for historical tracking and reporting. It is not deleted — it simply moves to a "Converted" status.
:::

## Disqualifying Leads

When a lead does not meet your criteria, disqualify it rather than deleting it. Disqualification preserves the record for reporting and prevents the same lead from being re-entered.

To disqualify a lead:

1. Open the lead detail page.
2. Click the **Disqualify** button.
3. A modal dialog appears with:
   - **Reason** dropdown — select the primary disqualification reason
   - **Notes** text area — add additional context about why the lead was disqualified
4. Select a reason and optionally add notes.
5. Click **Disqualify** to confirm.

## Disqualification Reasons

Common disqualification reasons (configured by your administrator):

- **No Budget** — the prospect cannot afford the product/service
- **No Authority** — the contact does not have decision-making power
- **No Need** — the prospect does not have a genuine need
- **Bad Timing** — timing is not right; may revisit later
- **Competitor Chosen** — the prospect chose a competing solution
- **Duplicate** — this lead already exists as another record
- **Invalid/Spam** — fake or irrelevant submission
- **No Response** — unable to reach the prospect after multiple attempts

:::warning
Disqualification is reversible — administrators can reopen disqualified leads if circumstances change. However, treat disqualification as a final decision in your normal workflow.
:::

![Screenshot: Disqualify lead modal with reason dropdown and notes field](../../static/img/screenshots/leads/disqualify-modal.png)
