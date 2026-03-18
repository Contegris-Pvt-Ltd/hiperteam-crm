---
sidebar_position: 44
title: "Forms"
description: "Build public-facing forms to capture leads and data, with a visual designer, conditional logic, and submission analytics."
---

# Forms

The **Forms** module lets you create public-facing forms that capture data from external visitors. Use forms on your website, landing pages, or shared links to collect leads, feedback, registrations, and more — all flowing directly into your CRM.

## Forms Module Overview

Forms are built using a visual designer and published as standalone web pages or embedded on your website. When someone submits a form, the data is captured in Intellicon CRM for processing.

![Screenshot: Forms module showing a list of forms with submission counts and status](../../static/img/screenshots/forms/forms-list.png)

## Form Builder (Visual Designer)

To create a new form:

1. Navigate to **Engagement > Forms** in the sidebar.
2. Click **+ New Form**.
3. The visual form builder opens.

The builder provides a **drag-and-drop interface**:
- Available field types are listed on the left panel
- The form canvas is in the center
- Field properties are displayed on the right when a field is selected

![Screenshot: Form builder with drag-and-drop fields, canvas, and properties panel](../../static/img/screenshots/forms/form-builder.png)

## Field Types

| Field Type | Description |
|---|---|
| **Text** | Single-line text input |
| **Email** | Email address with validation |
| **Phone** | Phone number with formatting |
| **Textarea** | Multi-line text area |
| **Select** | Dropdown menu with predefined options |
| **Checkbox** | One or more checkboxes |
| **Radio** | Radio buttons (single selection from options) |
| **Date** | Date picker |
| **Number** | Numeric input |
| **File** | File upload field |
| **Signature** | Digital signature capture pad |
| **Rating** | Star rating input (1-5 stars) |
| **Heading** | Display-only heading text |
| **Paragraph** | Display-only descriptive text |
| **Divider** | Visual separator line |

## Field Properties

Select any field on the canvas to configure its properties:

| Property | Description |
|---|---|
| **Label** | The field label shown to the user |
| **Placeholder** | Ghost text inside the input |
| **Required** | Whether the field must be filled |
| **Validation** | Input validation rules (min/max length, pattern) |
| **Help Text** | Instructional text below the field |
| **Default Value** | Pre-filled value |
| **Options** | For Select, Checkbox, Radio — the list of choices |
| **Conditional** | Show/hide based on other field values |

## Form Logic (Conditional Fields)

Make forms dynamic by showing or hiding fields based on user input:

1. Select a field.
2. In the properties panel, click **Add Condition**.
3. Configure the condition:
   - **When** — select the controlling field
   - **Is** — select the trigger value (e.g., "equals 'Yes'")
   - **Then** — show or hide this field
4. The field only appears when the condition is met.

:::tip
Use conditional logic to keep forms short and relevant. Show additional fields only when they are needed based on the respondent's previous answers.
:::

## Form Design

Customize the form's visual appearance:

- **Brand Color** — set the primary color for buttons and accents
- **Logo** — upload your company logo to display at the top
- **Background** — choose a background color or image
- **Thank You Message** — customize the message shown after submission
- **Redirect URL** — optionally redirect to a page after submission

## Publishing Forms

Once your form is ready:

### Public URL
1. Click **Publish**.
2. A unique **public URL** is generated.
3. Share this URL via email, social media, or any channel.
4. Anyone with the link can access and submit the form.

### Embed Code
1. Click **Get Embed Code**.
2. Copy the HTML embed snippet.
3. Paste it into your website's HTML to embed the form inline.

![Screenshot: Form publish dialog showing public URL and embed code snippet](../../static/img/screenshots/forms/form-publish.png)

## Form Submissions

View and manage submission data:

1. Open a form.
2. Click the **Submissions** tab.
3. All submissions are displayed in a **data table** with columns matching form fields.

### Analytics Charts
The Submissions tab may include:
- **Submission count over time** — a chart showing daily/weekly submissions
- **Completion rate** — percentage of visitors who completed the form
- **Average time to complete** — how long submissions take

### Exporting Submissions
- Click **Export CSV** or **Export Excel** to download all submission data as a spreadsheet.

:::info
Form submissions can be configured to automatically create leads or contacts in the CRM. This is set up in the form's mapping settings, where you match form fields to CRM fields.
:::
