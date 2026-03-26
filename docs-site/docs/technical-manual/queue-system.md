---
sidebar_position: 13
title: "Queue System"
description: "Bull + Redis queue architecture for background job processing, lead imports, and async operations"
---

# Queue System

IntelliSales CRM uses **Bull** (backed by Redis) for background job processing. This enables long-running operations like CSV imports, report generation, and email sending to run asynchronously without blocking API responses.

## Architecture

```
┌──────────────┐     Add Job      ┌──────────────┐     Process     ┌──────────────┐
│  Controller   │────────────────▶│  Redis Queue  │────────────────▶│  Processor    │
│  (API Layer)  │                  │  (Bull)       │                 │  (Worker)     │
│               │◀─ Job ID ────────│               │                 │               │
└──────────────┘                   └──────────────┘                 └──────┬───────┘
       │                                                                    │
       │  Poll status                                                      │
       ▼                                                                   ▼
  GET /jobs/:id                                               Write results to DB
  { status, progress }                                        Update job status
```

## Lead Import Processor

The primary queue use case is bulk CSV/XLSX import for leads.

### Files

| File | Purpose |
|------|---------|
| `apps/api/src/modules/lead-import/lead-import.module.ts` | Module + Bull queue registration |
| `apps/api/src/modules/lead-import/lead-import.service.ts` | Job creation and status tracking |
| `apps/api/src/modules/lead-import/lead-import.controller.ts` | Upload + status endpoints |
| `apps/api/src/modules/lead-import/lead-import.processor.ts` | Bull queue worker |

### Module Registration

```typescript
// lead-import.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'lead-import',
    }),
  ],
  controllers: [LeadImportController],
  providers: [LeadImportService, LeadImportProcessor],
})
export class LeadImportModule {}
```

### Queue Configuration

Bull connects to Redis using the environment variables:

```typescript
// In app.module.ts or config
BullModule.forRoot({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
});
```

## Job Lifecycle

```
created → waiting → active → completed
                         └──→ failed → (retry) → active → completed
```

| Status | Description |
|--------|-------------|
| `created` | Job added to queue |
| `waiting` | In queue, waiting for a worker |
| `active` | Currently being processed |
| `completed` | Successfully processed all rows |
| `failed` | Processing failed (may be retried) |

## Worker Implementation

```typescript
// lead-import.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('lead-import')
export class LeadImportProcessor {
  constructor(private readonly dataSource: DataSource) {}

  @Process()
  async handleImport(job: Job<{
    schemaName: string;
    userId: string;
    filePath: string;
    mapping: Record<string, string>;
    importJobId: string;
  }>) {
    const { schemaName, userId, filePath, mapping, importJobId } = job.data;

    try {
      // 1. Parse CSV/XLSX file
      const rows = await this.parseFile(filePath);
      const totalRows = rows.length;

      // 2. Update job status to 'processing'
      await this.updateJobStatus(schemaName, importJobId, 'processing', {
        totalRows,
      });

      let processed = 0;
      let succeeded = 0;
      let failed = 0;
      const errors: any[] = [];

      // 3. Process each row
      for (const row of rows) {
        try {
          const mappedData = this.applyMapping(row, mapping);
          await this.createLead(schemaName, userId, mappedData);
          succeeded++;
        } catch (err) {
          failed++;
          errors.push({ row: processed + 1, error: err.message });
        }

        processed++;

        // 4. Report progress
        await job.progress(Math.round((processed / totalRows) * 100));

        // 5. Update job record periodically
        if (processed % 100 === 0) {
          await this.updateJobStatus(schemaName, importJobId, 'processing', {
            totalRows, processed, succeeded, failed,
          });
        }
      }

      // 6. Finalize
      await this.updateJobStatus(schemaName, importJobId, 'completed', {
        totalRows, processed, succeeded, failed, errors,
      });

      return { totalRows, succeeded, failed };
    } catch (err) {
      await this.updateJobStatus(schemaName, importJobId, 'failed', {
        error: err.message,
      });
      throw err;
    }
  }
}
```

## Job Progress Tracking

### Creating a Job

```typescript
// lead-import.service.ts
@Injectable()
export class LeadImportService {
  constructor(
    @InjectQueue('lead-import') private importQueue: Queue,
    private readonly dataSource: DataSource,
  ) {}

  async startImport(schemaName: string, userId: string, file: any, mapping: any) {
    // 1. Create import job record in DB
    const [jobRecord] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".import_jobs
       (file_name, status, created_by, created_at)
       VALUES ($1, 'pending', $2, NOW())
       RETURNING *`,
      [file.originalname, userId],
    );

    // 2. Add to Bull queue
    const job = await this.importQueue.add({
      schemaName,
      userId,
      filePath: file.path,
      mapping,
      importJobId: jobRecord.id,
    }, {
      attempts: 3,           // Retry up to 3 times
      backoff: {
        type: 'exponential',
        delay: 5000,         // 5s, 10s, 20s
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    return { jobId: jobRecord.id, queueJobId: job.id };
  }
}
```

### Checking Job Status

```typescript
// lead-import.controller.ts
@Get('jobs/:id')
@RequirePermission('leads', 'import')
async getJobStatus(
  @Request() req: { user: JwtPayload },
  @Param('id') id: string,
) {
  return this.leadImportService.getJobStatus(req.user.tenantSchema, id);
}
```

```typescript
// Response
{
  "id": "job-uuid",
  "fileName": "leads-2025.csv",
  "status": "processing",
  "totalRows": 5000,
  "processed": 2340,
  "succeeded": 2300,
  "failed": 40,
  "progress": 47,
  "createdAt": "2025-01-15T10:00:00Z"
}
```

## Error Handling and Retry

Bull supports automatic retry with configurable backoff:

```typescript
await this.importQueue.add(jobData, {
  attempts: 3,              // Maximum retry attempts
  backoff: {
    type: 'exponential',    // 'fixed' or 'exponential'
    delay: 5000,            // Initial delay in ms
  },
});
```

### Failed Job Handling

```typescript
@OnQueueFailed()
handleFailed(job: Job, error: Error) {
  console.error(`Job ${job.id} failed:`, error.message);
  // Update import_jobs table with error details
}

@OnQueueCompleted()
handleCompleted(job: Job, result: any) {
  console.log(`Job ${job.id} completed:`, result);
}
```

## Monitoring Queue Health

### Queue Events

```typescript
@OnQueueActive()
handleActive(job: Job) {
  console.log(`Processing job ${job.id}...`);
}

@OnQueueStalled()
handleStalled(job: Job) {
  console.warn(`Job ${job.id} stalled — will be retried`);
}
```

### Queue Metrics

```typescript
// Get queue statistics
const queue = this.importQueue;
const waiting = await queue.getWaitingCount();
const active = await queue.getActiveCount();
const completed = await queue.getCompletedCount();
const failed = await queue.getFailedCount();
```

## Adding New Queue Processors

To add a new background job type:

### 1. Register the Queue

```typescript
// In your module
BullModule.registerQueue({
  name: 'report-export',
})
```

### 2. Create the Processor

```typescript
@Processor('report-export')
export class ReportExportProcessor {
  @Process()
  async handleExport(job: Job<{ schemaName: string; reportId: string }>) {
    // Process the job
  }
}
```

### 3. Inject and Use in Service

```typescript
@Injectable()
export class ReportsService {
  constructor(
    @InjectQueue('report-export') private exportQueue: Queue,
  ) {}

  async exportReport(schemaName: string, reportId: string) {
    const job = await this.exportQueue.add({ schemaName, reportId });
    return { jobId: job.id };
  }
}
```

:::warning Redis Dependency
The queue system requires a running Redis instance. If Redis is unavailable:
- Queue operations will throw connection errors
- The rest of the application will continue to function
- Import/export features will be unavailable until Redis is restored
:::

:::tip Development
For local development, you can monitor Bull queues using [Bull Board](https://github.com/felixmosh/bull-board) or [Arena](https://github.com/bee-queue/arena). Add it as a dev dependency for a web-based queue dashboard.
:::
