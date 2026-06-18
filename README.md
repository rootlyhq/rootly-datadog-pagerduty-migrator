# Rootly Datadog PagerDuty Migrator

[![CI](https://github.com/rootlyhq/rootly-datadog-pagerduty-migrator/actions/workflows/ci.yml/badge.svg)](https://github.com/rootlyhq/rootly-datadog-pagerduty-migrator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 24](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)

Appends `@webhook-rootly-[serviceName]` to every Datadog monitor containing `@pagerduty-[serviceName]`, creating webhooks as necessary. Services are matched by name.

## Requirements

- Node.js >= 24 and Yarn
- A configured Rootly alert source for Datadog

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATADOG_API_KEY` | Yes | Datadog API key with monitor read/write and webhook create permissions |
| `DATADOG_APP_KEY` | Yes | Datadog application key |
| `PAGERDUTY_API_TOKEN` | Yes | PagerDuty API token with service read permissions |
| `ROOTLY_API_TOKEN` | Yes | Rootly API token with service read permissions |
| `ROOTLY_ALERT_SOURCE_SECRET` | Yes | Rootly Datadog alert source secret for webhook verification |
| `ROOTLY_API_URL` | No | Override Rootly API URL (default: `https://api.rootly.com/v1`) |
| `DRY_RUN` | No | Set to `true` to preview changes without modifying monitors |

Copy `.env.example` to `.env` and fill in values.

## Usage

```bash
yarn install
yarn start
```

## Service Matching

Matching Pagerduty services must exist in Rootly and be linked to PagerDuty (the Rootly service `pagerduty_id` attribute must be set). You can link services to PagerDuty on the integrations tab when configuring your Rootly service.

Services must have matching normalized names. A normalized name is one where all characters except A-z, 0-9, underscores, and dashes are replaced with an underscore. Matching is case-insensitive. For example, a Datadog mention `@pagerduty-production_on-call` will match a PagerDuty service named `[Production] On-Call` or `Production on-call`.

## Output

Each run produces a `run-<timestamp>.csv` file with results for every processed monitor, including old/new notification strings and any errors encountered.

## Development

```bash
yarn lint        # Run ESLint
yarn test        # Run tests
yarn test:watch  # Run tests in watch mode
```
