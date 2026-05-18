# Plan: Multi-tenant Social Publishing & Management SaaS

## Context
The user wants to transform the existing CRM-focused application into a comprehensive multi-tenant social media management platform. This involves:
1.  **Multi-tenancy Architecture**: Root (CityWide) -> Agencies (Tenants) -> Clients (Sub-tenants).
2.  **Social Media Integration**: Unified API wrapper for 15+ platforms, enforcing Google Business as the mandatory first step.
3.  **Modules**: Social Profiles, Content Calendar, Social Inbox, Smart Campaigns.
4.  **Monetization**: Hierarchical pricing (markup logic) and an affiliate system (20% commission).

## Phase 1: Exploration & Architecture
- **Database**: Extend the existing BunnyDB schema to support social accounts, posts, campaigns, and billing/affiliate records.
- **API Integration**: Design a unified internal wrapper for social media operations.
- **Auth/Tenancy**: Leverage existing `agency_id` logic and extend it to support the client/sub-tenant hierarchy.

## Phase 2: Implementation Steps
1.  **Schema Extensions**:
    - Add `social_accounts` table (linked to `clients`).
    - Add `posts`, `campaigns`, `inbox_messages` tables.
    - Add `affiliates` and `billing_records` tables.
2.  **Social API Wrapper**:
    - Create a new Edge Function `social-rpc` to handle unified social operations.
    - Implement OAuth flow with mandatory Google Business check.
3.  **UI Modules**:
    - Build "Social Profiles" (connection management).
    - Build "Content Calendar" (scheduling).
    - Build "Social Inbox" (unified messaging).
    - Build "Smart Campaigns" (ad management).
4.  **Billing & Affiliate Logic**:
    - Implement usage aggregation and commission calculation logic.

## Verification
- **Tenancy**: Verify that agencies can only see their own clients and social accounts.
- **Integration**: Verify Google Business mandatory flow.
- **Billing**: Verify markup logic and affiliate commission tracking.
