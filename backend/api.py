"""
Adversarial AI Firewall - FastAPI Backend
Real-time adversarial detection for military drones
"""

import os
import torch
import torch.nn as nn
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from torchvision import transforms
import io
import numpy as np

# ============================================================
# CONFIGURATION
# ============================================================
BASE_DIR = "D:/PROJECTS/AI_Firewall_For_Drones"
IMG_SIZE = 128
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

print(f"Using device: {DEVICE}")

# ============================================================
# FIREWALL AI MODEL (Custom CNN - Same architecture as training)
# ============================================================
class FirewallAI(nn.Module):
    def __init__(self):
        super(FirewallAI, self).__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d((1, 1))
        )
        self.classifier = nn.Sequential(
            nn.Linear(256, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(0.4),
            nn.Linear(128, 64),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        x = self.cnn(x)
        x = x.view(x.size(0), -1)
        return self.classifier(x)

# ============================================================
# LOAD MODELS
# ============================================================
print("\n📦 Loading models...")

# Load Firewall AI (from root directory)
firewall_path = f"{BASE_DIR}/firewall_cnn.pth"
firewall_model = FirewallAI().to(DEVICE)

if os.path.exists(firewall_path):
    firewall_model.load_state_dict(torch.load(firewall_path, map_location=DEVICE))
    firewall_model.eval()
    print(f"✅ Firewall AI loaded from {firewall_path}")
else:
    print(f"❌ Firewall model not found at {firewall_path}")

# Image preprocessing
transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ============================================================
# CREATE FASTAPI APP
# ============================================================
app = FastAPI(title="Adversarial AI Firewall", description="Real-time adversarial detection for military drones")

# Enable CORS (allows frontend to connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# API ENDPOINTS
# ============================================================
@app.get("/")
async def root():
    return {"message": "Adversarial AI Firewall API", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": os.path.exists(firewall_path)}

@app.post("/api/predict")
async def predict(file: UploadFile = File(...)):
    """Predict if an image contains an adversarial attack"""
    try:
        # Read image
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert('RGB')
        
        # Preprocess
        img_tensor = transform(img).unsqueeze(0).to(DEVICE)
        
        # Predict using Firewall AI
        with torch.no_grad():
            output = firewall_model(img_tensor)
            confidence = output.item()
            prediction = 1 if confidence > 0.5 else 0
        
        return {
            "success": True,
            "prediction": prediction,
            "confidence": confidence,
            "alert": prediction == 1,
            "message": "🚨 ATTACK DETECTED!" if prediction == 1 else "✅ CLEAN - Safe"
        }
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

@app.get("/api/metrics")
async def get_metrics():
    return {
        "model": "Firewall AI (Custom CNN)",
        "input_size": f"{IMG_SIZE}x{IMG_SIZE}",
        "parameters": 430593,
        "status": "ready"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
  