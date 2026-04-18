# Swagat Grievance Resolution Verifier 🏛️🤖

An intelligent, AI-assisted verification layer integrated into the **Swagat Portal** to ensure every public grievance resolution is authentic, physically verified, and citizen-approved.

## 🚀 The Problem
Many transparency platforms suffer from "Paper Resolutions"—where grievances are marked as resolved in the system without actual ground action. This project solves that by adding a mandatory **Physical & Digital Audit Loop**.

## ✨ Key Features
- **🤖 ML Fraud Detection**: A Python AI engine (RandomForest) that analyzes GPS logs, photo metadata, and citizen responses to calculate a **Resolution Risk Score**.
- **📍 GIS-Tagged Evidence**: Field Officers must submit site photos with real-time GPS coordinates. The system automatically flags mismatches over 500m from the complaint site.
- **📞 Automated IVR Confirmation**: Simulates an automated call to the citizen to confirm satisfaction. Disputes by citizens trigger an automatic **Auto-Reopen**.
- **📊 Collector Dashboard**: Real-time "Department Quality Scores" and audit trails for the District Collector to monitor administrative performance.
- **💎 Premium Zinc Theme**: A high-end, glassmorphism-based UI designed for mission-critical government operations.

## 🛠️ Technology Stack
- **Backend**: Node.js, Express, EJS, MongoDB (Mongoose)
- **AI/ML**: Python 3.11, Flask, Scikit-Learn, Pandas
- **Icons**: Lucide Icons
- **Design**: Vanilla CSS with Glassmorphism & Zinc design system

## ⚡ One-Click Startup (For Team Members)
We've made it easy for the team to run the project. Simply:
1. Ensure **Node.js**, **Python**, and **MongoDB** are installed and running.
2. Double-click the `run_swagat.bat` file in the root directory.

**What the script does:**
- Synchronizes all `npm` and `pip` dependencies.
- Wipes the database and initializes it with fresh **Seed Data** for testing.
- Launches the **Node Server (Port 3000)** and **Python API (Port 5001)**.
- Opens the portal in your default browser.

## 👥 Personas
Use the **"Demo Access"** tab on the home page to switch between:
1. **Citizen**: File complaints and track verification.
2. **Department**: Mark issues as resolved to trigger verification.
3. **Field Officer**: Submit on-site photo and GIS evidence.
4. **Collector**: Audit the entire resolution chain and view department rankings.

---
*Built for the Swagat Portal Hackathon - Ensuring accountability through technology.*
