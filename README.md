# 🎉 Celebration Planner

> GenAI-powered planning assistant that helps users organize **weddings**, **birthdays**, and **community events** with smart budgets, milestone timelines, vendor checklists, and personalized ideas.  
> Built from scratch for **Hack2Skill PromptWars Challenge 5**.

![Tech Stack](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Vite](https://img.shields.io/badge/Vite-5-purple) ![Tailwind](https://img.shields.io/badge/Tailwind-3-teal) ![Express](https://img.shields.io/badge/Express-4-green) ![Mongoose](https://img.shields.io/badge/MongoDB-Atlas-brightgreen) ![Gemini](https://img.shields.io/badge/Gemini-AI-orange) ![Vitest](https://img.shields.io/badge/Vitest-Passing-success)

---

## ✨ Key Features

1. **🌟 Bespoke AI Inspiration & Concept Generator**:
   - Generates tailored theme aesthetics, sensory details, food & beverage concepts, signature entertainment, and keepsakes.
   - Powered by **Google Gemini API** (`gemini-1.5-flash`) on the server with intelligent domain fallbacks.
   - Quick inspiration prompts and one-click refresh.

2. **💰 Deterministic Budget Calculator & Expense Tracker**:
   - Automatic percentage-based allocations tailored to event type (Weddings, Birthdays, Community Events).
   - Real-time spend analytics, budget health bar, and paid vs. unpaid status toggle.
   - Itemized expense management (add, edit, delete, mark paid).

3. **⏳ Milestone Timeline & Task Countdown**:
   - Chronological checklist relative to your target celebration date (e.g., 4+ months before, 60 days, 30 days, 10 days, Day-of).
   - Interactive milestone checkboxes with dynamic completion progress percentage.
   - Add custom tasks with target due dates.

4. **📋 Vendor Checklist & Pipeline**:
   - Category-organized vendor directory (Venue, Catering, Photography, Floral, Music/DJ).
   - Status pipeline: `Not Contacted` ➔ `Contacted` ➔ `Quote Received` ➔ `Booked` ➔ `Cancelled`.
   - Contact records, estimated costs vs. confirmed costs tracking.

5. **🤖 Celebration AI Assistant (Interactive Chat)**:
   - Dedicated event consultant context-aware of your date, venue, guest count, and budget.
   - Sample prompt shortcuts: "Draft vendor inquiry email", "Suggest budget cuts", "Generate reception schedule", "Icebreaker games".

6. **📁 Celebration Portfolio & Export**:
   - View all your planned events in one place with countdowns and quick status metrics.
   - One-click JSON export for offline backups and printing.

---

## 🏛️ Architecture & Project Structure

```
celebration-planner/
├── client/                     ← React 18 + Vite + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/         ← Navbar, Footer, PageLayout
│   │   │   ├── ui/             ← Button, Badge, Card, Spinner, Input
│   │   │   └── wizard/         ← 4-step event creation wizard
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── CreateEventPage.tsx
│   │   │   ├── EventDashboardPage.tsx  ← Rich 5-tab planning hub
│   │   │   ├── EventsListPage.tsx      ← Portfolio of saved celebrations
│   │   │   └── NotFoundPage.tsx
│   │   ├── lib/                ← Type-safe API client & utilities
│   │   └── __tests__/          ← Client unit tests
├── server/                     ← Express + TypeScript API backend
│   ├── src/
│   │   ├── config/env.ts       ← Zod-validated environment config
│   │   ├── db/connection.ts    ← MongoDB Atlas + graceful In-Memory fallback
│   │   ├── models/             ← Mongoose Event model matching shared schema
│   │   ├── routes/             ← /api/events & /api/health routes
│   │   ├── services/
│   │   │   ├── aiService.ts    ← Server-side Gemini AI + domain generator
│   │   │   └── eventStore.ts   ← Unified event repository
│   │   └── middleware/         ← Error handler, request logger
│   └── tests/                  ← Vitest integration tests for API & AI
├── shared/                     ← Shared TypeScript types & Zod validation schemas
│   └── src/schemas/            ← Event, Budget, Timeline, Vendor, AI schemas
├── .env.example
├── package.json                ← Monorepo root with npm workspaces
└── README.md
```

---

## 🔒 Security & Best Practices

- **Zero Client-Side Secret Leakage**: The Google Gemini API key and MongoDB credentials are exclusively stored in server-side environment variables and are never transmitted to the frontend.
- **Runtime Zod Validation**: Strict validation schemas on every input payload, rejecting malformed requests with `400 Bad Request`.
- **Hardened HTTP Headers**: Protected using `helmet` security middleware.
- **Strict CORS Policy**: Restricted cross-origin requests to configured frontend origins.
- **Graceful Fallback Design**: Works out-of-the-box with or without MongoDB Atlas / Gemini API keys, ensuring reliable evaluation and offline demos.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** ≥ 20.0.0
- **npm** ≥ 10.0.0

### 2. Installation
```bash
git clone <repo-url>
cd celebration-planner
npm install
```

### 3. Environment Configuration
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Key variables:
```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
# Optional: MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/celebration-planner
# Optional: Google Gemini API key
GEMINI_API_KEY=your_gemini_api_key_here
```
*(If `MONGODB_URI` or `GEMINI_API_KEY` are omitted, the application seamlessly runs using its In-Memory store and built-in domain AI planning engine!)*

### 4. Running the Application
```bash
# Start both client and server concurrently:
npm run dev
```
- **Client**: [http://localhost:5173](http://localhost:5173)
- **API Server**: [http://localhost:3001](http://localhost:3001)
- **Health Check**: [http://localhost:3001/api/health](http://localhost:3001/api/health)

---

## 🧪 Testing

Run automated tests across all workspaces:
```bash
npm run test
```
All **20/20 test cases** pass:
- **Server Tests**: Health endpoint, 404 handler, event creation with AI generation, budget item CRUD, timeline milestone toggling, vendor status pipeline, and AI assistant inquiries.
- **Client Tests**: Currency formatting, date formatting, Tailwind utility merge, and event type normalization.

---

## 📦 Building for Production

```bash
npm run build
```
Builds the `shared` type library, compiles client assets with `vite build`, and compiles the server with `tsc`.

---

## 🚀 Deployment Guide — Unified Frontend & Backend on Vercel

Celebration Planner is configured for a single, unified deployment on **Vercel** where both the frontend React SPA and Express API run under the **same project and domain**:
- **Frontend**: `https://your-project.vercel.app/`
- **Backend API**: `https://your-project.vercel.app/api/...`

### 1. Import Project to Vercel
1. Go to [vercel.com](https://vercel.com) and click **"Add New..."** > **"Project"**.
2. Select your repository: `santhoshdesu23/celebration-planner`.
3. In **Project Settings**:
   - **Root Directory**: `./` (leave as repository root)
   - **Framework Preset**: Vite (or Other)
   - **Build Command**: `npm run build` *(Pre-configured via `vercel.json`)*
   - **Output Directory**: `client/dist` *(Pre-configured via `vercel.json`)*

### 2. Configure Environment Variables in Vercel
In **Vercel Project Settings > Environment Variables**, configure the server-side environment variables:

| Variable | Required | Description | Example |
|---|---|---|---|
| `NODE_ENV` | Yes | Runtime environment | `production` |
| `JWT_SECRET` | Yes | 32+ char secret for JWT authentication | `your-secure-random-jwt-secret-key-32chars` |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/celebration-planner` |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for AI generation | `AIzaSy...` (falls back to deterministic AI engine if omitted) |
| `CORS_ORIGIN` | Optional | Canonical production origin | `https://your-project.vercel.app` *(Vercel domains auto-whitelisted)* |

> **Note on Client Variables**: You do **NOT** need to set `VITE_API_BASE_URL`. Because the frontend and backend run on the exact same domain, the frontend automatically makes same-origin relative calls to `/api/...`, ensuring seamless HttpOnly cookie delivery without third-party cookie restrictions.

### 3. Serverless Lifecycle & Durability
- **Serverless Entrypoint**: [api/index.ts](file:///c:/Users/santh/celebration-planner/api/index.ts) provides a serverless wrapper that lazily connects to MongoDB Atlas and reuses the connection across warm function invocations.
- **On-Demand AI State Driving**: In serverless environments, background promises freeze once HTTP responses return. If an AI plan is pending or interrupted when a user navigates to the event, the `/api/events/:id/ai-status` polling endpoint actively claims and executes the generation to completion, guaranteeing no jobs are lost or stuck. Deterministic fallbacks guarantee instant completion if external LLM APIs fail.

