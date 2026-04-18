#!/bin/bash

# Configuration
PROJECT_ID="capable-matrix-493314-n0"
REGION="us-central1"
BACKEND_SERVICE="prompt-wars-backend"
FRONTEND_SERVICE="prompt-wars-frontend"

BACKEND_SA_NAME="prompt-wars-backend-sa"
FRONTEND_SA_NAME="prompt-wars-frontend-sa"
BACKEND_SA_EMAIL="${BACKEND_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
FRONTEND_SA_EMAIL="${FRONTEND_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "🚀 Starting Deployment for Prompt Wars..."

# 1. Set the active project
echo "📍 Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# 2. Enable necessary Google Cloud APIs
echo "🔌 Enabling required APIs (Firestore, Cloud Run, Artifact Registry, Vertex AI)..."
gcloud services enable \
    firestore.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    aiplatform.googleapis.com \
    iam.googleapis.com

# 3. Initialize Firestore Database (if it doesn't exist)
echo "🗄️  Ensuring Firestore Database is initialized..."
gcloud firestore databases create --location=$REGION --type=firestore-native 2>/dev/null || echo "Firestore Database already initialized."

# 4. Create Service Accounts
echo "🔐 Creating Service Accounts..."
gcloud iam service-accounts create $BACKEND_SA_NAME \
    --display-name="Prompt Wars Backend SA" 2>/dev/null || echo "Backend SA already exists."

gcloud iam service-accounts create $FRONTEND_SA_NAME \
    --display-name="Prompt Wars Frontend SA" 2>/dev/null || echo "Frontend SA already exists."

# 4. Grant IAM Permissions
echo "🛡️  Binding IAM roles for the Service Accounts..."

# Backend permissions: Firestore and Vertex AI
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$BACKEND_SA_EMAIL" \
    --role="roles/datastore.user" >/dev/null

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$BACKEND_SA_EMAIL" \
    --role="roles/aiplatform.user" >/dev/null

# (Optional: Log writer is granted by default on Cloud Run, but added for explicit completion)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$BACKEND_SA_EMAIL" \
    --role="roles/logging.logWriter" >/dev/null

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$FRONTEND_SA_EMAIL" \
    --role="roles/logging.logWriter" >/dev/null

# 5. Deploy the Backend
echo "📦 Deploying Backend to Cloud Run..."
gcloud run deploy $BACKEND_SERVICE \
    --source ./backend \
    --region $REGION \
    --allow-unauthenticated \
    --service-account $BACKEND_SA_EMAIL \
    --set-env-vars PROJECT_ID=$PROJECT_ID \
    --quiet

# 6. Get the Backend URL
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format='value(status.url)')
echo "✅ Backend is live at: $BACKEND_URL"

# 7. Deploy the Frontend
# We pass the Backend URL as an environment variable so the Next.js app knows where to send requests.
echo "🎨 Deploying Frontend to Cloud Run..."
gcloud run deploy $FRONTEND_SERVICE \
    --source ./frontend \
    --region $REGION \
    --allow-unauthenticated \
    --service-account $FRONTEND_SA_EMAIL \
    --set-env-vars API_URL=$BACKEND_URL \
    --quiet

# 8. Get the Frontend URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region $REGION --format='value(status.url)')

echo "--------------------------------------------------------"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "--------------------------------------------------------"
echo "Backend:  $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo "--------------------------------------------------------"
echo "Next Step: Visit the Frontend URL to launch your Agentic Kitchen!"
