# Intelligent Concession & Retail Management System

Welcome to the Intelligent Concessions, Retail Management, and Virtual Queuing solution. This repository contains a comprehensive Agentic AI system that redefines stadium and event purchasing.

## Features

- **Multi-Agent Architecture:** Powered by Google's Agent Development Kit (ADK) utilizing A2A protocol.
  - **Ordering Agent**: Handles incoming user orders.
  - **Optimization Agent**: Maximizes kitchen throughput and estimates dynamic wait times.
  - **Notification Agent**: Issues alerts 5 minutes prior to order readiness.
- **Mobile Web App:** Attendees can place orders and track the exact remaining time to pickup natively in the browser.
- **Big Screen UI:** Digital signs reflecting order number-based readiness and live restroom/concession wait times.
- **Cashierless Vision Checkout:** Simulated overhead cameras with Gemini Vision identifying "grab and go" merchandise from uploaded photos.
- **QR Code Kiosk:** Secure order retrieval via QR code scanning.

---

## 1. How to Test the Solution Locally

To test locally, you will need to run the Python backend (swarms & API) and the Next.js frontend (UI elements).

### Backend (Python/FastAPI) setup:
1. Ensure you have Python 3.9+ installed.
2. Navigate to the `backend/` directory:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
3. Copy the `.env.example` file to `.env` and configure your credentials (e.g. Firebase credentials, Google API key for ADK).
4. Start the backend development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *The backend will now be processing A2A agent logic at `http://localhost:8000`.*

### Frontend (Next.js) setup:
1. Ensure you have Node.js 18+ installed.
2. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   npm install
   ```
3. Link the frontend to your local backend inside the `.env.local` file:
   `NEXT_PUBLIC_API_URL=http://localhost:8000`
4. Start the frontend:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000` in your browser.

---

## 2. Deploying to Google Cloud Run

This application is designed specifically for containerized deployment on Google Cloud Run. Both frontend and backend include respective `Dockerfile`s.

### Prerequisites
- Install the Google Cloud SDK (`gcloud`).
- Authenticate via `gcloud auth login`.
- Set your Google Cloud project: `gcloud config set project [YOUR-PROJECT-ID]`.

### Deploying the Backend:
1. Navigate to `backend/`.
2. Build and submit the image to Google Artifact Registry:
   ```bash
   gcloud builds submit --tag gcr.io/[YOUR-PROJECT-ID]/concession-backend
   ```
3. Deploy to Cloud Run:
   ```bash
   gcloud run deploy backend-service --image gcr.io/[YOUR-PROJECT-ID]/concession-backend --platform managed --allow-unauthenticated
   ```

### Deploying the Frontend:
1. Update your production `.env` to point `NEXT_PUBLIC_API_URL` to your newly deployed backend Cloud Run URL.
2. Navigate to `frontend/`.
3. Submit the build:
   ```bash
   gcloud builds submit --tag gcr.io/[YOUR-PROJECT-ID]/concession-frontend
   ```
4. Deploy the frontend Service:
   ```bash
   gcloud run deploy frontend-service --image gcr.io/[YOUR-PROJECT-ID]/concession-frontend --platform managed --allow-unauthenticated
   ```

---

## 3. How the End-User Uses It

The platform exposes several routes designed for different touchpoints during a stadium event:

### Mobile Ordering & Queuing (Attendee View)
- The user hits the primary web URL on their phone.
- **Ordering:** They select food out of the UI, enter their phone number, and receive an OTP (mocked during testing—the code displays securely in the console or UI notification).
- **Virtual Queue:** They are presented with a live "remaining time to pickup" countdown.
- **QR Ticket:** A digital QR code acts as their receipt.

### Cashierless Checkout Simulation
- For "grab-and-go" retail, the user heads to the `/vision-checkout` page.
- Instead of using physical ceiling cameras, the user uploads an image simulating a top-down view of items they picked up.
- The Gemini Agent scans the frame, processes the bill automatically, and checks them out.

### Display Screens & Kiosks
- **Stadium Screens (`/display`):** Shows live, dynamically calculated wait times for various zones (e.g., Section 102 Concession) and order number completion statuses (e.g. "Now Serving: 45, 46, 47").
- **Vendor/Worker Kiosk (`/kiosk`):** Concession workers use this page to face their device camera at a customer. They scan the customer's QR code, clearing out the completed order from the Kitchen Optimization Agent's active queue.
