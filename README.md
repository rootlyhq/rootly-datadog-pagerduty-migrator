# Rootly Datadog Pagerduty Migrator

Appends `@webhook-rootly-[serviceName]` to every Datadog monitor containing `@pagerduty-[serviceName]`, creating webhooks as necessary. Services are matched by name.

## Requirements

- `DD_API_KEY`, `DD_APP_KEY`, `PAGERDUTY_API_TOKEN`, and `ROOTLY_API_TOKEN` environment variables
  with the necessary permissions to read and update Datadog monitors, create Datadog webhooks, read PagerDuty services, and read Rootly services.
- Matching Pagerduty services must exist in Rootly and be linked to Pagerduty (the Rootly service must include the pagerduty_id attribute).
- Services must have matching normalized names. A normalized name is one where all characters except A-z, 0-9, underscores, and dashes are replaced with underscores. Matching is case-insensitive.
