---
sidebar_position: 43
title: "Approvals"
description: "Manage approval requests — view your queue, approve or reject records, request additional information, and add comments."
---

# Approvals

The **Approvals** module manages approval workflows — requests that need to be reviewed and approved (or rejected) by designated users before a record can proceed. Common use cases include discount approvals, high-value deal sign-offs, and expense authorizations.

## What are Approvals?

An approval is a request generated when a CRM action triggers an approval rule. For example:

- A sales rep offers a discount above 20% on an opportunity — the discount needs manager approval
- A lead is about to be converted — it needs quality review approval
- A contract exceeds a certain value — it needs executive sign-off

When an approval is triggered, the designated approver receives a notification and the record is held until a decision is made.

![Screenshot: Approvals module showing pending approval requests in a queue](../../static/img/screenshots/approvals/approval-queue.png)

## Approval Queue

Navigate to **Approvals** in the sidebar to see your pending approval requests. The queue shows:

- **Record name** — the entity awaiting approval
- **Entity type** — Lead, Opportunity, Invoice, etc.
- **Trigger** — what caused the approval request (e.g., "Discount exceeds 20%")
- **Requester** — the user who initiated the action
- **Date submitted** — when the request was created
- **Status** — Pending, Approved, Rejected, or Info Requested

:::info
You only see approvals assigned to you (as an approver). If you are not an approver, you will see your submitted requests and their statuses.
:::

## Approval Actions

For each pending approval, you can take one of three actions:

### Approve
1. Open the approval request.
2. Review the record details and the reason for the approval request.
3. Click **Approve**.
4. Optionally add a comment explaining your decision.
5. The record proceeds with the original action.

### Reject
1. Open the approval request.
2. Click **Reject**.
3. Add a **reason for rejection** (recommended — this helps the requester understand what needs to change).
4. The original action is blocked, and the requester is notified.

### Request More Information
1. Open the approval request.
2. Click **Request Info**.
3. Type a **question or clarification** you need before making a decision.
4. The requester is notified and can respond with additional context.

![Screenshot: Approval detail showing record information with Approve, Reject, and Request Info buttons](../../static/img/screenshots/approvals/approval-actions.png)

## Approval Details

Each approval request provides context to help the approver make an informed decision:

- **Entity type** — what kind of record this is (Opportunity, Invoice, etc.)
- **Trigger rule** — which approval rule was triggered
- **Requester** — who initiated the action and when
- **Record summary** — key fields from the record (name, amount, stage, etc.)
- **Change details** — what specifically triggered the approval (e.g., "Discount changed from 10% to 25%")
- **Link to record** — click to view the full record detail page

## Adding Comments to Approvals

Throughout the approval process, both approvers and requesters can add **comments** to the approval thread:

1. Open the approval.
2. Scroll to the **Comments** section.
3. Type your comment.
4. Click **Post**.

Comments create a conversation thread that provides context and documentation for the approval decision. This is valuable for audit purposes.

:::tip
Always add a comment when approving or rejecting a request. This creates a clear record of the reasoning behind each decision, which is helpful for future reference and compliance.
:::

:::note
Approval rules are configured by administrators under **Admin > Approval Rules**. If you think an approval rule needs adjustment, discuss it with your admin.
:::
