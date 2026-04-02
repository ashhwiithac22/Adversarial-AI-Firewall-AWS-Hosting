from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import torch
from PIL import Image
from torchvision import transforms
import io
import os
import sys

# Add models/firewall to path to import model
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "firewall"))
from firewall_model import AdversarialFirewall

app = FastAPI(title="AI Firewall for Drone Object Detection")

# Enable CORS for frontend interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
IMG_SIZE = 128

# Global Model Variable
model = None

@app.on_event("startup")
async def load_model():
    global model
    model = AdversarialFirewall().to(device)
    model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "firewall", "best_model.pth")
    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, map_location=device))
        model.eval()
        print(f"✅ Model loaded successfully from {model_path}")
    else:
        print("⚠️ Model weights not found. Prediction results will be based on random weights until trained.")

# Image Preprocessing
transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
])

@app.get("/health")
async def health():
    return {"status": "operational", "device": str(device)}

@app.post("/api/predict")
async def predict(file: UploadFile = File(...)):
    try:
        # Read image
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert('RGB')
        img_tensor = transform(img).unsqueeze(0).to(device)
        
        # Simulation: Extract telemetry features (15 items)
        # In a real drone, these would come from the sensor suite
        telemetry = torch.randn(1, 15).to(device)
        
        # Run Inference
        with torch.no_grad():
            output = model(img_tensor, telemetry)
            confidence = output.item()
            is_adversarial = confidence > 0.5
            
        return {
            "is_adversarial": bool(is_adversarial),
            "confidence": float(confidence),
            "prediction": "ADVERSARIAL ATTACK" if is_adversarial else "CLEAN IMAGE",
            "threat_level": "CRITICAL" if is_adversarial else "NONE",
            "action": "BLOCKING / RE-SCANNING" if is_adversarial else "PROCEEDING"
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/stats")
async def get_stats():
    # Mock stats for dashboard
    return {
        "total_checks": 1542,
        "threats_neutralized": 84,
        "system_status": "SECURE",
        "last_scan": "0.4ms"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
