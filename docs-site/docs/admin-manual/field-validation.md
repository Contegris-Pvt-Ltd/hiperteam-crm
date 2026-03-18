---
sidebar_position: 12
title: "Field Validation"
description: "Configure field validation rules in Intellicon CRM — enforce required fields, format constraints, value ranges, regex patterns, and conditional visibility."
---

# Field Validation

Field validation ensures data quality by enforcing rules on what users can enter. Validation rules run on both the frontend (immediate feedback) and backend (API enforcement), so data integrity is maintained regardless of how records are created.

## Field Validation Overview

Navigate to **Admin > Field Validation** to manage validation rules.

![Screenshot: Field validation page](../../static/img/screenshots/admin/field-validation-page.png)

## Selecting a Module

Use the **Module** dropdown at the top to choose which module's fields you want to configure. Validation rules are defined independently for each module.

Available modules: Contacts, Accounts, Leads, Opportunities, Deals, Tasks, Projects.

## Validation Types

| Type | Applies To | Description |
|------|------------|-------------|
| **Required** | All field types | The field must have a value before saving |
| **Min Length** | Text, Textarea, Rich Text | Minimum number of characters |
| **Max Length** | Text, Textarea, Rich Text | Maximum number of characters |
| **Email Format** | Text, Email | Must match a valid email pattern |
| **Number Range** | Number, Currency | Minimum and/or maximum numeric value |
| **Custom Regex** | Text, Phone, Link | Must match a custom regular expression pattern |

## Creating Validation Rules

1. Select the module.
2. Find the field you want to validate in the field list.
3. Click **Add Rule** next to the field.
4. Configure the rule:
   - **Rule type** — select from the types above
   - **Parameters** — varies by type (e.g., min value, max value, regex pattern)
   - **Error message** — the message displayed when validation fails
5. Click **Save Rule**.

![Screenshot: Add validation rule dialog](../../static/img/screenshots/admin/add-validation-rule.png)

### Example: Required Field

```
Field: Company Name
Rule: Required
Error Message: "Company name is required"
```

### Example: Number Range

```
Field: Deal Amount
Rule: Number Range
Min: 0
Max: 10000000
Error Message: "Deal amount must be between $0 and $10,000,000"
```

### Example: Custom Regex

```
Field: Tax ID
Rule: Custom Regex
Pattern: ^\d{2}-\d{7}$
Error Message: "Tax ID must be in format XX-XXXXXXX"
```

:::tip
You can add **multiple validation rules** to a single field. All rules must pass for the field to be accepted. For example, a field can be both Required and have a Min Length of 3.
:::

## Field Dependency Rules

Field dependencies let you create dynamic forms where certain fields appear or become required based on the value of another field.

### Conditional Visibility

**Scenario:** Show the "Reason for Loss" field only when the Stage is "Closed Lost".

1. Find the "Reason for Loss" field.
2. Click **Add Dependency**.
3. Configure:
   - **Depends on field:** Stage
   - **Condition:** Equals
   - **Value:** "Closed Lost"
   - **Action:** Show field
4. Save.

When the Stage field is not "Closed Lost", the "Reason for Loss" field is hidden from the form entirely.

### Conditional Required

**Scenario:** Make "Discount Justification" required only when "Discount %" is greater than 20.

1. Find the "Discount Justification" field.
2. Click **Add Dependency**.
3. Configure:
   - **Depends on field:** Discount %
   - **Condition:** Greater than
   - **Value:** 20
   - **Action:** Make required
4. Save.

![Screenshot: Field dependency configuration](../../static/img/screenshots/admin/field-dependency.png)

### Available Conditions

| Condition | Description |
|-----------|-------------|
| Equals | Field value matches exactly |
| Not Equals | Field value does not match |
| Greater Than | Numeric value exceeds threshold |
| Less Than | Numeric value below threshold |
| Contains | Text value includes substring |
| Is Empty | Field has no value |
| Is Not Empty | Field has a value |

## Testing Validation Rules

After configuring rules:

1. Open a create or edit form for the module.
2. Try submitting with invalid data.
3. Verify that error messages appear correctly.
4. Test edge cases (empty values, boundary values, special characters).

:::warning
Validation rules apply retroactively to **new saves only**. Existing records that violate newly added rules will not be flagged until someone tries to edit and save them.
:::

## Impact on Create/Edit Forms

- Validation runs **on blur** (when the user leaves a field) and **on submit**.
- Error messages appear directly below the invalid field in red text.
- The save button is disabled until all validation errors are resolved.
- Required fields are marked with a red asterisk (*).

## Best Practices

1. **Write clear error messages** — tell the user what is expected, not just what went wrong. "Enter a valid email (e.g., user@example.com)" is better than "Invalid format".
2. **Be conservative with Required** — every required field is a barrier to data entry. Only require what is truly essential.
3. **Test regex patterns thoroughly** — a too-strict regex will frustrate users. Test with edge cases.
4. **Use dependencies sparingly** — complex dependency chains make forms hard to understand. Limit to 1-2 levels of dependency.
5. **Document your rules** — maintain a reference of what validation exists per module so new admins do not create conflicting rules.

---

Next: [Page Designer](./page-designer.md) — Control the layout of record detail pages.
