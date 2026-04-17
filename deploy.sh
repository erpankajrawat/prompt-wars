#!/bin/bash

# Configuration
PROJECT_ID="capable-matrix-493314-n0"
REGION="us-central1"
BACKEND_SERVICE="prompt-wars-backend"
FRONTEND_SERVICE="prompt-wars-frontend"

echo "🚀 Starting Deployment for Prompt Wars..."

# 1. Set the active project
echo "📍 Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# 2. Enable necessary Google Cloud APIs
echo "🔌 Enabling required APIs (Firestore, Cloud Run, Artifact Registry)..."
gcloud services enable \
    firestore.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com

# 3. Deploy the Backend
echo "📦 Deploying Backend to Cloud Run..."
gcloud run deploy $BACKEND_SERVICE \
    --source ./backend \
    --region $REGION \
    --allow-unauthenticated \
    --quiet

# 4. Get the Backend URL
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format='value(status.url)')
echo "✅ Backend is live at: $BACKEND_URL"

# 5. Deploy the Frontend
# We pass the Backend URL as an environment variable so the Next.js app knows where to send requests.
echo "🎨 Deploying Frontend to Cloud Run..."
gcloud run deploy $FRONTEND_SERVICE \
    --source ./frontend \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars NEXT_PUBLIC_API_URL=$BACKEND_URL \
    --quiet

# 6. Get the Frontend URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region $REGION --format='value(status.url)')

echo "--------------------------------------------------------"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "--------------------------------------------------------"
echo "Backend:  $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo "--------------------------------------------------------"
echo "Next Step: Visit the Frontend URL to launch your Agentic Kitchen!"
