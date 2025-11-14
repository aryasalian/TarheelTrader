# Design Document

> Written by: Bryen Alvarez, Kritan Bhurtyal, Arya Salian, Mena Tobia for COMP 426: Modern Web Programming at UNC-Chapel Hill.

## Feature Plan

This project is a portfolio analytics dashboard that helps users track their stock investments with live updates and performance insights. It integrates market data from the Alpaca API and uses Supabase for authentication, data storage, and real tine updates. Users can manage portfolios, simulate trades, and analyze their holdings.

### Feature 1: User portfolio tracker

**Description:**
User creates a paper portfolio, adds stock positions via transactions. App tracks current value, P/L, and charts over time.

**User(s):**
Logged-in investor.

**Purpose:**
Central dashboard to see how their investments perform overall.

**Technical Notes:**
Tables: position, daily_portfolio_snapshot
API: Alpaca 
Realtime: New row in transaction auto-updates the position & notifications table & UI (Postgres changes).

**UI/UX:** 
Will use a card-based layout summarizing total balance, daily change, and profit/loss, Will include interactive charts to show value over time.


### Feature 2: Watchlist & live price feed

**Description:**
Tickers starred by logged-in user can be found here as a watchlist and shows live price, % change, and basic stats.

**User(s):**
Logged-in user.

**Purpose:**
Quick overview without digging into portfolios.

**Technical Notes:**
Table: watchlist_items
React Query + Alpaca API
Realtime: When a row in watchlist_items gets deleted, UI auto updates to show item removed from watchlist card (Postgres changes).

**UI/UX:** 
Color coding (green/red) for price changes and hover effects to expand details. Users can drag and drop to reorder their watchlist items or click a ticker to open detailed charts.

### Feature 3: Screener

**Description:**
Filter stocks by conditions: price, volume, volatility, sector, etc. Display a paginated table with sorting & filtering. Starring is available to logged-in users only; Anon users can only sort, filter, and view.

**User(s):**
Logged-in user to star tickers for watchlist, anon users for just browsing.

**Purpose:**
Help users discover candidates instead of manually typing tickers.

**Technical Notes:**
Screener itself will be “stateless” (no table), just sorting/filtering on the main market data.
API: Alpaca API.
Must paginate results (max 50 rows per page).

**UI/UX:**
Filter controls (dropdowns, sliders, checkboxes) will be implemented using shadcn components for consistency. Results will update instantly as users change filters, using React Query for smooth client-side caching

### Feature 4: Trade/transaction log (mock broker)

**Description:**
Record “buys” and “sells” (paper trades) against a portfolio. Show transaction log with timestamps. Only allows market orders, no limit order functionality.

**User(s):**
Logged-in investor simulating real trades or paper-trading a strategy.

**Purpose:**
Lets user test strategies without actual money; also required for P/L over time.

**Technical Notes:**
Table: transaction.
When a new transaction is inserted, Postgres change trigger updates position and appends to notification via Supabase Realtime.

**UI/UX:**
Will use a structured table with columns for ticker, action, quantity, and timestamp, plus confirmation toasts on submission. Submitting a trade triggers real-time update to reflect new profit/loss instantly.


### Feature 5: Analytics & Insights (with AI)

**Description:**
Show charts: portfolio value over time, sector breakdown, best/worst performers, and an AI “explain my portfolio” summary.

**User(s):**
Logged-in investor.

**Purpose:**
Turn data into something intelligible.

**Technical Notes:**
Table: position, daily_portfolio_snapshot.
Use OpenAI API to generate a 2–3 paragraph natural language summary: “You’re overweight tech; BTC is 40% of your risk,” etc.

**UI/UX:** 
Will have visual breakdowns like pie charts for sector diversification and bar charts for top performers. The AI insights will appear in a styled card or modal that updates periodically based on portfolio data.


Together, these features create an integrated experience for investors to manage, analyze, and visualize their portfolios in real time. The combination of live data, intuitive design, and interactive charts makes the app both educational and practical. By blending front-end design principles with real API integration, this project demonstrates a complete full-stack web experience. All live prices are never stored in Supabase, we get them from Alpaca websocket, and using Supabase Broadcast functionality we send this price from back-end to front front-end UI. We also use Supabase Presence for noting # of active app users.

## Backend Database Schema

![Database schema](/docs/images/COMP426-Database-Schema.jpg)

Important design considerations:

The schema centers on user `profiles` and their trading state. Core tables are `profiles`, `transaction`, `position`, `watchlist_items`, `daily_portfolio_snapshot`, and `notification`. `transaction` and `position` should reference `profiles.id` (or `portfolio.id` if you choose to model multiple portfolios per user).

Use fixed-precision numeric types for monetary fields (for example `numeric(18,4)`) and enforce CHECK constraints (e.g., `quantity > 0`, `price >= 0`). Prefer enums for small categorical columns (`transaction.action` ∈ {'buy','sell'}, `notification.type` ∈ {'transaction','watchlist'}) and sensible defaults (for example `notification.is_read` default `false`).

Indexes: add indexes on `user_id`, a compound index on (`user_id`, `symbol`) for per-user per-symbol aggregations, and an index on `date` for snapshot time-range queries to optimize common lookups.

Eventing & realtime: implement transactional Postgres functions/triggers that atomically upsert `position` and append `daily_portfolio_snapshot` on `transaction` inserts so Supabase Realtime can broadcast deterministic, small change events. Make triggers idempotent and execute them inside DB transactions to avoid race conditions.

Auditability & history: include `created_at`, `updated_at`, and `created_by` columns on mutable tables. Consider soft-deletes or a dedicated audit/log table for full historical traceability.

Scaling notes: partition or archive old `daily_portfolio_snapshot` rows if snapshots grow large, and consider read replicas for heavy analytic queries.


## High-Fidelity Prototype
Figma Link: https://www.figma.com/proto/U5lB1L0YPampYrr4Zs0HDj/Untitled?node-id=0-1&t=L4dhuBEg6RutSJ6S-1

![Figma1](/docs/images/Figma1.png)
![Figma2](/docs/images/Figma2.png)
![Figma3](/docs/images/Figma3.png)