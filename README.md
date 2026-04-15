# GS-ELS-2026
Our project for Goldman Sachs ELS program: [https://mutual-fund-calc.vercel.app/](https://mutual-fund-calc.vercel.app/)

This repo is a with:
- **backend/**: Spring Boot REST API (Java)
- **frontend/**: React (Vite + TypeScript) web app

The current implementation is a **clean scaffold**:
- Frontend collects inputs (tickers, risk tolerance, horizon, amount) and calls the backend.
- Backend returns a **stub recommendation** (currently equal-weight allocation). This will be replaced with real optimization + market data + AI explanation.

---

## Repo Structure
GS-ELS-2026/
    backend/ # Spring Boot API
    frontend/ # React UI (Vite)
    README.md

## Prerequisites

### Backend
- **Java**: JDK 17+ (recommended: 21 if you have it)
- (Optional) Maven installed — not required if you use the included Maven Wrapper (`./mvnw`)

### Frontend
- **Node.js**: 18+ (recommended: 20+)
- npm comes with Node

Check versions:
```bash
java -version
node -v
npm -v
```

## Quickstart (Local Development)

### 1) Start the backend (Spring Boot API)

```bash
cd backend
./mvnw spring-boot:run
```

Backend will start on: http://localhost:8080
Quick test: curl http://localhost:8080/api/health
Expected: {"status":"ok"}


## 2) Start the frontend (React + Vite)

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend will start on: http://localhost:5173 (Vite default)

## 3) Create an account (Optional)

You can setup an account with Clerk Auth using your personal email, put in your preferences and your account will be created and stored in our backend database.

## 4) Additional AI Features (Optional)

You can replace the dummy API key (openai.api.key) with your own OpenAPI key in the backend/src/main/resources/application.properties file.

# How Frontend ↔ Backend Communication Works

## Request Flow

1.  User enters:
    -   tickers (e.g., AAPL MSFT VTI)
    -   risk tolerance (0..1 slider)
    -   horizon years
    -   investment amount
2.  Frontend sends a POST request to:

POST /api/portfolio/recommend

3.  Backend returns JSON with:
    -   suggested allocations (list of { ticker, weight })
    -   expected return (stub value right now)
    -   volatility (stub value right now)
    -   explanation text (stub text right now)


## Portfolio Recommendation (Stub)

POST /api/portfolio/recommend

Example request:

```bash
curl -X POST http://localhost:8080/api/portfolio/recommend\
-H "Content-Type: application/json"\
-d '{ "tickers": \["AAPL", "MSFT", "VTI"\], "riskTolerance": 0.5,
"horizonYears": 5, "investmentAmount": 10000 }'
```

Example response:

{ "allocations": \[ { "ticker": "AAPL", "weight": 0.3333333333 }, {
"ticker": "MSFT", "weight": 0.3333333333 }, { "ticker": "VTI", "weight":
0.3333333333 } \], "expectedReturn": 0.08, "volatility": 0.15,
"explanation": "Stub recommendation: equal-weight allocation..." }

# Backend Overview (Spring Boot)

The backend uses a layered architecture:

-   controller/ --- HTTP endpoints
-   service/ --- business logic
-   dto/ --- request/response payloads

Java structure:

backend/src/main/java/com/gs/mutualfundcalc/

-   MutualfundcalcApplication.java\
-   controller/
    -   HealthController.java\
    -   PortfolioController.java\
-   dto/
    -   PortfolioRequest.java\
    -   PortfolioRecommendation.java\
-   service/
    -   PortfolioService.java

# What Each Java File Does

MutualfundcalcApplication.java\
Entry point of the Spring Boot app. Enables auto-configuration and
starts the embedded server.

HealthController.java\
Exposes GET /api/health to verify the backend is running.

PortfolioController.java\
Handles POST /api/portfolio/recommend.\
Receives PortfolioRequest and returns PortfolioRecommendation.

PortfolioRequest.java\
Defines the structure of incoming frontend requests: - tickers
(List`<String>`{=html}) - riskTolerance (double) - horizonYears (int) -
investmentAmount (double)

PortfolioRecommendation.java\
Defines backend response structure: - allocations - expectedReturn -
volatility - explanation

PortfolioService.java\
Contains business logic.\
Currently returns equal-weight allocation as a stub.\
Will later include optimization, risk modeling, and AI explanation.

# Frontend Overview (React + Vite + TypeScript)

Key files:

frontend/src/App.tsx\
Main UI and API call logic.

frontend/src/main.tsx\
React entry point.

frontend/vite.config.ts\
Dev server configuration including proxy.

frontend/package.json\
Dependencies and scripts.

# Running Scripts

From frontend/:

npm run dev --- Start dev server
npm run build --- Build production bundle
npm run preview --- Preview production build


# Roadmap

1.  Replace stub allocation with real allocation logic
2.  Add market data client layer
3.  Add caching
4.  Add persistence only if needed
5.  Add backtesting dashboard
6.  Integrate OpenAI explanation service
