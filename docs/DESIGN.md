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

The database schema diagram is shown below. Save the provided image/PDF to `public/docs/` so the file is served by the app (example filename: `public/docs/COMP426-Database-Schema.png`).

![Database schema](/docs/COMP426-Database-Schema.jpg)

Short description — important design considerations:

- Core entities: `users`, `portfolio`, `transaction`, `position`, `watchlist_items`, and `daily_portfolio_snapshot`.
- Referential integrity: use foreign keys from `transaction` and `position` to `portfolio` (or `user`) so portfolio state can be derived reliably.
- Indexes: add indexes on `user_id`, `portfolio_id`, and `ticker` to optimize lookups for watchlists, portfolio aggregation, and charting queries.
- Eventing & realtime: use Postgres triggers or server-side functions to update `position` and append `daily_portfolio_snapshot` on transaction inserts so Supabase Realtime can broadcast small, deterministic change events.
- Normalization & storage: store only canonical state (transactions, positions, snapshots). Do not persist high-frequency market price ticks—fetch them on demand from Alpaca and broadcast via realtime channels.
- Auditability: include audit columns (`created_at`, `updated_at`, `created_by`) on mutable tables to support debugging and user history.
- Scaling notes: partition or archive very old `transaction`/`daily_portfolio_snapshot` rows if you expect long-term growth; consider read replicas for heavy analytic queries.


## High-Fidelity Prototype

<iframe style="border: 1px solid rgba(0, 0, 0, 0.1);" width="800" height="450" src="https://embed.figma.com/design/U5lB1L0YPampYrr4Zs0HDj/Untitled?node-id=0-1&embed-host=share" allowfullscreen></iframe>