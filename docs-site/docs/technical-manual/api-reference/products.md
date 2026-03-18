---
sidebar_position: 8
title: "Products API"
description: "Complete endpoint reference for products, categories, price books, price book entries, and bundles"
---

# Products API

Base path: `/products`

All endpoints require JWT authentication and `@RequirePermission('products', 'action')`.

## Products CRUD

### POST /products

```json
{
  "name": "Enterprise License",
  "code": "ENT-LIC-001",
  "description": "Annual enterprise license per user",
  "categoryId": "cat-uuid",
  "type": "subscription",
  "unitPrice": 250,
  "currency": "USD",
  "isActive": true,
  "taxable": true,
  "taxRate": 8.5,
  "customFields": {
    "min_quantity": 10,
    "max_discount": 25
  }
}
```

**Response (201):**

```json
{
  "id": "prod-uuid",
  "name": "Enterprise License",
  "code": "ENT-LIC-001",
  "type": "subscription",
  "unitPrice": 250,
  "currency": "USD",
  "categoryName": "Software Licenses",
  "isActive": true,
  "createdAt": "2025-01-20T10:00:00Z"
}
```

### GET /products

```bash
GET /products?page=1&limit=25&search=enterprise&categoryId=uuid&type=subscription&isActive=true
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Search by name or code |
| `categoryId` | UUID | Filter by category |
| `type` | string | `one_time`, `subscription`, `usage_based` |
| `isActive` | boolean | Active status filter |
| `page` | number | Page number |
| `limit` | number | Items per page |

### GET /products/:id

### PUT /products/:id

### DELETE /products/:id

## Categories

### GET /products/categories

```json
[
  { "id": "cat-uuid", "name": "Software Licenses", "description": "License products", "productCount": 12 },
  { "id": "cat-uuid", "name": "Professional Services", "description": "Consulting and implementation", "productCount": 5 },
  { "id": "cat-uuid", "name": "Hardware", "description": "Physical devices", "productCount": 8 }
]
```

### POST /products/categories

```json
{ "name": "Add-ons", "description": "Optional add-on products" }
```

### PUT /products/categories/:id

### DELETE /products/categories/:id

## Price Books

Price books allow different pricing for different customer segments or regions.

### GET /products/price-books

```json
[
  {
    "id": "pb-uuid",
    "name": "Standard",
    "description": "Standard pricing",
    "isDefault": true,
    "isActive": true,
    "currency": "USD",
    "entryCount": 45
  },
  {
    "id": "pb-uuid",
    "name": "Partner",
    "description": "Discounted partner pricing",
    "isDefault": false,
    "isActive": true,
    "currency": "USD",
    "entryCount": 30
  }
]
```

### POST /products/price-books

```json
{
  "name": "Enterprise Volume",
  "description": "Volume discount pricing for enterprise customers",
  "currency": "USD",
  "isActive": true
}
```

### PUT /products/price-books/:id

### DELETE /products/price-books/:id

## Price Book Entries

### GET /products/price-books/:id/entries

```json
[
  {
    "id": "entry-uuid",
    "productId": "prod-uuid",
    "productName": "Enterprise License",
    "unitPrice": 200,
    "minimumQuantity": 100,
    "maximumQuantity": 999,
    "discount": 20,
    "discountType": "percentage"
  }
]
```

### POST /products/price-books/:id/entries

```json
{
  "productId": "prod-uuid",
  "unitPrice": 200,
  "minimumQuantity": 100,
  "maximumQuantity": 999,
  "discount": 20,
  "discountType": "percentage"
}
```

### PUT /products/price-books/:bookId/entries/:entryId

### DELETE /products/price-books/:bookId/entries/:entryId

## Bundles

Product bundles group multiple products together with optional discounts.

### GET /products/:id/bundle-items

```json
[
  {
    "id": "bi-uuid",
    "productId": "prod-uuid-1",
    "productName": "Enterprise License",
    "quantity": 1,
    "isOptional": false
  },
  {
    "id": "bi-uuid",
    "productId": "prod-uuid-2",
    "productName": "Premium Support",
    "quantity": 1,
    "isOptional": true
  }
]
```

### POST /products/:id/bundle-items

```json
{
  "productId": "prod-uuid",
  "quantity": 1,
  "isOptional": false
}
```

### DELETE /products/:id/bundle-items/:itemId
