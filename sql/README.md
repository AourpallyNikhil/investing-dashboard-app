# SQL Scripts Organization

This directory contains all SQL scripts for the Investing Dashboard, organized by functionality for better maintainability and collaboration.

## Directory Structure

```
sql/
├── README.md                    # This file - SQL organization guide
├── index.sql                    # Master execution script
├── migrations/                  # Database schema migrations
├── schema/                      # Table and schema definitions
├── fixes/                       # Database fixes and patches
├── cron/                        # Cron job configurations
├── aggregations/               # Sentiment aggregation scripts
├── views/                      # Database views and indexes
└── seed-data/                  # Initial data population scripts
```

## Folder Descriptions

### 📁 migrations/
Contains versioned database schema migrations from Supabase.
- **Purpose**: Track database schema changes over time
- **Naming**: Sequential numbered files (001_, 002_, etc.)
- **Execution**: Run in order for proper schema evolution

### 📁 schema/
Contains scripts for creating tables, constraints, and database structures.
- **Purpose**: Define core database schema
- **Files**: Table creation, actionable tweets setup, minimal tables
- **Usage**: Run when setting up new database instances

### 📁 fixes/
Contains database fixes, patches, and corrections.
- **Purpose**: Fix issues, add missing columns, resolve constraints
- **Files**: VARCHAR constraint fixes, Twitter LLM columns, Reddit improvements
- **Usage**: Apply when specific issues need resolution

### 📁 cron/
Contains cron job setup and configuration scripts.
- **Purpose**: Automated task scheduling for data processing
- **Files**: pg_cron setup, sentiment data jobs, status checks
- **Usage**: Configure automated data processing pipelines

### 📁 aggregations/
Contains real-time aggregation and sentiment processing scripts.
- **Purpose**: Set up sentiment aggregation systems
- **Files**: Aggregation triggers, sentiment calculations
- **Usage**: Enable real-time sentiment processing

### 📁 views/
Contains database views, indexes, and query optimizations.
- **Purpose**: Improve query performance and data access
- **Files**: Indexes creation, view definitions
- **Usage**: Optimize database performance

### 📁 seed-data/
Contains initial data population scripts.
- **Purpose**: Populate database with initial/test data
- **Files**: Seed scripts for development and testing
- **Usage**: Initialize database with baseline data

## Execution Guidelines

### 1. New Database Setup
```sql
-- Run in this order:
\i sql/migrations/001_create_schema.sql
\i sql/migrations/002_create_views.sql
-- ... continue with all migrations in order
\i sql/schema/create-minimal-tables.sql
\i sql/views/run-indexes-and-views.sql
\i sql/seed-data/seed.sql
```

### 2. Applying Fixes
```sql
-- Apply specific fixes as needed:
\i sql/fixes/fix-varchar-constraints.sql
\i sql/fixes/fix-twitter-llm-columns.sql
```

### 3. Setting Up Cron Jobs
```sql
-- Configure automated processing:
\i sql/cron/initialize-pg-cron.sql
\i sql/cron/setup-cron-jobs.sql
```

## File Naming Convention

- **Migrations**: `001_descriptive_name.sql` (sequential numbering)
- **Schema**: `create-table-name.sql` or `setup-feature-name.sql`
- **Fixes**: `fix-issue-description.sql`
- **Cron**: `setup-cron-type.sql` or `cron-job-name.sql`

## Dependencies

Some scripts have dependencies on others. Always check:
1. **Migration Order**: Run migrations sequentially by number
2. **Schema Dependencies**: Ensure base tables exist before creating dependent objects
3. **Fix Prerequisites**: Some fixes require specific schema versions

## Best Practices

1. **Version Control**: All SQL files are tracked in Git
2. **Testing**: Test scripts in development before production
3. **Backup**: Always backup before running fixes or migrations
4. **Documentation**: Update this README when adding new scripts
5. **Rollback**: Keep rollback scripts for critical changes

## Quick Reference

### Most Common Operations

```bash
# Apply all migrations (new setup)
psql -d your_db -f sql/index.sql

# Fix VARCHAR constraints issue
psql -d your_db -f sql/fixes/fix-varchar-constraints.sql

# Add Twitter LLM columns
psql -d your_db -f sql/fixes/fix-twitter-llm-columns.sql

# Setup cron jobs
psql -d your_db -f sql/cron/setup-cron-jobs.sql
```

### Troubleshooting

- **Permission Errors**: Ensure proper database privileges
- **Dependency Errors**: Check if prerequisite tables/functions exist
- **Version Conflicts**: Verify migration order and current schema state

## Maintenance

This organization should be maintained as the project evolves:
- Add new migrations to `migrations/` with proper numbering
- Place schema changes in appropriate folders
- Update this README when adding new categories
- Keep the `index.sql` file updated with proper execution order
