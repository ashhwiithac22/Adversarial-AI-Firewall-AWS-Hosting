import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
import os
import numpy as np
from tqdm import tqdm
from sklearn.model_selection import train_test_split
import sys

# Configuration
BASE_DIR = r"D:/Projects/AI_Firewall_For_Drones"
BATCH_SIZE = 32
EPOCHS = 3 # Fast training
LEARNING_RATE = 0.001
IMG_SIZE = 128

# Set paths
sys.path.append(os.path.join(BASE_DIR, "models", "firewall"))
from firewall_model import AdversarialFirewall

# Device
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {device}")

# Dataset Class
class FirewallDataset(Dataset):
    def __init__(self, clean_dir, adv_dir, transform=None):
        self.clean_files = [(os.path.join(clean_dir, f), 0) for f in os.listdir(clean_dir)[:500] if f.endswith('.png')]
        self.adv_files = [(os.path.join(adv_dir, f), 1) for f in os.listdir(adv_dir)[:500] if f.endswith('.png')]
        self.data = self.clean_files + self.adv_files
        self.transform = transform or transforms.Compose([
            transforms.Resize((IMG_SIZE, IMG_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
        ])
    
    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, idx):
        img_path, label = self.data[idx]
        img = Image.open(img_path).convert('RGB')
        img = self.transform(img)
        
        # In this task, we use random metadata features for the MLP branch
        # In real life, these would be drone telemetry (ping, packet size, frequency, etc.)
        features = torch.randn(15) 
        return img, features, torch.tensor([label], dtype=torch.float32)

def train():
    # Load dataset
    clean_dir = os.path.join(BASE_DIR, "dataset", "clean")
    adv_dir = os.path.join(BASE_DIR, "dataset", "adversarial")
    
    if not os.path.exists(clean_dir) or not os.listdir(clean_dir):
        print("Wait! Dataset not ready yet.")
        return

    dataset = FirewallDataset(clean_dir, adv_dir)

    # Train/val split
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

    # Model
    model = AdversarialFirewall().to(device)
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

    print(f"Training samples: {len(train_dataset)}")
    print(f"Validation samples: {len(val_dataset)}")

    best_val_acc = 0.0

    # Training
    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0.0
        train_correct = 0
        
        pbar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{EPOCHS}")
        for images, features, labels in pbar:
            images, features, labels = images.to(device), features.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(images, features)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
            predicted = (outputs > 0.5).float()
            train_correct += (predicted == labels).sum().item()
            pbar.set_postfix({'loss': f'{loss.item():.4f}'})
        
        train_acc = train_correct / len(train_dataset)
        
        # Validation
        model.eval()
        val_correct = 0
        with torch.no_grad():
            for images, features, labels in val_loader:
                images, features, labels = images.to(device), features.to(device), labels.to(device)
                outputs = model(images, features)
                predicted = (outputs > 0.5).float()
                val_correct += (predicted == labels).sum().item()
        
        val_acc = val_correct / len(val_dataset)
        print(f"Epoch {epoch+1}: Train Acc: {train_acc:.4f}, Val Acc: {val_acc:.4f}")
        
        if val_acc >= best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), os.path.join(BASE_DIR, "models", "firewall", "best_model.pth"))

    print(f"Training Complete! Best Val Acc: {best_val_acc:.4f}")
    print(f"Model saved to: {os.path.join(BASE_DIR, 'models', 'firewall', 'best_model.pth')}")

if __name__ == "__main__":
    train()
