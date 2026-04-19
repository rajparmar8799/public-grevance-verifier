# Jan Vishwas: Automated Fraud Detection & Resolution Verification Layer

Team name : InnovateX 
Team ID : 507

## Overview
Jan Vishwas is a comprehensive, AI-powered anti-fraud and verification layer designed specifically to augment existing grievance redressal systems (like the Gujarat Swagat Portal). It ensures that field-level public service resolutions are authentic, verifiable, and citizen-approved.

## Problem Statement
In large-scale public grievance systems, it is difficult for central state authorities to verify if a grievance marked as "Resolved" by a field officer has actually been addressed on the ground. This gap in the procedural loop allows for "paper resolutions"—where complaints are closed without physical intervention, leading to skewed operational statistics and continued citizen distress. 

There is an urgent need for an automated, tamper-proof system to audit these field resolutions at scale without exponentially increasing manual administrative overhead.

## The Solution
Jan Vishwas solves this procedural vulnerability by establishing a zero-trust verification pipeline. Before a grievance can be permanently closed, the system algorithmically audits the officer's submission using spatial, temporal, and direct-citizen data points. High-risk closures are automatically flagged and reopened for senior review.

## Key Features & Implementations

### Spatial Validation (GIS)
Field officers are required to submit their geolocation when marking a case as resolved. The system cross-references the submission coordinates with the original grievance coordinates to calculate the spatial deviance, ensuring the officer was physically present at the site.

### Live Citizen Confirmation (IVR)
Upon resolution submission, the system integrates with telecommunication APIs to initiate an automated Interactive Voice Response (IVR) call directly to the citizen. The citizen can securely press keypad inputs to confirm or dispute the resolution claims, circumventing officer-controlled feedback loops.

### Machine Learning Fraud Detection Engine
An independent Python-based Machine Learning Risk Engine continuously calculates a 'Fraud Risk Score' for every resolution. The model generates this score by analyzing:
*   GPS coordinate mismatch penalties.
*   The upload and forensic validity of photographic evidence.
*   The exact timestamp of the resolution submission.
*   Historical statistical fraud rates associated with the specific operational department.
*   Live IVR confirmation feedback matrices.

If the Risk Score breaches a dynamically governed threshold, the AI automatically overrides the officer and reopens the grievance.

### District Quality Score (Collector Dashboard)
A high-level dashboard interface allows District Collectors and administrators to monitor overall verification success rates, inspect AI-generated risk flags, and manually review disputed resolutions with all corresponding forensic data.

## System Architecture & Tech Stack

*   **Frontend**: HTML5, Vanilla JavaScript, CSS3
*   **Backend Application Server**: Node.js, Express.js
*   **Database**: MongoDB (Mongoose ORM)
*   **Telephony & Communications**: Integrated IVR Webhooks 
*   **Machine Learning API**: Python, Flask, Custom Predictive Models
*   **Security & Authentication**: JWT, bcrypt, Express Session Management

## Core Modules & User Personas

1.  **Citizen Dashboard**: Allows the public to securely submit grievances along with their active phone number and geographic location.
2.  **Department Portal**: Enables internal routing where sub-divisional officers can assign grievances to specific field officers.
3.  **GIS Verification Officer Portal**: The field interface where officers are required to upload site photographs and broadcast their active GPS location to submit a resolution request.
4.  **District Collector Portal**: The oversight interface where administrators can audit the autonomous decisions made by the ML Risk Engine and review the overall health of district departments.

## Setup & Initialization

### Prerequisites
*   Node.js (v16+)
*   Python (3.8+)
*   MongoDB (running locally on port 27017 or remote cluster)

### Bootstrapping the Environment
1. Clone the repository to your local environment.
2. Ensure environment variables are correctly configured for database bridging and communication APIs.
3. Execute the automated bootstrap script to install dependencies, run database seeds, and launch the dual-server architecture:

```bash
run_swagat.bat
```
*(The script will automatically install NPM and PIP packages, launch the core application server, and initialize the ML Analytics Engine on its designated port).* 
