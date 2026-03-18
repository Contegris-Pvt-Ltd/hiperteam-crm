---
sidebar_position: 24
title: "Closing Opportunities"
description: "Learn how to close opportunities as Won or Lost, manage close reasons, and understand what happens when a deal closes."
---

# Closing Opportunities

Closing an opportunity marks the end of the active sales cycle. Whether you won or lost the deal, properly recording the outcome provides valuable data for forecasting, reporting, and process improvement.

## Closing as Won

When a deal is successfully closed:

1. Open the opportunity detail page.
2. Click the **Close Won** button.
3. A modal dialog appears with:
   - **Close Date** — confirm or adjust the closing date
   - **Final Amount** — confirm or adjust the deal value
   - **Create Project** option — toggle on if you want to immediately create a project from this opportunity
   - **Notes** — optional comments about the win
4. Review the details and click **Confirm**.

![Screenshot: Close Won modal with close date, amount, create project toggle, and notes field](../../static/img/screenshots/opportunities/close-won-modal.png)

:::tip
If the deal involves a deliverable or implementation, enable the "Create Project" option to automatically generate a project linked to this opportunity. This carries over the opportunity details and contact information into project management.
:::

## Closing as Lost

When a deal is lost:

1. Open the opportunity detail page.
2. Click the **Close Lost** button.
3. A modal dialog appears with:
   - **Close Reason** — select the primary reason for the loss from a dropdown
   - **Feedback Notes** — add details about why the deal was lost, what the competitor offered, or what could be improved
4. Select a reason, add notes, and click **Confirm**.

![Screenshot: Close Lost modal with reason dropdown and feedback notes text area](../../static/img/screenshots/opportunities/close-lost-modal.png)

:::warning
Always select an accurate close reason and provide feedback notes. This data feeds into win/loss analysis reports that help your organization improve its sales process over time.
:::

## Close Reasons

Close reasons are configured by your administrator under **Admin > Opportunity Settings**. Common reasons include:

### Won Reasons
- Competitive pricing
- Superior product fit
- Strong relationship
- Better terms/conditions

### Lost Reasons
- **Competitor Chosen** — prospect selected a competing solution
- **No Decision / No Budget** — prospect decided not to proceed
- **Price Too High** — your pricing exceeded the prospect's budget
- **Missing Features** — product lacked required capabilities
- **Poor Timing** — bad timing for the prospect
- **Lost Contact** — unable to maintain communication
- **Went with In-House Solution** — prospect built their own solution

:::info
If you do not see an appropriate reason in the dropdown, contact your administrator to add it. Accurate close reasons are critical for meaningful win/loss analysis.
:::

## Reopening a Closed Opportunity

If circumstances change after closing, an opportunity can be reopened:

1. Open the closed opportunity detail page.
2. Click the **Reopen** button (if available based on your permissions).
3. The opportunity returns to its last active pipeline stage.
4. The close date and reason are cleared.
5. A record in the stage history notes the reopening.

:::note
Reopening a closed opportunity may require administrator or manager permissions. Not all users can reopen deals — check with your admin if you do not see the Reopen button.
:::

## What Happens on Close

When an opportunity is closed (won or lost), several things happen automatically:

### For Closed Won
- The opportunity stage changes to "Closed Won"
- The close date and final amount are recorded
- Pipeline metrics and forecasts update immediately
- Win rate statistics recalculate
- If "Create Project" was selected, a new project is generated
- Revenue is attributed to the owner and team
- An activity entry is created on the timeline

### For Closed Lost
- The opportunity stage changes to "Closed Lost"
- The close reason and feedback are recorded
- The deal is removed from active pipeline calculations
- Loss data feeds into win/loss analysis reports
- An activity entry is created on the timeline

### Record Behavior After Close
- The opportunity becomes **read-only** by default (fields cannot be edited without reopening)
- You can still add notes, upload documents, and view history
- The record remains in the list view but is typically filtered out of active pipeline views

![Screenshot: Closed opportunity showing read-only state with Reopen button](../../static/img/screenshots/opportunities/closed-opportunity.png)
