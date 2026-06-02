# Data Analysis and Development Suite (DADV)

Welcome to the **DADV** repository. This suite brings together multiple professional applications under one project directory, ranging from academic portal platforms to live disaster monitoring systems and interactive data dashboards.

## 📋 Table of Contents
1. [Suite Overview](#-suite-overview)
2. [Project Structure](#-project-structure)
3. [Technology Stack](#-technology-stack)
4. [Getting Started](#-getting-started)
   - [Prerequisites](#prerequisites)
   - [Backend Configuration & Execution](#backend-configuration--execution)
   - [Frontend & Dashboards Setup](#frontend--dashboards-setup)
5. [Core Modules Detail](#-core-modules-detail)
   - [1. Tutor for All Platform](#1-tutor-for-all-platform)
   - [2. Disaster Weather & ML Module](#2-disaster-weather--ml-module)
   - [3. Social Media Usage Analysis Dashboard](#3-social-media-usage-analysis-dashboard)
6. [Security & Deployment Notes](#-security--deployment-notes)

---

## 🔍 Suite Overview

This repository hosts three primary components:

*   **Tutor for All Platform**: A full-stack (Node.js/Express + Vanilla HTML/CSS/JS) online education platform that manages student registrations, class scheduling, interactive learning assessments, support chat, and mock payment flows.
*   **Disaster Weather Module**: An integrated module in the backend (`/api/weather` and `/disaster`) featuring a Mock Machine Learning prediction engine to assess disaster probability based on real-time weather parameters.
*   **Social Media Usage Analysis Dashboard**: A standalone, premium HTML/Chart.js dashboard alongside a fully integrated **AI Social Media Usage Analysis System** (Streamlit + Machine Learning) to predict addiction risk, analyze user sentiment, and run deep demographic correlations.

---

## 📁 Project Structure

```text
├── backend/                  # Node.js + Express Backend
│   ├── disaster/             # Disaster weather prediction module (routes & models)
│   ├── public/               # Served static front-end assets for Tutor for All
│   ├── db.js                 # Database connection config (Mongoose)
│   ├── server.js             # Main server logic & API endpoints
│   ├── package.json          # Node dependencies & startup scripts
│   └── .env.example          # Environment variables template
├── frontend/                 # "Tutor for All" Frontend
│   └── index.html            # Core client application & landing page
├── social-media-dashboard.html # Standalone Social Media Analysis Dashboard
├── .gitignore                # Git exclusions
├── .env.example              # Root environment variables template
└── README.md                 # Main suite documentation
```

---

## 🛠️ Technology Stack

*   **Frontend**: HTML5 (Semantic Structure), CSS3 (Custom Grid Layouts & Keyframe Animations), Vanilla JavaScript (DOM manipulation, Chart.js for data visualization).
*   **Backend**: Node.js, Express.js (REST API server).
*   **Database**: MongoDB (Mongoose ODM).
*   **Security & Middleware**: JWT (JSON Web Tokens), `bcryptjs` (Password Hashing), `helmet` (HTTP Headers Security), `cors` (Cross-Origin Resource Sharing), `morgan` (Request Logger).
*   **APIs**: OpenWeather API (integrated into the weather model with native mock engine fallback).

---

## 🚀 Getting Started

### Prerequisites
*   [Node.js](https://nodejs.org/) (v16+ recommended)
*   [MongoDB Local Server](https://www.mongodb.com/try/download/community) or [MongoDB Atlas URI](https://www.mongodb.com/cloud/atlas)

---

### Backend Configuration & Execution

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your Environment Variables:
   *   Copy the `.env.example` file and rename it to `.env`:
       ```bash
       cp .env.example .env
       ```
   *   Open `.env` and fill in your settings:
       ```env
       MONGO_URI=mongodb://localhost:27017/myapp
       PORT=5000
       OPENWEATHER_API_KEY=your_openweathermap_api_key_here
       ```

4. Start the backend server:
   ```bash
   npm start
   ```
   *The console will log:*
   ```text
   ✅ MongoDB Connected : localhost
   🚀 Server running at http://localhost:5000
   ```

---

### Frontend & Dashboards Setup

*   **Tutor for All**: Open the client files located in the `/frontend` directory or run the server which serves them directly on `http://localhost:5000/`.
*   **Disaster Weather UI**: Access the UI directly at `http://localhost:5000/disaster`.
*   **Social Media Dashboard (Direct)**: Open `social-media-dashboard.html` directly in any web browser to view the interactive charts and metrics.
*   **Social Media Dashboard (Streamlit)**:
    1. Install Streamlit dependencies:
       ```bash
       pip install -r requirements.txt
       ```
    2. Run the Streamlit dashboard locally:
       ```bash
       streamlit run app.py
       ```

---

### ☁️ Streamlit Community Cloud Deployment

To host the interactive Social Media Dashboard online for free:
1. Log in to [Streamlit Community Cloud](https://share.streamlit.io/).
2. Click **Create app** and connect your GitHub account.
3. Select this repository (`DADV`), branch (`main`), and set the main file path to `app.py`.
4. Click **Deploy!** Streamlit will automatically install dependencies from `requirements.txt` and host your dashboard.

---

## 📦 Core Modules Detail

### 1. Tutor for All Platform
*   **Authentication & Roles**: Separate workflows and dashboard views for Students, Tutors, and Administrators.
*   **Interactive Assessments**: Students can test their knowledge in custom quizzes, submit scores, and track progress over time.
*   **Live Chat Room**: Built-in support room (`roomId: "support-<userId>"`) for direct support communications.
*   **Billing & Subscriptions**: Mock payment flows (Pro, Basic, and Elite tiers) to simulate commercial platform transactions.

### 2. Disaster Weather & ML Module
*   **Real-time Monitoring**: Fetches actual conditions using OpenWeather API. If no API key is specified, it gracefully degrades to a simulated sensor data engine.
*   **Predictive ML Model**: Uses custom algorithms in `mlEngine.js` to estimate threat levels for extreme events (Cyclones, Floods, Heatwaves) based on parameters like wind speed, humidity, and temperature.

### 3. Social Media Usage Analysis Dashboard & ML System
*   **Standalone Premium Frontend**: Utilizes Chart.js to render bubble charts, multi-line charts, platform distribution donuts, and horizontal bar charts.
*   **Interactive Streamlit & ML App**: Implements an advanced Machine Learning suite to train models (Random Forest, Gradient Boosting, Logistic Regression) on the fly and compare their cross-validation accuracies, ROC curves, feature importances, and confusion matrices.
*   **Live Sentiment Analytics**: Uses TextBlob to classify simulated emotional feedback and sentiment polarity per platform.
*   **Addiction Risk Predictor**: Allows users to input usage variables (hours, sessions, notifications, sleep, etc.) to get an instant addiction risk percentage and personalized healthy habit recommendations.

---

## 🔒 Security & Deployment Notes

*   **Secrets Safeguard**: Never commit `.env` or configuration files containing credentials. They are ignored by the root `.gitignore`.
*   **Production Build**: For staging or production deployments, configure `CORS` origins in `backend/.env` under the `CLIENT_URL` variable to restrict API consumption strictly to authorized domains.
