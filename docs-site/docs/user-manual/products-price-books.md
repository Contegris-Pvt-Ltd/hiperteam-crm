---
sidebar_position: 27
title: "Price Books"
description: "Create and manage price books to offer different pricing for products across customer segments, regions, or time periods."
---

# Price Books

**Price Books** allow you to maintain multiple pricing structures for the same products. This is essential for organizations that offer different pricing across customer segments, regions, currencies, or promotional periods.

## What are Price Books?

A price book is a **named collection of product prices** that overrides the standard list price. For example:

- **Standard Price Book** — default pricing for all customers
- **Enterprise Price Book** — discounted pricing for large accounts
- **Partner Price Book** — special pricing for channel partners
- **Q1 Promotion** — temporary promotional pricing for a specific quarter

When adding products to an opportunity, you can select which price book to use, and the prices populate automatically.

![Screenshot: Price books list showing different price books with their effective dates and product counts](../../static/img/screenshots/products/price-books-list.png)

## Creating Price Books

1. Navigate to **Products > Price Books** (or the Price Books section within the Products module).
2. Click **+ New Price Book**.
3. Fill in the details:
   - **Name** — a descriptive name (e.g., "Enterprise Tier 2024")
   - **Description** — optional description of when to use this price book
   - **Currency** — the currency for all prices in this book
   - **Effective Start Date** — when this price book becomes active
   - **Effective End Date** — when this price book expires (leave blank for no expiration)
   - **Active** — toggle to enable/disable the price book
4. Click **Save**.

![Screenshot: New price book creation form with name, currency, and date fields](../../static/img/screenshots/products/create-price-book.png)

:::tip
Use effective dates to manage seasonal or promotional pricing. When a promotion ends, the price book automatically becomes inactive without manual intervention.
:::

## Adding Products to Price Books

After creating a price book, add products with custom pricing:

1. Open the price book.
2. Click **Add Product**.
3. Search for and select a product from your catalog.
4. Enter the **custom price** for this product in this price book.
5. Optionally set a **minimum price** (floor) and **maximum price** (ceiling).
6. Click **Save**.

Repeat for each product that should have custom pricing in this book.

:::note
Products not explicitly added to a price book fall back to their standard **list price** from the product record.
:::

## Managing Price Book Entries

Within a price book, you can:

- **View all entries** — see every product and its custom price
- **Edit pricing** — click an entry to modify the price, minimum, or maximum
- **Remove products** — delete an entry to revert that product to standard pricing
- **Search/filter** — find specific products within the book

| Column | Description |
|---|---|
| Product Name | The product |
| Product Code | SKU |
| Standard Price | The list price from the product record |
| Book Price | The custom price in this price book |
| Minimum Price | Floor price (for discounting limits) |
| Maximum Price | Ceiling price |

## Using Price Books in Opportunities

When adding line items to an opportunity:

1. Select the **price book** to use for this opportunity (or use the default).
2. When you add a product, the **unit price** automatically populates from the selected price book.
3. You can still manually adjust the price on individual line items.
4. If the product is not in the selected price book, the standard list price is used.

:::warning
If a price book has expired (past its effective end date), it will not appear as a selectable option. Ensure your active price books have valid date ranges.
:::

![Screenshot: Opportunity line items with price book selector and auto-populated prices](../../static/img/screenshots/products/price-book-in-opportunity.png)

### Best Practices

1. **Keep price books organized** — use clear naming conventions that indicate the audience and time period
2. **Review regularly** — update pricing at least quarterly to reflect market changes
3. **Use effective dates** — let the system manage activation/deactivation
4. **Set min/max prices** — protect margins by defining acceptable price ranges
5. **Audit usage** — track which price books are used most to understand your pricing landscape
