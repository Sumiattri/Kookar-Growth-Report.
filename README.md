# 📈 Marketing Growth Analytics Dashboard

An automated business intelligence dashboard that consolidates **Meta Ads**, **lead generation**, and **user onboarding** data into a single reporting platform. The dashboard enables marketing teams to monitor campaign performance, analyze conversion funnels, and make data-driven growth decisions.

---

## 🚀 Overview

Marketing data often exists across multiple platforms, making campaign analysis time-consuming and error-prone. This project automates the process by extracting data from multiple sources, transforming it into meaningful business metrics, and presenting it through an interactive dashboard.

The dashboard refreshes automatically using GitHub Actions, ensuring stakeholders always have access to the latest campaign insights.

---

## ✨ Features

- 📊 Campaign Performance Dashboard
- 📈 Marketing KPI Reporting
- 🔄 Automated ETL Pipeline
- 🎯 Conversion Funnel Analysis
- 👥 Cohort Analysis
- 💰 Customer Acquisition Cost (CAC)
- 📱 Landing Page Performance Comparison
- 🚀 Paid vs Organic Traffic Analysis
- ⏰ Automated Data Refresh
- 📉 Campaign-wise Conversion Tracking

---

## 📊 Key Metrics

The dashboard tracks:

- Ad Spend
- Impressions
- Clicks
- Click Through Rate (CTR)
- Leads Generated
- Qualified Leads
- WhatsApp Redirects
- User Onboardings
- Completed Onboardings
- Conversion Rate
- Cost per Lead (CPL)
- Customer Acquisition Cost (CAC)

---

## 🏗️ Architecture

```
                 Meta Ads API
                       │
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
 Growth Supabase DB          Live Supabase DB
        │                             │
        └──────────────┬──────────────┘
                       │
                       ▼
             ETL Processing Script
     (Cleaning • Transformation • Aggregation)
                       │
                       ▼
                public/data.json
                       │
                       ▼
          Interactive Analytics Dashboard
                       │
                       ▼
               GitHub Pages Deployment
```

---

## 🛠 Tech Stack

### Frontend

- HTML
- CSS
- JavaScript (ES Modules)

### Backend / Data

- Supabase
- Meta Ads Graph API

### Automation

- GitHub Actions

### Deployment

- GitHub Pages

---

## 📂 Project Structure

```
kookar-growth-report/
│
├── public/
│   ├── index.html
│   ├── data.json
│   └── assets/
│
├── generate-growth-report-data.mjs
├── package.json
├── package-lock.json
│
└── .github/
    └── workflows/
```

---

## ⚙️ Workflow

1. Fetch campaign data from Meta Ads API.
2. Retrieve lead information from Growth Supabase.
3. Retrieve onboarding information from Live Supabase.
4. Clean and transform datasets.
5. Merge business metrics.
6. Calculate KPIs.
7. Generate `data.json`.
8. Deploy updated dashboard automatically.

---

## 📈 Business Insights

The dashboard helps answer questions like:

- Which advertising campaigns generate the highest-quality leads?
- Which landing pages convert best?
- What is the customer acquisition cost?
- Where are users dropping off in the onboarding funnel?
- How effective are paid campaigns compared to organic traffic?
- Which marketing channels produce the highest ROI?

---

## 📌 Dashboard Capabilities

- Campaign Performance Monitoring
- Funnel Analysis
- Cohort Analysis
- Conversion Tracking
- KPI Reporting
- Landing Page Comparison
- Marketing Performance Analytics
- Automated Business Reporting

---

## 🔄 Automation

The reporting pipeline is fully automated using **GitHub Actions**, allowing scheduled data refreshes without manual intervention.

```
GitHub Actions
      │
      ▼
Fetch Data
      │
      ▼
Transform & Aggregate
      │
      ▼
Generate data.json
      │
      ▼
Deploy Dashboard
```

---

## 💡 Skills Demonstrated

- Data Analysis
- ETL Pipeline Development
- Business Intelligence
- Marketing Analytics
- KPI Dashboarding
- Funnel Analysis
- Cohort Analysis
- Data Integration
- API Integration
- Report Automation
- Growth Analytics

---

## 🎯 Use Cases

- Marketing Performance Monitoring
- Growth Analytics
- Campaign Optimization
- Executive KPI Reporting
- Customer Acquisition Analysis
- Product Growth Decision Making

---

## 📄 License

This project is intended for educational and portfolio purposes.
