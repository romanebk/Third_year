# Summary: how the database was managed

## Overview

The project uses PostgreSQL with Prisma as the ORM.

The database is centralized on the backend side and stores:

- users
- linked OAuth accounts
- sessions and tokens
- service subscriptions
- widget instances
- user preferences
- email verification tokens

The full schema is in:

- `backend/prisma/schema.prisma`

## Why Prisma was chosen

Prisma was selected for several reasons:

- simple schema and migration management
- natural integration with Next.js
- strong TypeScript typing
- automatic Prisma client generation
- clear schema evolution through migrations

This allows for a database that is robust, readable, and easy to evolve.

## Main configuration file

The central point is:

- `backend/src/lib/db.ts`

This file exposes the Prisma client singleton used throughout the backend to access the database.

This avoids creating multiple Prisma instances inside the application and gives better control over connection handling.

## Main schema

The `schema.prisma` file defines several key models.

### `User`

Represents the user account.

Important fields:
- `email`
- `passwordHash` (for classic email/password authentication)
- `emailVerified`
- `role` (`USER` or `ADMIN`)
- `disabled`
- `image`

This model supports both local accounts and OAuth-linked accounts within a single system.

### `Account`

Represents third-party accounts authenticated through OAuth.

It stores:
- the provider (`github`, `google`, etc.)
- the provider account ID
- access and refresh tokens
- the `userId` linking the OAuth account to the `User`

The project encrypts sensitive tokens before storing them, which is an important security feature.

### `Session`

The `Session` model is required by the NextAuth contract even though the project uses JWT-based session strategy.

The application does not rely on persisted database sessions for active authentication, but the model is kept to remain compatible with the NextAuth adapter.

### `EmailVerificationToken`

This model stores the verification tokens sent at sign-up.

The flow is:

1. the user registers
2. the backend generates a verification token
3. the token is sent by email
4. the user confirms it
5. the account becomes `emailVerified`

### `ServiceSubscription`

This model represents a user’s subscription to a service.

Examples:
- GitHub
- YouTube
- Steam
- Weather
- etc.

It allows the system to know whether the user has subscribed to a service before authorizing the use of related widgets.

### `WidgetInstance`

This is one of the most important models.

It represents a widget instance placed on a user’s dashboard.

Key fields:
- `service`
- `widget`
- `params` (JSON, depending on widget configuration)
- `refreshRateSeconds`
- `position`
- `userId`

This allows each user to have personalized widgets, configured differently, each with its own refresh interval.

### `UserSettings`

The project also centralizes user preferences in a dedicated model.

Examples:
- default weather city
- temperature unit
- tracked GitHub repository
- preferred RSS feed
- `defaultsSeeded` flag to initialize default widgets only once

This avoids mixing user preferences into temporary JavaScript state and ensures they are correctly applied to default widget instances.

## Why `params` are stored as free-form JSON

A key design decision is that not all widgets have the same parameters.

Some use strings, others integers, and some are more complex.

Instead of creating a new table for every widget, the project stores the parameters in a JSON field:

- `params: Json`

This keeps the schema simple and extensible.

Validation is done in application code using the service and widget rules, rather than through heavy relational modeling.

## Migrations

Prisma migrations are stored in:

- `backend/prisma/migrations/`

The project uses versioned migrations to evolve the schema safely.

This allows:
- database preservation
- change tracking
- safe schema evolution without breaking the app

## Security of stored data

The project pays close attention to sensitive data:

- OAuth tokens are encrypted before storage
- the encryption key is kept separate from `NEXTAUTH_SECRET`
- passwords are hashed with `bcryptjs`
- third-party API keys are protected within the application logic

This is important because OAuth tokens and external API keys should not remain stored in plain text.

## Role of the database in the dashboard

The database is not only used for authentication.

It is also the foundation of the dashboard itself:

- a user has several widgets
- each widget has parameters
- each widget has a refresh interval
- those records are used to display the personalized dashboard

So the database is a core product component, not just a user registry.

## Example of business logic

For example, in the project:

- a user adds a weather widget
- the backend creates a `WidgetInstance` record
- that row contains the service, widget, configuration, position, and refresh interval
- the backend timer detects this instance and refreshes it automatically

Without the database, the widget system could not persist across sessions or reloads.

## Conclusion

The database was designed as the heart of the system.

It stores:
- account and authentication data
- user preferences
- subscriptions and services
- dashboard widget instances

The combined choice of Prisma + PostgreSQL is coherent with the project:
- easy to maintain
- well structured
- extensible
- secure

This makes it a solid foundation for a personalized, scalable, and resilient dashboard.
