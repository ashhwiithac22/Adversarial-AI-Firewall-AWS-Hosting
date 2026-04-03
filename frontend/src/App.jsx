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
  
  // Simulation states
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [currentSimImage, setCurrentSimImage] = useState(null);
  const [currentSimPrediction, setCurrentSimPrediction] = useState(null);
  const [currentSimConfidence, setCurrentSimConfidence] = useState(0);
  
  // Upload state
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  
  const simulationInterval = useRef(null);
  const shouldStopSimulation = useRef(false);
  const API_BASE = 'http://localhost:8000';

  // Start video stream
  useEffect(() => {
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        addAlert('ERROR', 'Camera access denied');
      }
    };
    startVideo();
  }, []);

  // Add alert to log
  const addAlert = (type, message, confidenceValue = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setAlerts(prev => [{
      id: Date.now(),
      time: timestamp,
      type: type,
      message: message,
      confidence: confidenceValue
    }, ...prev].slice(0, 20));
  };

  // Analyze image with backend (REAL model)
  const analyzeImage = async (imageBlob, sourceName) => {
    try {
      const formData = new FormData();
      formData.append('file', imageBlob, `${sourceName}.jpg`);
      
      const response = await fetch(`${API_BASE}/api/predict`, {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success) {
        const isAttack = result.prediction === 1;
        const confidenceValue = result.confidence;
        
        setConfidence(confidenceValue);
        setThreatLevel(isAttack ? 'CRITICAL' : 'CLEAR');
        
        if (isAttack) {
          setThreatCount(prev => prev + 1);
          addAlert('ATTACK', `${sourceName} → ATTACK DETECTED!`, confidenceValue);
        } else {
          addAlert('CLEAN', `${sourceName} → CLEAN`, confidenceValue);
        }
        setScannedCount(prev => prev + 1);
        
        return { isAttack, confidence: confidenceValue };
      }
    } catch (error) {
      addAlert('ERROR', `${sourceName} - API Error`);
    }
    return null;
  };

  // Camera scanning
  useEffect(() => {
    const interval = setInterval(async () => {
      if (videoRef.current && videoRef.current.videoWidth > 0 && !isProcessing && !isSimulating) {
        setIsProcessing(true);
        
        try {
          const canvas = canvasRef.current;
          const video = videoRef.current;
          
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
          await analyzeImage(blob, 'Camera');
          
        } catch (error) {
          console.error("Camera scan error:", error);
        } finally {
          setIsProcessing(false);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isProcessing, isSimulating]);

  // Simulation - INFINITE LOOP scanning images using backend
  const startSimulation = async () => {
    if (isSimulating) return;
    
    // Reset stop flag
    shouldStopSimulation.current = false;
    setIsSimulating(true);
    addAlert('INFO', 'Simulation started - scanning images continuously');
    
    let imageIndex = 1;
    
    while (!shouldStopSimulation.current) {
      // Update progress (percentage of current cycle through 20 images)
      setSimProgress(Math.round((imageIndex / 20) * 100));
      setCurrentSimImage(`/simulation/${imageIndex}.jpeg`);
      
      try {
        const response = await fetch(`${API_BASE}/simulate/next`);
        const data = await response.json();
        
        if (data && !data.error) {
          setCurrentSimPrediction(data.prediction);
          setCurrentSimConfidence(data.confidence);
          
          addAlert(
            data.prediction.toUpperCase(),
            `${data.filename} → ${data.prediction.toUpperCase()} (${Math.round(data.confidence * 100)}%)`,
            data.confidence
          );
        }
        
      } catch (error) {
        addAlert('ERROR', `Failed to load image ${imageIndex}`);
      }
      
      // Check if we should stop before waiting
      if (shouldStopSimulation.current) break;
      
      // Wait 1.5 seconds between images
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Increment image index and loop back to 1 after 20
      imageIndex = (imageIndex % 20) + 1;
    }
    
    // Cleanup when stopped
    setIsSimulating(false);
    setCurrentSimImage(null);
    setCurrentSimPrediction(null);
    setSimProgress(0);
    addAlert('INFO', 'Simulation stopped');
  };

  // Stop simulation
  const stopSimulation = () => {
    if (!isSimulating) return;
    
    // Set flag to stop the simulation loop
    shouldStopSimulation.current = true;
    setIsSimulating(false);
  };

  // Reset all
  const resetAll = () => {
    // Stop simulation if running
    if (isSimulating) {
      stopSimulation();
    }
    setAlerts([]);
    setScannedCount(0);
    setThreatCount(0);
    setConfidence(0);
    setThreatLevel('CLEAR');
    addAlert('INFO', 'System reset');
  };

  // Handle image upload
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setUploadPreview(URL.createObjectURL(file));
    await analyzeImage(file, `Upload: ${file.name}`);
    
    setTimeout(() => {
      setUploadPreview(null);
    }, 3000);
  };

  // RAG Analysis Handler
  const getRAGAnalysis = async () => {
    if (threatLevel !== 'CRITICAL') {
      addAlert('INFO', 'No active threat to analyze. Run simulation or scan an attack first.');
      return;
    }
    
    addAlert('RAG', 'Fetching AI threat analysis...');
    
    try {
      const response = await fetch(`${API_BASE}/api/analyze-threat?prediction=attack&confidence=${confidence}&filename=current_frame`);
      const data = await response.json();
      
      addAlert('RAG', `Assessment: ${data.threat_assessment}`);
      addAlert('ACTION', `Recommendation: ${data.recommended_action}`);
      addAlert('RAG', `Attack Type: ${data.attack_type || 'Unknown'} | Severity: ${data.severity}`);
    } catch (error) {
      addAlert('ERROR', 'RAG analysis failed');
    }
  };

  return (
    <div className="dashboard">
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* RAG Button - Top Right */}
      <button className="rag-button" onClick={getRAGAnalysis}>
        🤖 RAG ANALYSIS
      </button>
      
      <div className="main-layout">
        
        {/* LEFT PANEL - IMAGE DISPLAY */}
        <div className="image-panel">
          <div className="panel-header">🎯 CURRENT IMAGE</div>
          <div className="image-container">
            {currentSimImage ? (
              <>
                <img src={`${API_BASE}${currentSimImage}`} alt="Current" className="current-image" />
                <div className={`prediction-overlay ${currentSimPrediction}`}>
                  {currentSimPrediction === 'attack' ? '🔴 ATTACK DETECTED' : '🟢 CLEAN'}
                </div>
              </>
            ) : (
              <div className="no-image">No image being processed</div>
            )}
          </div>
          
          {/* Simulation Progress */}
          {isSimulating && simProgress > 0 && (
            <div className="sim-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${simProgress}%` }}></div>
              </div>
            </div>
          )}
        </div>
        
        {/* RIGHT PANEL - CONTROLS & UPLOAD */}
        <div className="controls-panel">
          
          {/* Upload Section */}
          <div className="section upload-section">
            <div className="section-title">📤 UPLOAD IMAGE</div>
            <label className="upload-btn">
              CHOOSE FILE
              <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
            </label>
            {uploadPreview && (
              <div className="upload-preview">
                <img src={uploadPreview} alt="Preview" />
              </div>
            )}
          </div>
          
          {/* Simulation Controls */}
          <div className="section controls-section">
            <div className="section-title">🎮 SIMULATION</div>
            <div className="button-group">
              <button className="btn-start" onClick={startSimulation} disabled={isSimulating}>
                ▶ RUN
              </button>
              <button className="btn-stop" onClick={stopSimulation} disabled={!isSimulating}>
                ⏹ STOP
              </button>
              <button className="btn-reset" onClick={resetAll}>
                🔄 RESET
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* BOTTOM - TERMINAL LOGS */}
      <div className="logs-panel">
        <div className="logs-header">
          <span>🔻 SIMULATION LOG</span>
          <span className={`sim-status ${isSimulating ? 'running' : 'stopped'}`}>
            {isSimulating ? '🟢 RUNNING' : '⚫ STOPPED'}
          </span>
        </div>
        <div className="logs-body">
          {alerts.length === 0 ? (
            <div className="log-entry info"> System ready. Click RUN to start simulation...</div>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} className={`log-entry ${alert.type === 'ATTACK' ? 'attack' : alert.type === 'CLEAN' ? 'clean' : alert.type === 'RAG' ? 'rag' : alert.type === 'ACTION' ? 'action' : 'info'}`}>
                <span className="log-time">[{alert.time}]</span>
                <span className="log-type">[{alert.type}]</span>
                <span className="log-message">{alert.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;