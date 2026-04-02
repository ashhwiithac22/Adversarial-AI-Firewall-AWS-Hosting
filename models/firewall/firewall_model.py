import torch
import torch.nn as nn

class AdversarialFirewall(nn.Module):
    def __init__(self):
        super().__init__()
        
        # CNN Branch for Image Features (Input: 3 x 128 x 128)
        self.cnn = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2), # 64x64
            nn.Conv2d(32, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2), # 32x32
            nn.Conv2d(64, 128, 3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((1,1)) # 128 features
        )
        
        # MLP Branch for Metadata/Inferred Features (15 features)
        self.mlp = nn.Sequential(
            nn.Linear(15, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 32),
            nn.ReLU()
        )
        
        # Combined Classifier
        self.classifier = nn.Sequential(
            nn.Linear(128 + 32, 128),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )
    
    def forward(self, image, features):
        cnn_out = self.cnn(image).squeeze(-1).squeeze(-1) # Output (B, 128)
        mlp_out = self.mlp(features) # Output (B, 32)
        combined = torch.cat((cnn_out, mlp_out), dim=1)
        return self.classifier(combined)
