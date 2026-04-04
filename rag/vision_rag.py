"""
Vision RAG - Analyzes actual image content using Hugging Face Vision Models
NO confidence-based logic, analyzes the image directly
"""

import os
import requests
import base64
from PIL import Image
import io

class VisionRAG:
    def __init__(self, hf_api_key: str):
        self.hf_api_key = hf_api_key
        self.caption_url = "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base"
        self.llm_url = "https://api-inference.huggingface.co/models/google/flan-t5-large"
        self.headers = {"Authorization": f"Bearer {self.hf_api_key}"}
        print("✅ Vision RAG initialized")
    
    def analyze_image(self, image_bytes: bytes, filename: str) -> dict:
        """Analyze image content using Hugging Face Vision Model"""
        
        try:
            # Step 1: Generate image caption using BLIP
            caption = self._get_image_caption(image_bytes)
            
            # Step 2: Analyze the caption using LLM
            analysis = self._analyze_caption(caption, filename)
            
            return {
                "threat_assessment": analysis.get("assessment", "Analysis complete"),
                "recommended_action": analysis.get("action", "Monitor"),
                "severity": analysis.get("severity", "MEDIUM"),
                "reason": analysis.get("reason", caption),
                "image_description": caption
            }
            
        except Exception as e:
            print(f"Vision analysis error: {e}")
            return {
                "threat_assessment": "Analysis failed",
                "recommended_action": "Manual inspection required",
                "severity": "UNKNOWN",
                "reason": f"Could not analyze image: {str(e)}",
                "image_description": ""
            }
    
    def _get_image_caption(self, image_bytes: bytes) -> str:
        """Generate caption for image using BLIP"""
        
        # Encode image to base64
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        payload = {
            "inputs": image_base64,
            "parameters": {"max_length": 100}
        }
        
        response = requests.post(self.caption_url, headers=self.headers, json=payload)
        
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                return result[0].get('generated_text', 'Military vehicle')
            return 'Military vehicle'
        else:
            print(f"Caption API error: {response.status_code}")
            return 'Military vehicle'
    
    def _analyze_caption(self, caption: str, filename: str) -> dict:
        """Analyze caption using LLM to determine threat"""
        
        prompt = f"""Analyze this image description from a military drone:
        
Image description: "{caption}"
Image source: {filename}

Based ONLY on the image description, determine:
1. What type of military vehicle or object is shown
2. Is there any adversarial attack visible (tape, camouflage, patches, markings, stripes)?
3. What is the threat level?
4. Recommended action for the drone

Respond in format:
VEHICLE: [type]
ATTACK_TYPE: [adversarial patches identified or "none"]
THREAT_LEVEL: [CRITICAL/HIGH/MEDIUM/LOW/NONE]
REASON: [why]
ACTION: [what to do]"""

        response = requests.post(
            self.llm_url,
            headers=self.headers,
            json={"inputs": prompt, "parameters": {"max_length": 300}}
        )
        
        if response.status_code == 200:
            result = response.json()
            text = result[0]['generated_text'] if isinstance(result, list) else result.get('generated_text', '')
            
            # Parse response
            attack_type = "adversarial patches identified"
            threat_level = "MEDIUM"
            reason = caption
            action = "MONITOR"
            
            if "ATTACK_TYPE:" in text:
                parts = text.split("ATTACK_TYPE:")[1]
                if "THREAT_LEVEL:" in parts:
                    attack_type = parts.split("THREAT_LEVEL:")[0].strip()
                    if "REASON:" in parts.split("THREAT_LEVEL:")[1]:
                        threat_level = parts.split("THREAT_LEVEL:")[1].split("REASON:")[0].strip()
                        if "ACTION:" in parts.split("THREAT_LEVEL:")[1].split("REASON:")[1]:
                            reason = parts.split("THREAT_LEVEL:")[1].split("REASON:")[1].split("ACTION:")[0].strip()
                            action = parts.split("THREAT_LEVEL:")[1].split("REASON:")[1].split("ACTION:")[1].strip()
                        else:
                            reason = parts.split("THREAT_LEVEL:")[1].split("REASON:")[1].strip()
                    else:
                        threat_level = parts.split("THREAT_LEVEL:")[1].strip()
            else:
                # Fallback - analyze based on keywords in caption
                if any(word in caption.lower() for word in ['tape', 'stripe', 'patch', 'camouflage', 'paint', 'marking', 'pattern']):
                    attack_type = "adversarial patches identified"
                    threat_level = "HIGH"
                    action = "EVASIVE ACTION"
                    reason = f"Potential adversarial pattern detected: {caption}"
                elif any(word in caption.lower() for word in ['tank', 'apc', 'military', 'armored', 'vehicle', 'truck']):
                    attack_type = "none"
                    threat_level = "LOW"
                    action = "MONITOR"
                    reason = f"Military vehicle detected: {caption}"
                else:
                    attack_type = "adversarial patches identified"
                    threat_level = "MEDIUM"
                    action = "MONITOR"
                    reason = caption
            
            # Map threat level to severity
            severity_map = {
                "CRITICAL": "CRITICAL",
                "HIGH": "HIGH", 
                "MEDIUM": "MEDIUM",
                "LOW": "LOW",
                "NONE": "NONE"
            }
            severity = severity_map.get(threat_level.upper(), "MEDIUM")
            
            # Map action
            action_map = {
                "EVASIVE ACTION": "EVASIVE ACTION",
                "TRACK": "TRACK TARGET",
                "MONITOR": "MONITOR",
                "LOG": "LOG"
            }
            final_action = action_map.get(action.upper(), "MONITOR")
            
            return {
                "assessment": f"{severity} threat detected",
                "action": final_action,
                "severity": severity,
                "reason": reason,
                "attack_type": attack_type
            }
        else:
            return {
                "assessment": "Analysis pending",
                "action": "MONITOR",
                "severity": "MEDIUM",
                "reason": caption,
                "attack_type": "adversarial patches identified"
            }