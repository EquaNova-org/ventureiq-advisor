# ⚡ VentureIQ — AI Startup Advisor

**VentureIQ** (*Venture* + *IQ*) is an AI-powered startup advisor that analyzes your business idea and gives you the kind of feedback a seasoned investor, lawyer, and strategist would — instantly.

Upload your pitch deck, business plan, or any startup documents, and VentureIQ breaks down everything you need to know before you build.

---

## What It Does

VentureIQ performs a full 360° analysis of your startup idea across five dimensions:

- 🗺️ **Implementation Plan & Timeline** — MVP phases, 6/12/18-month roadmap, team structure, and technology stack recommendations
- ⚖️ **Legal & Compliance** — Checks your idea against US, EU, and international business law. Returns a clear verdict: `LEGAL`, `REQUIRES ATTENTION`, or `ILLEGAL`
- 📊 **Market Viability & Competition** — TAM/SAM/SOM breakdown, competitor landscape, and differentiation assessment
- 💰 **Funding & Financial Outlook** — Funding strategy, burn rate estimates, revenue model viability, and 3-year financial trajectory
- 🛡️ **Risk Assessment** — Top risks rated by probability and impact, with mitigation strategies

You can run a full analysis in one click, or deep-dive into any single section. After the analysis, ask follow-up questions in the built-in chat — your documents stay in context throughout the conversation.

---

## Tech Stack

- **Frontend:** React + Vite
- **AI:** Anthropic Claude API (`claude-sonnet-4-20250514`)
- **Deployment:** Vercel

---

## Getting Started

1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root and add your Anthropic API key:
   ```
   VITE_ANTHROPIC_API_KEY=your_api_key_here
   ```
4. Run locally:
   ```bash
   npm run dev
   ```

---

## Deployment

This project is deployed on Vercel. To deploy your own instance:

1. Push the repo to GitHub
2. Import it on [vercel.com](https://vercel.com)
3. Add `VITE_ANTHROPIC_API_KEY` as an environment variable in Vercel project settings
4. Deploy

---

## Built By

Ozodbek Maxmudov — [GitHub](https://github.com/EquaNova-org) ·
