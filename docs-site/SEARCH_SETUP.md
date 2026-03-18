# Typesense Search Setup

This documentation site uses **Typesense** for full-text search across all manuals.

## Prerequisites

- Docker (recommended) or Typesense binary
- Node.js 18+

## Step 1: Start Typesense Server

### Option A: Docker (Recommended)

```bash
docker run -d \
  --name typesense \
  -p 8108:8108 \
  -v typesense-data:/data \
  typesense/typesense:27.1 \
  --data-dir /data \
  --api-key=your-admin-api-key-here \
  --enable-cors
```

### Option B: Typesense Cloud

1. Sign up at https://cloud.typesense.org (free tier available)
2. Create a cluster
3. Note your **Host**, **Port**, **Protocol**, and **API Key**
4. Update `docusaurus.config.ts` with your cloud details

## Step 2: Create the Collection Schema

```bash
curl "http://localhost:8108/collections" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-TYPESENSE-API-KEY: your-admin-api-key-here" \
  -d '{
    "name": "intellicon-crm-docs",
    "fields": [
      {"name": "anchor", "type": "string", "optional": true},
      {"name": "content", "type": "string"},
      {"name": "url", "type": "string"},
      {"name": "url_without_anchor", "type": "string", "facet": true},
      {"name": "type", "type": "string", "facet": true},
      {"name": "language", "type": "string", "facet": true, "optional": true},
      {"name": "tags", "type": "string[]", "facet": true, "optional": true},
      {"name": "hierarchy.lvl0", "type": "string", "facet": true, "optional": true},
      {"name": "hierarchy.lvl1", "type": "string", "facet": true, "optional": true},
      {"name": "hierarchy.lvl2", "type": "string", "facet": true, "optional": true},
      {"name": "hierarchy.lvl3", "type": "string", "facet": true, "optional": true},
      {"name": "hierarchy.lvl4", "type": "string", "facet": true, "optional": true},
      {"name": "hierarchy.lvl5", "type": "string", "facet": true, "optional": true},
      {"name": "item_priority", "type": "int64"}
    ],
    "default_sorting_field": "item_priority",
    "token_separators": ["_", "-"]
  }'
```

## Step 3: Index the Documentation

### Using the DocSearch Scraper

```bash
# Install the scraper
npm install -g typesense-docsearch-scraper

# Or use Docker
docker run -it --network=host \
  -e "TYPESENSE_API_KEY=your-admin-api-key-here" \
  -e "TYPESENSE_HOST=localhost" \
  -e "TYPESENSE_PORT=8108" \
  -e "TYPESENSE_PROTOCOL=http" \
  -e "CONFIG=$(cat typesense-scraper-config.json | jq -r tostring)" \
  typesense/docsearch-scraper:0.10.0
```

> **Important**: The docs site must be running (`npm run serve`) before you scrape.

## Step 4: Generate a Search-Only API Key

```bash
curl "http://localhost:8108/keys" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-TYPESENSE-API-KEY: your-admin-api-key-here" \
  -d '{
    "description": "Search-only key for docs site",
    "actions": ["documents:search"],
    "collections": ["intellicon-crm-docs"]
  }'
```

Copy the returned `value` and update `docusaurus.config.ts`:

```typescript
typesense: {
  typesenseCollectionName: 'intellicon-crm-docs',
  typesenseServerConfig: {
    nodes: [{
      host: 'localhost',          // or your Typesense Cloud host
      port: 8108,
      protocol: 'http',           // 'https' for production
    }],
    apiKey: 'PASTE_SEARCH_ONLY_KEY_HERE',
  },
},
```

## Step 5: Verify

```bash
cd docs-site
npm run start
```

The search bar in the navbar should now return results as you type.

## Re-indexing After Content Changes

Every time you update documentation, re-run the scraper (Step 3) to update the search index.

For CI/CD automation, add the scraper step after `npm run build` in your deployment pipeline.

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Search returns no results | Re-run the scraper; verify collection exists |
| Connection refused | Check Typesense is running on the configured host/port |
| CORS errors | Ensure `--enable-cors` flag is set on Typesense server |
| Stale results | Re-scrape after content updates |
