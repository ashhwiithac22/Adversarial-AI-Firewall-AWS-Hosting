"""
Adversarial AI Firewall - FastAPI Backend with Hugging Face RAG
"""

import os
import torch
import torch.nn as nn
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from torchvision import transforms
import io
from pathlib import Path
from dotenv import load_dotenv
import requests

# Load environment variables
load_dotenv()

# ============================================================
# CONFIGURATION
# ============================================================
BASE_DIR = "D:/PROJECTS/AI_Firewall_For_Drones"
IMG_SIZE = 128
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")

print(f"Using device: {DEVICE}")
print(f"Hugging Face API Key: {'✅ Loaded' if HUGGINGFACE_API_KEY else '❌ Not found'}")

# ============================================================
# MODEL PATH
# ============================================================
firewall_path = os.path.join(BASE_DIR, "models", "firewall", "firewall_cnn.pth")
print(f"Looking for model at: {firewall_path}")
print(f"Model exists: {os.path.exists(firewall_path)}")

# ============================================================
# FIREWALL AI MODEL
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
# LOAD MODEL
# ============================================================
print("\n📦 Loading model...")

firewall_model = FirewallAI().to(DEVICE)

if os.path.exists(firewall_path):
    firewall_model.load_state_dict(torch.load(firewall_path, map_location=DEVICE))
    firewall_model.eval()
    print(f"✅ Firewall AI loaded from {firewall_path}")
else:
    print(f"❌ Firewall model not found at {firewall_path}")

# ============================================================
# PREPROCESSING
# ============================================================
transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ============================================================
# HUGGING FACE RAG FUNCTION
# ============================================================
def get_huggingface_analysis(confidence: float, filename: str) -> dict:
    """Use Hugging Face FREE API to analyze threat"""
    
    API_URL = "https://api-inference.huggingface.co/models/google/flan-t5-large"
    headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
    
    # Determine threat level based on confidence
    if confidence > 0.85:
        threat_level = "CRITICAL"
    elif confidence > 0.7:
        threat_level = "HIGH"
    elif confidence > 0.5:
        threat_level = "MEDIUM"
    else:
        threat_level = "LOW"
    
    # Prompt for Hugging Face model
    prompt = f"""Analyze this military drone threat detection:
- Threat confidence: {confidence*100:.0f}%
- Threat level: {threat_level}
- Source: {filename}

Provide:
1. Why this is considered a threat (2-3 sentences)
2. Technical reason for the attack
3. Recommended action for drone defense

Response format:
REASON: [explain why this is a threat]
TECHNICAL: [explain the adversarial attack technique]
ACTION: [recommended action]"""
    
    try:
        response = requests.post(API_URL, headers=headers, json={
            "inputs": prompt,
            "parameters": {"max_length": 300, "temperature": 0.7}
        })
        
        if response.status_code == 200:
            result = response.json()
            analysis_text = result[0]['generated_text'] if isinstance(result, list) else result.get('generated_text', '')
            
            # Parse the response
            reason = ""
            technical = ""
            action = ""
            
            if "REASON:" in analysis_text:
                parts = analysis_text.split("REASON:")[1]
                if "TECHNICAL:" in parts:
                    reason = parts.split("TECHNICAL:")[0].strip()
                    if "ACTION:" in parts.split("TECHNICAL:")[1]:
                        technical = parts.split("TECHNICAL:")[1].split("ACTION:")[0].strip()
                        action = parts.split("TECHNICAL:")[1].split("ACTION:")[1].strip()
                    else:
                        technical = parts.split("TECHNICAL:")[1].strip()
                else:
                    reason = parts.strip()
            else:
                reason = analysis_text[:200]
            
            return {
                "success": True,
                "reason": reason,
                "technical": technical,
                "action": action,
                "full_response": analysis_text
            }
        else:
            return {"success": False, "error": f"API Error: {response.status_code}"}
            
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============================================================
# CREATE FASTAPI APP
# ============================================================
app = FastAPI(title="Adversarial AI Firewall")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
frontend_public = Path(BASE_DIR) / "frontend" / "public"
if frontend_public.exists():
    simulation_dir = frontend_public / "simulation"
    if simulation_dir.exists():
        app.mount("/simulation", StaticFiles(directory=str(simulation_dir)), name="simulation")

# ============================================================
# SIMULATION STATE
# ============================================================
simulation_state = {
    "current_index": 0,
    "total_images": 20
}

@app.get("/simulate/next")
async def simulate_next():
    sim_dir = frontend_public / "simulation"
    
    images = []
    for i in range(1, 21):
        for ext in ['.jpeg', '.jpg', '.png']:
            img_path = sim_dir / f"{i}{ext}"
            if img_path.exists():
                images.append({
                    "path": str(img_path),
                    "filename": f"{i}{ext}",
                    "url": f"/simulation/{i}{ext}"
                })
                break
    
    if not images:
        return JSONResponse(status_code=404, content={"error": "No images found"})
    
    current_idx = simulation_state["current_index"] % len(images)
    image_info = images[current_idx]
    
    try:
        with open(image_info["path"], 'rb') as f:
            image_bytes = f.read()
        
        prediction, confidence = predict_image_from_bytes(image_bytes)
        print(f"📸 Simulation: {image_info['filename']} → {'ATTACK' if prediction == 1 else 'CLEAN'} ({confidence:.2f})")
        
    except Exception as e:
        print(f"Error: {e}")
        prediction = 0
        confidence = 0.0
    
    simulation_state["current_index"] += 1
    
    return {
        "image_url": image_info["url"],
        "filename": image_info["filename"],
        "prediction": "attack" if prediction == 1 else "clean",
        "confidence": confidence,
        "index": current_idx + 1,
        "total": len(images)
    }

@app.get("/simulate/reset")
async def simulate_reset():
    simulation_state["current_index"] = 0
    return {"status": "reset"}

# ============================================================
# SHARED PREDICTION FUNCTION
# ============================================================
def predict_image_from_bytes(image_bytes: bytes) -> tuple:
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        img_tensor = transform(img).unsqueeze(0).to(DEVICE)
        
        with torch.no_grad():
            output = firewall_model(img_tensor)
            confidence = output.item()
            prediction = 1 if confidence > 0.5 else 0
        
        print(f"🔍 Prediction: {'ATTACK' if prediction == 1 else 'CLEAN'} (confidence: {confidence:.4f})")
        return prediction, confidence
    except Exception as e:
        print(f"Prediction error: {e}")
        return 0, 0.0

# ============================================================
# API ENDPOINTS
# ============================================================
@app.post("/api/predict")
async def predict(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        prediction, confidence = predict_image_from_bytes(contents)
        
        return {
            "success": True,
            "prediction": prediction,
            "confidence": confidence,
            "alert": prediction == 1,
            "message": "🚨 ATTACK DETECTED!" if prediction == 1 else "✅ CLEAN - Safe",
            "filename": file.filename
        }
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

# ============================================================
# RAG ENDPOINT WITH HUGGING FACE
# ============================================================
@app.get("/api/analyze-threat")
async def analyze_threat(prediction: str, confidence: float, filename: str = "unknown"):
    if prediction != "attack":
        return {
            "threat_assessment": "No threat detected.",
            "recommended_action": "Continue monitoring.",
            "severity": "none",
            "reason": "No adversarial pattern detected",
            "technical": "Image classified as clean",
            "action": "Continue normal operations"
        }
    
    if not HUGGINGFACE_API_KEY:
        # Fallback if no API key
        if confidence > 0.85:
            severity = "CRITICAL"
            action = "EVASIVE ACTION"
            reason = "High confidence adversarial attack detected"
            technical = "Statistical anomalies detected in image patterns"
        elif confidence > 0.7:
            severity = "HIGH"
            action = "TRACK TARGET"
            reason = "Medium-high confidence attack detected"
            technical = "Unusual edge patterns and color distributions"
        else:
            severity = "MEDIUM"
            action = "MONITOR"
            reason = "Potential adversarial attack detected"
            technical = "Subtle perturbations detected in frequency domain"
        
        return {
            "threat_assessment": f"{severity} threat detected with {confidence:.0%} confidence",
            "recommended_action": action,
            "severity": severity,
            "reason": reason,
            "technical": technical,
            "action": action,
            "confidence": confidence
        }
    
    # Use Hugging Face API for intelligent analysis
    analysis = get_huggingface_analysis(confidence, filename)
    
    if analysis.get("success"):
        return {
            "threat_assessment": f"Attack detected with {confidence:.0%} confidence",
            "recommended_action": analysis.get("action", "EVASIVE ACTION"),
            "severity": "CRITICAL" if confidence > 0.85 else "HIGH" if confidence > 0.7 else "MEDIUM",
            "reason": analysis.get("reason", "Adversarial pattern detected"),
            "technical": analysis.get("technical", "Statistical anomalies in image"),
            "action": analysis.get("action", "Take evasive action"),
            "confidence": confidence,
            "analysis": analysis.get("full_response", "")
        }
    else:
        # Fallback
        return {
            "threat_assessment": f"Attack detected with {confidence:.0%} confidence",
            "recommended_action": "EVASIVE ACTION - Target confirmed adversarial",
            "severity": "CRITICAL" if confidence > 0.85 else "HIGH",
            "reason": "Adversarial patch detected on military vehicle",
            "technical": f"Confidence score {confidence:.0%} exceeds threat threshold",
            "action": "EVASIVE ACTION",
            "confidence": confidence
        }

@app.get("/api/attack-patterns")
async def get_attack_patterns():
    patterns = [
        {
            "id": "white_tape",
            "description": "White tape stripes applied horizontally across military vehicle",
            "metadata": {"attack_type": "white_tape", "severity": "high"}
        },
        {
            "id": "red_patch",
            "description": "Red square patch placed on vehicle surface",
            "metadata": {"attack_type": "red_patch", "severity": "medium"}
        },
        {
            "id": "camouflage",
            "description": "Camouflage pattern applied to vehicle",
            "metadata": {"attack_type": "camouflage", "severity": "high"}
        }
    ]
    return {"attacks": patterns, "count": len(patterns)}

@app.get("/api/health")
async def health():
    return {"status": "healthy", "model_loaded": os.path.exists(firewall_path)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)