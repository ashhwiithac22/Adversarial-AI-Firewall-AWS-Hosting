import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  // Simulation states
  const [isSimulating, setIsSimulating] = useState(false);
  const [logs, setLogs] = useState([]);
  const [currentImage, setCurrentImage] = useState(null);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [stats, setStats] = useState({ total: 0, clean: 0, attack: 0 });
  const [simulationProgress, setSimulationProgress] = useState({ current: 0, total: 20 });
  
  // Upload states
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Camera states
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPrediction, setCameraPrediction] = useState(null);
  
  // Interval ref for simulation
  const simulationInterval = useRef(null);

  // Start camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraActive(true);
        }
      } catch (err) {
        addLog('ERROR', 'Camera access denied', 'system');
      }
    };
    startCamera();
  }, []);

  // Add log entry
  const addLog = (type, message, prediction = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [{
      id: Date.now(),
      time: timestamp,
      type: type,
      message: message,
      prediction: prediction
    }, ...prev].slice(0, 100));
  };

  // Fetch next image from backend
  const fetchNextImage = async () => {
    try {
      const response = await fetch('http://localhost:8000/simulate/next');
      const data = await response.json();
      
      if (data.error) {
        addLog('ERROR', data.error, null);
        return null;
      }
      
      return data;
    } catch (error) {
      addLog('ERROR', 'Failed to connect to backend', null);
      return null;
    }
  };

  // Process one simulation step
  const processSimulationStep = async () => {
    const result = await fetchNextImage();
    
    if (result) {
      // Update current image display
      setCurrentImage(result.image_path);
      setCurrentPrediction(result.prediction);
      setSimulationProgress({ current: result.index, total: result.total });
      
      // Update stats
      setStats(prev => {
        const newStats = { ...prev, total: prev.total + 1 };
        if (result.prediction === 'attack') {
          newStats.attack += 1;
        } else {
          newStats.clean += 1;
        }
        return newStats;
      });
      
      // Add log entry
      const confidencePercent = Math.round(result.confidence * 100);
      addLog(
        result.prediction.toUpperCase(),
        `${result.filename} → ${result.prediction.toUpperCase()} (${confidencePercent}%)`,
        result.prediction
      );
    }
  };

  // Start simulation (infinite loop)
  const startSimulation = async () => {
    if (simulationInterval.current) return;
    
    setIsSimulating(true);
    addLog('INFO', 'Simulation started - infinite loop mode', null);
    
    // Reset stats
    setStats({ total: 0, clean: 0, attack: 0 });
    setCurrentPrediction(null);
    
    // Process first image immediately
    await processSimulationStep();
    
    // Set interval for subsequent images
    simulationInterval.current = setInterval(async () => {
      await processSimulationStep();
    }, 1500); // 1.5 seconds delay
  };

  // Stop simulation
  const stopSimulation = () => {
    if (simulationInterval.current) {
      clearInterval(simulationInterval.current);
      simulationInterval.current = null;
    }
    setIsSimulating(false);
    addLog('INFO', 'Simulation stopped', null);
  };

  // Reset logs
  const resetLogs = () => {
    setLogs([]);
    setStats({ total: 0, clean: 0, attack: 0 });
    setCurrentPrediction(null);
    setCurrentImage(null);
    addLog('INFO', 'Logs cleared', null);
  };

  // Handle image upload
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setUploadPreview(URL.createObjectURL(file));
    setIsUploading(true);
    setUploadResult(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      
      setUploadResult(result);
      addLog(
        result.prediction.toUpperCase(),
        `Upload: ${file.name} → ${result.prediction.toUpperCase()} (${Math.round(result.confidence * 100)}%)`,
        result.prediction
      );
    } catch (error) {
      addLog('ERROR', `Upload failed: ${file.name}`, null);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadPreview(null), 3000);
    }
  };

  return (
    <div className="dashboard">
      {/* Main Layout */}
      <div className="main-grid">
        
        {/* Left Panel - Video Feed */}
        <div className="video-panel">
          <div className="panel-title">📹 DRONE CAMERA FEED</div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="video-feed"
          />
          {cameraPrediction && (
            <div className={`camera-prediction ${cameraPrediction}`}>
              {cameraPrediction.toUpperCase()}
            </div>
          )}
        </div>
        
        {/* Right Panel - Simulation & Upload */}
        <div className="sim-panel">
          
          {/* Upload Section */}
          <div className="upload-section">
            <div className="panel-title">📤 UPLOAD IMAGE</div>
            <label className="upload-btn">
              CHOOSE FILE
              <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
            </label>
            {isUploading && <div className="upload-status">Analyzing...</div>}
            {uploadResult && (
              <div className={`upload-result ${uploadResult.prediction}`}>
                {uploadResult.prediction === 'attack' ? '🔴 ATTACK DETECTED' : '🟢 CLEAN'}
                <span>Confidence: {Math.round(uploadResult.confidence * 100)}%</span>
              </div>
            )}
          </div>
          
          {/* Simulation Controls */}
          <div className="sim-controls">
            <div className="panel-title">🎮 SIMULATION CONTROL</div>
            <div className="button-group">
              <button 
                className="btn-start" 
                onClick={startSimulation}
                disabled={isSimulating}
              >
                ▶ RUN SIMULATION
              </button>
              <button 
                className="btn-stop" 
                onClick={stopSimulation}
                disabled={!isSimulating}
              >
                ⏹ STOP
              </button>
              <button className="btn-reset" onClick={resetLogs}>
                🔄 RESET LOGS
              </button>
            </div>
          </div>
          
          {/* Current Image Display */}
          <div className="current-image">
            <div className="panel-title">🖼 CURRENT IMAGE</div>
            <div className="image-container">
              {currentImage ? (
                <>
                  <img src={`http://localhost:8000${currentImage}`} alt="Current" />
                  <div className={`prediction-badge ${currentPrediction}`}>
                    {currentPrediction === 'attack' ? '🔴 ATTACK' : '🟢 CLEAN'}
                  </div>
                </>
              ) : (
                <div className="no-image">No image processing</div>
              )}
            </div>
          </div>
          
          {/* Statistics */}
          <div className="stats-panel">
            <div className="panel-title">📊 STATISTICS</div>
            <div className="stats-grid">
              <div className="stat">TOTAL: {stats.total}</div>
              <div className="stat clean">CLEAN: {stats.clean}</div>
              <div className="stat attack">ATTACK: {stats.attack}</div>
              <div className="stat">ACCURACY: {stats.total > 0 ? Math.round((stats.clean / stats.total) * 100) : 0}%</div>
            </div>
          </div>
        </div>
        
      </div>
      
      {/* Bottom - Terminal Log */}
      <div className="terminal-panel">
        <div className="terminal-header">
          <span>🔻 SIMULATION LOG</span>
          <span className="terminal-status">
            {isSimulating ? '🟢 RUNNING' : '⚫ STOPPED'}
            {simulationProgress.current > 0 && ` | IMAGE ${simulationProgress.current}/${simulationProgress.total}`}
          </span>
        </div>
        <div className="terminal-body">
          {logs.length === 0 ? (
            <div className="terminal-line"> System ready. Click RUN SIMULATION to start...</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className={`terminal-line ${log.type === 'ATTACK' ? 'attack' : log.type === 'CLEAN' ? 'clean' : 'info'}`}>
                <span className="terminal-time">[{log.time}]</span>
                <span className="terminal-type">[{log.type}]</span>
                <span className="terminal-msg">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;