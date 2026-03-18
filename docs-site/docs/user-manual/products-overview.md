---
sidebar_position: 26
title: "Products Overview"
description: "Manage your product catalog including product types, categories, statuses, bundles, and product fields."
---

# Products Overview

The **Products** module is your central catalog of everything your organization sells — physical products, services, subscriptions, and bundles. Products are used across the platform, particularly in opportunities and invoices, where they appear as line items.

## Products Module Overview

The Products module lets you:

- Maintain a comprehensive product/service catalog
- Organize products into hierarchical categories
- Define pricing at the product level and through price books
- Create bundle products that group multiple items
- Track product lifecycle with statuses

![Screenshot: Products module list showing product cards with type, price, and status](../../static/img/screenshots/products/products-list.png)

## Product Types

Every product has a **type** that describes its nature:

| Type | Description |
|---|---|
| **Product** | A physical or digital good |
| **Service** | A professional service (consulting, implementation, training) |
| **Subscription** | A recurring product or service (monthly/annual) |
| **Bundle** | A package containing multiple products or services |

:::info
Product type affects how the product is handled in invoicing and reporting. For example, subscriptions may have recurring billing logic, while bundles expand into their component items.
:::

## Product Fields

Standard product fields include:

| Field | Description |
|---|---|
| **Product Name** | The display name |
| **Product Code** | A unique SKU or code |
| **Description** | Detailed product description |
| **Type** | Product, Service, Subscription, or Bundle |
| **Category** | The category this product belongs to |
| **Cost Price** | Your internal cost |
| **List Price** | The standard selling price |
| **Status** | Active, Inactive, or Discontinued |
| **Unit** | Unit of measure (each, hour, month, etc.) |

## Product Categories

Products are organized into a **hierarchical category tree**. Categories help you structure your catalog and make products easier to find.

**Example hierarchy:**
```
Software
├── CRM Solutions
├── Analytics Tools
└── Integration Platforms
Services
├── Implementation
├── Training
└── Support Plans
Hardware
├── Servers
└── Networking
```

### Managing Categories

1. Navigate to the **Products** module.
2. Use the **category panel** on the left side to view the tree.
3. **Add a category:** Click the "+" button, enter a name, and select a parent category (or leave as root).
4. **Edit a category:** Click the edit icon next to a category name.
5. **Delete a category:** Click the delete icon. You cannot delete a category that has products assigned to it.
6. **Organize hierarchy:** Drag categories to rearrange or nest them under different parents.

:::warning
Deleting a category requires removing or reassigning all products in that category first. Plan your category structure carefully before creating products.
:::

## Product Statuses

| Status | Description |
|---|---|
| **Active** | Available for use in opportunities and invoices |
| **Inactive** | Temporarily unavailable (not shown in product selection) |
| **Discontinued** | Permanently retired (historical records preserved) |

## Bundle Products

A **bundle** is a product that contains other products as child items. This is useful for:

- Pre-configured solution packages
- Volume discount packages
- Implementation kits (product + service + support)

To create a bundle:
1. Create a new product and set the type to **Bundle**.
2. In the bundle configuration, add **child products** from your catalog.
3. Set quantities for each child item.
4. The bundle price can be set independently or calculated from child items.

## Creating, Editing, and Deleting Products

### Creating
1. Click **+ New Product** at the top of the products list.
2. Fill in the product fields (name, code, type, category, pricing, etc.).
3. Click **Save**.

### Editing
1. Click a product in the list to open its detail view.
2. Click **Edit**.
3. Modify fields and click **Save**.

### Deleting
1. Click the **actions menu** on a product.
2. Select **Delete**.
3. Confirm the deletion.

:::note
Products are soft-deleted. Existing line items on opportunities and invoices that reference deleted products remain intact.
:::

For pricing across different markets or customer segments, see [Price Books](./products-price-books.md).
