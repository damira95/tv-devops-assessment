# 🚀 TurboVets DevOps Assessment

This project demonstrates a **full DevOps lifecycle implementation** including containerization, infrastructure as code, and CI/CD automation.

It provisions a **production-ready AWS environment** using CDK for Terraform and deploys a containerized Node.js application on ECS Fargate behind an Application Load Balancer.



## 🧩 Architecture Overview

- **Application:** Express.js + TypeScript
- **Containerization:** Docker + Docker Compose
- **Infrastructure:** CDK for Terraform (AWS)
- **Compute:** ECS Fargate
- **Registry:** Amazon ECR
- **Networking:** VPC with public subnets
- **Load Balancing:** Application Load Balancer (ALB)
- **Logging:** CloudWatch Logs
- **CI/CD:** GitHub Actions



## 📁 Project Structure

.
├── app/        # Node.js application (Dockerized)
├── iac/        # Infrastructure as Code (CDKTF)
└── README.md



## 🐳 Local Development

### Run locally with Docker

```bash
cd app
docker compose up --build

###Health Check

After starting the application:
http://localhost:3000/health
Expected response:
{"status":"ok"}

☁️ AWS Deployment
Requirements

AWS account
AWS CLI configured
Node.js 20+
Environment Variables

export AWS_REGION=us-east-1
export APP_NAME=tv-assessment-app
export CONTAINER_PORT=3000
export IMAGE_TAG=latest

###Deploy

cd iac
npm install
cdktf deploy

###Destroy

cdktf destroy

🔄 CI/CD

GitHub Actions pipeline:
Trigger: push to main
Build Docker image
Push to ECR
Deploy via CDKTF

🔐 Required GitHub Secrets

AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
ECR_URI

🌐 Output

After deployment, the application will be publicly доступен at:

http://<ALB_DNS>/health


🧠 Design Decisions
	•	ECS Fargate for serverless container management
	•	ALB for public access and health checks
	•	CDKTF for type-safe infrastructure
	•	Environment variables for portability
	•	IAM roles follow least privilege principle


⚙️ Key Features
	•	Multi-stage Docker build (optimized image size)
	•	Clean separation between app and infrastructure
	•	Fully automated infrastructure provisioning
	•	Public health endpoint
	•	Secure secret handling via GitHub Actions
