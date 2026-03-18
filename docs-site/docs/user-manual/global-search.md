---
sidebar_position: 47
title: "Global Search"
description: "Use the global search bar to find records across all CRM modules instantly."
---

# Global Search

The **Global Search** bar lets you find records across your entire CRM from a single input field. No need to navigate to a specific module first — just type and find.

## Global Search Overview

Global search is a cross-module search that queries multiple record types simultaneously. It is the fastest way to find a specific lead, contact, account, opportunity, or product when you know a name, email, or keyword.

![Screenshot: Global search bar in the header with search results dropdown](../../static/img/screenshots/search/global-search.png)

## How to Use

1. Click the **search bar** in the header (or press `/` to focus it).
2. Start typing your search query — a name, email address, phone number, company name, or keyword.
3. Results appear in a **dropdown** below the search bar as you type.
4. Results are grouped by module (Contacts, Leads, Accounts, Opportunities, Products).
5. Click a result to navigate directly to that record's detail page.

:::tip
Type at least 2-3 characters to trigger results. The search is fuzzy and tolerates minor typos, but more specific queries produce better results.
:::

## Searchable Modules

Global search covers the following modules:

| Module | Searchable Fields |
|---|---|
| **Contacts** | First name, last name, email, phone, company |
| **Leads** | Lead name, email, phone, company |
| **Accounts** | Account name, website, phone, email |
| **Opportunities** | Opportunity name, account name |
| **Products** | Product name, product code |

## Search Results Navigation

The results dropdown organizes matches by module with a section header for each:

```
CONTACTS (3 results)
  Jane Smith — jane@acme.com
  John Smith — john@globex.com
  Jane Doe — jane.doe@example.com

LEADS (1 result)
  Acme Corp Inquiry — jane@acme.com

ACCOUNTS (1 result)
  Acme Corporation — acme.com
```

- Each result shows the record name and a key identifying field (email, phone, or website)
- Click any result to open the record
- If there are many results, the dropdown shows the top matches with a "View all results" link

:::info
Search results are filtered by your permissions. You will only see records you have access to view, based on your role, record access settings, and data scope.
:::

### Best Practices

1. **Search by email** for the most precise results — email addresses are unique identifiers
2. **Search by company name** to find all records related to an organization
3. **Use full names** when searching for contacts to avoid too many results
4. Use the module-specific search (within a module's list view) when you need advanced filtering — global search is for quick lookups

![Screenshot: Global search results showing grouped results by module with highlighted matching text](../../static/img/screenshots/search/search-results.png)
