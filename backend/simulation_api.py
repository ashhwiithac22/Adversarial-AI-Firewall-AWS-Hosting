# backend/simulation_api.py
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import os
import random
from pathlib import Path

app = FastAPI(title="Adversarial AI Firewall Simulation API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simulation state
simulation_state = {
    "current_index": 0,
    "total_images": 20,
    "is_running": False
}

# Get the absolute path to your images
# Your images are directly in: D:\PROJECTS\AI_Firewall_For_Drones\frontend\public\simulation\
BASE_DIR = Path(__file__).parent.parent
SIMULATION_DIR = BASE_DIR / "frontend" / "public" / "simulation"

print(f"Looking for images in: {SIMULATION_DIR}")

def get_image_list():
    """Get list of all images in simulation folder (1.jpeg to 20.jpeg)"""
    images = []
    
    # Images are directly in simulation folder: 1.jpeg to 20.jpeg
    for i in range(1, 21):
        for ext in ['.jpeg', '.jpg', '.png']:
            img_path = SIMULATION_DIR / f"{i}{ext}"
            if img_path.exists():
                # Determine if it's clean or adversarial based on filename
                # You can modify this logic based on your actual image distribution
                # For now, let's say 1-10 are clean, 11-20 are adversarial
                if i <= 10:
                    img_type = "clean"
                else:
                    img_type = "adversarial"
                
                images.append({
                    "path": str(img_path),
                    "filename": f"{i}{ext}",
                    "type": img_type,
                    "url": f"/simulation_images/{i}{ext}"
                })
                break
    
    print(f"Found {len(images)} images in simulation folder")
    for img in images:
        print(f"  - {img['filename']} ({img['type']})")
    
    return images

# Endpoint to serve images
@app.get("/simulation_images/{filename}")
async def serve_image(filename: str):
    """Serve images from simulation folder"""
    file_path = SIMULATION_DIR / filename
    if file_path.exists():
        return FileResponse(file_path)
    return JSONResponse(status_code=404, content={"error": "Image not found"})

# Mock prediction logic (based on filename)
def predict_image(image_path, filename):
    """Predict if image is clean or attack based on filename"""
    # Extract number from filename (1-20)
    try:
        # Get number from filename (e.g., "1.jpeg" -> 1)
        num = int(''.join(filter(str.isdigit, filename)))
    except:
        num = 0
    
    # Files 1-10 are clean, 11-20 are adversarial
    if num > 10:
        return "attack", random.uniform(0.75, 0.98)
    else:
        return "clean", random.uniform(0.85, 0.99)

@app.get("/simulate/next")
async def get_next_image():
    """Get next image for simulation (maintains state)"""
    images = get_image_list()
    
    if not images:
        return JSONResponse(status_code=404, content={"error": "No images found. Please add images (1.jpeg to 20.jpeg) to frontend/public/simulation/"})
    
    # Get current image
    current_idx = simulation_state["current_index"] % len(images)
    image_info = images[current_idx]
    
    # Predict
    prediction, confidence = predict_image(image_info["path"], image_info["filename"])
    
    # Update index for next call
    simulation_state["current_index"] += 1
    
    return {
        "image_url": image_info["url"],
        "filename": image_info["filename"],
        "prediction": prediction,
        "confidence": confidence,
        "index": current_idx + 1,
        "total": len(images)
    }

@app.post("/predict")
async def predict_upload(file: UploadFile = File(...)):
    """Predict uploaded image"""
    # Save temporarily
    temp_path = f"/tmp/{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())
    
    # Simple prediction based on filename
    if "adv" in file.filename.lower() or "attack" in file.filename.lower():
        prediction = "attack"
        confidence = random.uniform(0.75, 0.98)
    else:
        prediction = "clean"
        confidence = random.uniform(0.85, 0.99)
    
    # Clean up
    os.remove(temp_path)
    
    return {
        "prediction": prediction,
        "confidence": confidence,
        "filename": file.filename
    }

@app.get("/simulate/reset")
async def reset_simulation():
    """Reset simulation counter"""
    simulation_state["current_index"] = 0
    return {"status": "reset", "current_index": 0}

@app.get("/simulate/status")
async def get_status():
    """Get current simulation status"""
    images = get_image_list()
    return {
        "current_index": simulation_state["current_index"],
        "total_images": len(images),
        "is_running": simulation_state["is_running"]
    }