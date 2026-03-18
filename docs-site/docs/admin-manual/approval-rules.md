---
sidebar_position: 27
title: "Approval Rules"
description: "Configure approval rules in Intellicon CRM — set up triggers, sequential and parallel approval chains, approval groups, escalation, and monitoring."
---

# Approval Rules

Approval rules ensure that important decisions (discounts, large deals, budget overruns) go through a review process before being finalized. The approval system supports sequential chains, parallel approvals, approval groups, and escalation.

Navigate to **Admin > Approval Rules**.

![Screenshot: Approval rules list](../../static/img/screenshots/admin/approval-rules-list.png)

## Approval System Overview

An approval rule has three parts:

1. **Trigger** — what causes the approval request (e.g., discount exceeds 20%)
2. **Chain** — who must approve and in what order
3. **Escalation** — what happens if approval is not completed in time

## Creating Approval Rules

1. Click **Create Approval Rule**.
2. Configure the rule:
   - **Name** (required) — e.g., "High Discount Approval", "Large Deal Review"
   - **Module** — which module this rule applies to (Opportunities, Deals, etc.)
   - **Active** — whether the rule is currently enforced
3. Continue to configure the trigger, chain, and escalation.

## Triggers

Triggers define the condition that initiates the approval process.

| Trigger Type | Description | Example |
|-------------|-------------|---------|
| **Discount Threshold** | Fires when a discount percentage exceeds a limit | Discount > 20% |
| **Amount Threshold** | Fires when a deal amount exceeds a limit | Amount > $100,000 |
| **Manual** | User explicitly requests approval | Click "Request Approval" button |
| **Field Value** | Fires when a field reaches a specific value | Priority = "Critical" |

### Configuring a Trigger

1. Select the **trigger type**.
2. Set the **threshold value** or condition.
3. Optionally, add additional conditions (e.g., discount > 20% AND amount > $50K).

![Screenshot: Approval trigger configuration](../../static/img/screenshots/admin/approval-trigger.png)

:::info
Multiple triggers can exist on the same module. The system evaluates all active rules and initiates approval for any rule whose trigger conditions are met.
:::

## Approval Chains

Chains define the sequence of approvers.

### Sequential Chains

Approvers are requested **one at a time**, in order. The next approver is only notified after the previous one approves.

```
Step 1: Sales Manager → (approves) →
Step 2: Finance Director → (approves) →
Step 3: VP Sales → (approves) → APPROVED
```

If any approver rejects, the chain stops and the request is marked as **Rejected**.

### Parallel Chains

All approvers are notified **simultaneously**. The rule is approved when the required number of approvals is received.

```
Notified simultaneously:
├── Sales Manager → approves ✓
├── Finance Director → approves ✓     → APPROVED (2 of 3 required)
└── VP Sales → (pending, not needed)
```

Configure:
- **Required approvals** — how many approvers must approve (e.g., 2 out of 3)
- **Rejection threshold** — how many rejections constitute a denial

### Configuring a Chain

1. Select **Sequential** or **Parallel**.
2. Click **Add Step** (sequential) or **Add Approver** (parallel).
3. For each step/approver, select:
   - A specific **user**
   - A **role** (any user with that role can approve)
   - An **approval group**
4. For parallel chains, set the **required approvals** count.
5. Save.

![Screenshot: Approval chain configuration](../../static/img/screenshots/admin/approval-chain.png)

## Approval Groups

Approval groups are named collections of users who can act as approvers. Any member of the group can approve on behalf of the group.

### Creating an Approval Group

1. Click **Manage Groups**.
2. Click **Create Group**.
3. Enter:
   - **Group Name** — e.g., "Finance Approvers", "Legal Review Board", "Executive Committee"
   - **Members** — select users to include
4. Save.

:::tip
Use approval groups for departments or committees where any member can act as the approver. This prevents bottlenecks when a specific individual is unavailable.
:::

## Escalation Rules

Escalation ensures approvals do not stall indefinitely.

### Configuring Escalation

1. Open the approval rule.
2. Switch to the **Escalation** tab.
3. Configure:
   - **Timeout Period** — how long to wait before escalating (e.g., 24 hours, 48 hours)
   - **Escalation Action**:
     - **Remind** — send a reminder to the current approver
     - **Escalate** — move to the next person in the approver's reporting chain
     - **Auto-approve** — automatically approve if no response within timeout
     - **Auto-reject** — automatically reject if no response
   - **Max Escalation Levels** — how many times to escalate before taking final action
4. Save.

### Example Escalation Flow

```
0h: Approval requested → Sales Manager notified
24h: No response → Reminder sent to Sales Manager
48h: Still no response → Escalated to Sales Director
72h: Sales Director approves → APPROVED
```

:::warning
Be cautious with **auto-approve** escalation. It can bypass important controls if the timeout is too short. Use auto-approve only for low-risk approvals with generous timeout periods.
:::

## Custom Approval Comments

When approving or rejecting, users can add **comments** explaining their decision:

- Comments are visible to the requester and all approvers.
- Comments are stored in the audit log.
- Rejection comments are especially important — they tell the requester what needs to change.

## Monitoring the Approval Queue

### Approval Dashboard

The approval queue shows all pending, approved, and rejected requests:

1. Navigate to the **Approval Queue** tab.
2. Filter by:
   - **Status** — Pending, Approved, Rejected
   - **Rule** — which approval rule triggered the request
   - **Date range** — when the request was initiated
   - **Requester** — who initiated the request
3. Click on a request to view details, chain progress, and comments.

![Screenshot: Approval queue monitoring](../../static/img/screenshots/admin/approval-queue.png)

:::info
Admins can see all approval requests. Regular users see only requests they submitted or need to approve.
:::

## Best Practices

1. **Keep chains short** — 2-3 approval steps is usually sufficient. Longer chains slow down business.
2. **Use groups for coverage** — approval groups prevent single-point bottlenecks.
3. **Set reasonable timeouts** — 24-48 hours per step balances urgency with availability.
4. **Escalate, do not auto-approve** — escalation to a manager is safer than automatic approval.
5. **Document thresholds** — communicate to the team what triggers approval (e.g., "Any discount above 20% requires manager approval").
6. **Review approval analytics** — look at average approval time, rejection rates, and escalation frequency. Optimize accordingly.

---

Next: [Integrations Overview](./integrations-overview.md) — Connect Intellicon CRM to external systems.
