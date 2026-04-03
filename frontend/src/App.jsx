import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [threatLevel, setThreatLevel] = useState('CLEAR');
  const [confidence, setConfidence] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [scannedCount, setScannedCount] = useState(0);
  const [threatCount, setThreatCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationTotal, setSimulationTotal] = useState(0);
  
  // Upload feature states
  const [showUpload, setShowUpload] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(null);

  // Predefined test images (clean and adversarial)
  const testImages = [
    // Clean images (should show CLEAR)
    { path: '/test_images/clean_tank1.jpg', label: 'clean', name: 'Clean Tank 1' },
    { path: '/test_images/clean_tank2.jpg', label: 'clean', name: 'Clean Tank 2' },
    { path: '/test_images/clean_apc1.jpg', label: 'clean', name: 'Clean APC 1' },
    { path: '/test_images/clean_truck1.jpg', label: 'clean', name: 'Clean Truck 1' },
    { path: '/test_images/clean_jeep1.jpg', label: 'clean', name: 'Clean Jeep 1' },
    { path: '/test_images/clean_tank3.jpg', label: 'clean', name: 'Clean Tank 3' },
    { path: '/test_images/clean_apc2.jpg', label: 'clean', name: 'Clean APC 2' },
    { path: '/test_images/clean_truck2.jpg', label: 'clean', name: 'Clean Truck 2' },
    // Adversarial images (should show ATTACK)
    { path: '/test_images/adv_white_tape1.jpg', label: 'attack', name: 'White Tape Attack 1' },
    { path: '/test_images/adv_white_tape2.jpg', label: 'attack', name: 'White Tape Attack 2' },
    { path: '/test_images/adv_red_patch1.jpg', label: 'attack', name: 'Red Patch Attack 1' },
    { path: '/test_images/adv_red_patch2.jpg', label: 'attack', name: 'Red Patch Attack 2' },
    { path: '/test_images/adv_yellow_tape1.jpg', label: 'attack', name: 'Yellow Tape Attack 1' },
    { path: '/test_images/adv_camouflage1.jpg', label: 'attack', name: 'Camouflage Attack 1' },
    { path: '/test_images/adv_checkerboard1.jpg', label: 'attack', name: 'Checkerboard Attack 1' },
    { path: '/test_images/adv_woodland1.jpg', label: 'attack', name: 'Woodland Camo Attack 1' },
  ];

  // Start video stream
  useEffect(() => {
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
      }
    };
    startVideo();
  }, []);

  // Function to analyze a single image (from file or blob)
  const analyzeImage = async (imageFile, imageName = 'image') => {
    try {
      const formData = new FormData();
      formData.append('file', imageFile, imageName);
      
      const response = await fetch('http://localhost:8000/api/predict', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success) {
        const isAttack = result.prediction === 1;
        const confidenceValue = result.confidence;
        
        if (isAttack) {
          setThreatLevel('CRITICAL');
          setConfidence(confidenceValue);
          setThreatCount(prev => prev + 1);
          setAlerts(prev => [{
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            confidence: confidenceValue,
            name: imageName
          }, ...prev].slice(0, 10));
        } else {
          setThreatLevel('CLEAR');
          setConfidence(confidenceValue);
        }
        setScannedCount(prev => prev + 1);
        return { isAttack, confidence: confidenceValue };
      }
    } catch (error) {
      console.error("API Error:", error);
    }
    return null;
  };

  // Simulation function - scans multiple images
  const startSimulation = async () => {
    setIsSimulating(true);
    setSimulationProgress(0);
    setSimulationTotal(testImages.length);
    setAlerts([]);
    setScannedCount(0);
    setThreatCount(0);
    
    for (let i = 0; i < testImages.length; i++) {
      const img = testImages[i];
      setSimulationProgress(i + 1);
      
      // Fetch the image from public folder
      try {
        const response = await fetch(img.path);
        const blob = await response.blob();
        const file = new File([blob], `${img.name}.jpg`, { type: 'image/jpeg' });
        
        setThreatLevel('PROCESSING');
        await analyzeImage(file, img.name);
        
        // Wait 1 second between images for better visualization
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to load image: ${img.path}`, error);
      }
    }
    
    setIsSimulating(false);
    setThreatLevel('CLEAR');
    alert(`Simulation Complete!\n\nScanned: ${scannedCount}\nThreats Detected: ${threatCount}\nAccuracy: ${((threatCount / scannedCount) * 100).toFixed(1)}%`);
  };

  // Camera scanning (original)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (videoRef.current && videoRef.current.videoWidth > 0 && !isProcessing && !showUpload && !isSimulating) {
        setIsProcessing(true);
        
        try {
          const canvas = canvasRef.current;
          const video = videoRef.current;
          
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
          
          const formData = new FormData();
          formData.append('file', blob, 'frame.jpg');
          
          const response = await fetch('http://localhost:8000/api/predict', {
            method: 'POST',
            body: formData,
          });
          
          const result = await response.json();
          
          if (result.success) {
            const isAttack = result.prediction === 1;
            const confidenceValue = result.confidence;
            
            if (isAttack) {
              setThreatLevel('CRITICAL');
              setConfidence(confidenceValue);
              setThreatCount(prev => prev + 1);
              setAlerts(prev => [{
                id: Date.now(),
                time: new Date().toLocaleTimeString(),
                confidence: confidenceValue,
                name: 'Camera Feed'
              }, ...prev].slice(0, 10));
            } else {
              setThreatLevel('CLEAR');
              setConfidence(confidenceValue);
            }
            setScannedCount(prev => prev + 1);
          }
        } catch (error) {
          console.error("API Error:", error);
        } finally {
          setIsProcessing(false);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isProcessing, showUpload, isSimulating]);

  // Handle image upload
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadPreview(URL.createObjectURL(file));
      setShowUpload(true);
      setThreatLevel('PROCESSING');
      
      await analyzeImage(file, 'Uploaded Image');
    }
  };

  const closeUpload = () => {
    setShowUpload(false);
    setUploadPreview(null);
    setThreatLevel('CLEAR');
    setConfidence(0);
  };

  return (
    <div className="military-dashboard">
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Video Feed */}
      <div className="video-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="video-feed"
        />
      </div>

      {/* Control Buttons - Top Right */}
      <div className="control-buttons">
        <button 
          className="simulate-btn"
          onClick={startSimulation}
          disabled={isSimulating}
        >
          {isSimulating ? `SIMULATING... ${simulationProgress}/${simulationTotal}` : '🎯 RUN SIMULATION'}
        </button>
        
        <label htmlFor="image-upload" className="upload-icon">
          📷
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          id="image-upload"
          style={{ display: 'none' }}
        />
      </div>

      {/* Simulation Progress Bar */}
      {isSimulating && (
        <div className="simulation-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(simulationProgress / simulationTotal) * 100}%` }}
            ></div>
          </div>
          <div className="progress-text">
            Scanning Image {simulationProgress} of {simulationTotal}
          </div>
        </div>
      )}

      {/* Upload Preview Modal */}
      {showUpload && uploadPreview && (
        <div className="upload-preview-modal">
          <div className="upload-preview-content">
            <button className="close-upload" onClick={closeUpload}>✕</button>
            <img src={uploadPreview} alt="Uploaded" className="upload-preview-img" />
            <p className="upload-preview-text">Analyzing uploaded image...</p>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="status-bar">
        <div className="system-status">
          <span className="status-dot active"></span>
          <span>SYSTEM ACTIVE</span>
        </div>
        <div className="stats">
          SCANNED: {scannedCount} | THREATS: {threatCount}
        </div>
        <div className="timestamp">
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Threat Indicator */}
      <div className={`threat-indicator threat-${threatLevel.toLowerCase()}`}>
        <div className="threat-level">
          {threatLevel === 'CRITICAL' ? '🔴 ATTACK DETECTED' :
           threatLevel === 'HIGH' ? '🟠 HIGH THREAT' :
           threatLevel === 'MEDIUM' ? '🟡 CAUTION' :
           threatLevel === 'PROCESSING' ? '⏳ ANALYZING...' :
           threatLevel === 'ERROR' ? '⚠️ ERROR' :
           '🟢 CLEAR'}
        </div>
        <div className="confidence">
          CONFIDENCE: {Math.round(confidence * 100)}%
        </div>
      </div>

      {/* Alert Log */}
      <div className="alert-log">
        <div className="alert-header">THREAT LOG</div>
        <div className="alert-list">
          {alerts.length === 0 ? (
            <div className="no-alerts">— NO THREATS —</div>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} className="alert-entry">
                <span className="alert-time">{alert.time}</span>
                <span className="alert-threat">ATTACK</span>
                <span className="alert-name">{alert.name}</span>
                <span className="alert-conf">{Math.round(alert.confidence * 100)}%</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;