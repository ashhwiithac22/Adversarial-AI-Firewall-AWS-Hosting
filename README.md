# ☁️ Adversarial AI Firewall – AWS Deployment 

## AWS Services Used

| Service | Purpose |
|---------|---------|
| **EC2** | Virtual server running backend API and AI model |
| **ECR** | Docker image registry storing containerized backend |
| **S3** | Hosts React frontend and simulation images |
| **CloudFront** | CDN for frontend with HTTPS |
| **CloudWatch** | Collects metrics (CPU, memory, API calls, attacks) |
| **CloudWatch Dashboard** | Visual dashboard with real-time graphs |
| **IAM** | Manages EC2 permissions to access other services |
| **VPC** | Private network with security group rules |

---

## 🐳 Docker Container

- Base image: Python 3.11-slim
- Port mapping: 8080:8000
- Container name: firewall

---

## 🔧 Backend API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check and model status |
| `/api/predict` | POST | Upload image, get prediction |
| `/simulate/next` | GET | Next simulation image |
| `/simulate/reset` | GET | Reset simulation |
| `/docs` | GET | Swagger UI documentation |

### API Response
```json
{
  "success": true,
  "prediction": 1,
  "confidence": 0.95,
  "alert": true,
  "message": "ATTACK DETECTED"
}
```
--- 

##  🎨 Frontend (React)
- Hosted on S3 with CloudFront CDN
- Simulation mode scanning 20 images
- Image upload feature
- Live logs display
- Color-coded results (red = attack, green = clean)
- Confidence scores shown

--- 

## 🔐 IAM Role

Policies attached:

- AmazonEC2ContainerRegistryReadOnly
- CloudWatchAgentServerPolicy

--- 

## 🚀 Deployment Steps Performed
- Built Docker image locally
- Pushed image to ECR
- Launched EC2 instance (Ubuntu 22.04, t3.micro)
- Attached IAM role to EC2
- Configured Security Group (ports 22 and 8080)
- Installed Docker on EC2
- Pulled image from ECR to EC2
- Ran container on EC2
- Fixed model path inside container
- Built React frontend
- Uploaded frontend to S3
- Enabled S3 static website hosting
- Created CloudFront distribution
- Installed CloudWatch agent on EC2
- Created CloudWatch dashboard with 9 metrics



