import React, { useState, useRef } from 'react';

const API_BASE = 'http://13.201.67.186:8080';
const S3_BASE = 'https://adversarial-firewall-frontend.s3.ap-south-1.amazonaws.com';

function App() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [simProgress, setSimProgress] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const imageIndexRef = useRef(1);
  const shouldStopRef = useRef(false);
  const timeoutRef = useRef(null);

  const addAlert = (type, message, confidence = null) => {
    const newAlert = {
      id: Date.now(),
      type: type.toUpperCase(),
      message: message,
      confidence: confidence,
      time: new Date().toLocaleTimeString()
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 50));
  };

  // Predict image from blob
  const predictImage = async (imageBlob, filename) => {
    try {
      const formData = new FormData();
      formData.append('file', imageBlob, filename);
      
      const response = await fetch(`${API_BASE}/api/predict`, {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Prediction error:', error);
      return { prediction: 0, confidence: 0 };
    }
  };

  // Process image using img tag (no fetch needed for image itself)
  const processImage = async (imageNumber) => {
    try {
      const imageUrl = `${S3_BASE}/simulation/${imageNumber}.jpeg`;
      
      // Fetch the image as blob for prediction only
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const result = await predictImage(blob, `${imageNumber}.jpeg`);
      
      const isAttack = result.prediction === 1;
      const confidencePercent = (result.confidence * 100).toFixed(1);
      
      setCurrentImage(imageUrl);
      setCurrentPrediction(isAttack ? 'attack' : 'clean');
      setCurrentConfidence(confidencePercent);
      setSimProgress(Math.round((imageNumber / 20) * 100));
      
      if (isAttack) {
        addAlert('ATTACK', `Image ${imageNumber}: ATTACK detected!`, confidencePercent);
      } else {
        addAlert('CLEAN', `Image ${imageNumber}: CLEAN - Safe`, confidencePercent);
      }
      
      return true;
    } catch (error) {
      addAlert('ERROR', `Failed to load image ${imageNumber}: ${error.message}`);
      return false;
    }
  };

  const startSimulation = async () => {
    if (isSimulating) return;
    
    shouldStopRef.current = false;
    setIsSimulating(true);
    imageIndexRef.current = 1;
    addAlert('INFO', 'Simulation started - scanning images continuously');
    
    const runNext = async () => {
      if (shouldStopRef.current) {
        setIsSimulating(false);
        setCurrentImage(null);
        setCurrentPrediction(null);
        setSimProgress(0);
        addAlert('INFO', 'Simulation stopped');
        return;
      }
      
      await processImage(imageIndexRef.current);
      imageIndexRef.current = (imageIndexRef.current % 20) + 1;
      timeoutRef.current = setTimeout(runNext, 1500);
    };
    
    runNext();
  };

  const stopSimulation = () => {
    if (!isSimulating) return;
    shouldStopRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const resetAll = () => {
    stopSimulation();
    setAlerts([]);
    setUploadPreview(null);
    setUploadResult(null);
    setCurrentImage(null);
    setCurrentPrediction(null);
    setSimProgress(0);
    addAlert('INFO', 'System reset');
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setUploadPreview(URL.createObjectURL(file));
    setIsProcessing(true);
    setUploadResult(null);
    
    const result = await predictImage(file, file.name);
    const isAttack = result.prediction === 1;
    const confidencePercent = (result.confidence * 100).toFixed(1);
    
    setUploadResult({ isAttack, confidence: confidencePercent });
    addAlert(isAttack ? 'ATTACK' : 'CLEAN', `Uploaded ${file.name}: ${isAttack ? 'ATTACK' : 'CLEAN'}`, confidencePercent);
    setIsProcessing(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', color: 'white', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.5)', padding: '20px', textAlign: 'center', borderBottom: '2px solid #00d4ff' }}>
        <h1 style={{ margin: 0, color: '#00d4ff' }}>🤖 Adversarial AI Firewall</h1>
        <p style={{ margin: '10px 0 0', opacity: 0.8 }}>Real-time Adversarial Attack Detection for Military Drones</p>
      </div>

      <div style={{ display: 'flex', gap: '20px', padding: '20px', flexWrap: 'wrap' }}>
        
        <div style={{ flex: 2, minWidth: '300px' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
            <h3>🎯 CURRENT IMAGE</h3>
            <div style={{ background: '#0f0f1a', borderRadius: '10px', padding: '20px', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {currentImage ? (
                <>
                  <img src={currentImage} alt="Current" style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '10px' }} crossOrigin="anonymous" />
                  <div style={{ marginTop: '15px', padding: '10px 20px', borderRadius: '20px', background: currentPrediction === 'attack' ? '#ff416c' : '#00b09b', fontWeight: 'bold' }}>
                    {currentPrediction === 'attack' ? '🔴 ATTACK DETECTED' : '🟢 CLEAN'}
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '14px' }}>Confidence: {currentConfidence}%</div>
                </>
              ) : (
                <div style={{ color: '#666' }}>No image being processed</div>
              )}
            </div>
            
            {isSimulating && (
              <div style={{ marginTop: '15px' }}>
                <div style={{ background: '#333', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${simProgress}%`, background: 'linear-gradient(90deg, #00d4ff, #00b09b)', padding: '8px', textAlign: 'center', transition: 'width 0.3s' }}>
                    {simProgress}%
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '20px', marginTop: '20px' }}>
            <h3>📤 UPLOAD IMAGE</h3>
            <label style={{ display: 'inline-block', background: '#00d4ff', color: '#1a1a2e', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
              CHOOSE FILE
              <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
            </label>
            
            {uploadPreview && (
              <div style={{ marginTop: '15px' }}>
                <img src={uploadPreview} alt="Preview" style={{ maxWidth: '200px', borderRadius: '10px' }} />
                {isProcessing && <p>Analyzing...</p>}
                {uploadResult && (
                  <div style={{ marginTop: '10px', padding: '10px', borderRadius: '10px', background: uploadResult.isAttack ? '#ff416c' : '#00b09b' }}>
                    <strong>{uploadResult.isAttack ? '🚨 ATTACK DETECTED!' : '✅ CLEAN'}</strong>
                    <p>Confidence: {uploadResult.confidence}%</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: '300px' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
            <h3>🎮 CONTROLS</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={startSimulation} disabled={isSimulating} style={{ padding: '10px 20px', background: isSimulating ? '#555' : '#00b09b', border: 'none', borderRadius: '5px', color: 'white', cursor: isSimulating ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                🚀 RUN SIMULATION
              </button>
              <button onClick={stopSimulation} disabled={!isSimulating} style={{ padding: '10px 20px', background: !isSimulating ? '#555' : '#ff416c', border: 'none', borderRadius: '5px', color: 'white', cursor: !isSimulating ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                ⏹️ STOP
              </button>
              <button onClick={resetAll} style={{ padding: '10px 20px', background: '#ff9800', border: 'none', borderRadius: '5px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                🔄 RESET
              </button>
            </div>
            <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.7 }}>
              Status: {isSimulating ? '🟢 SIMULATING' : '⚫ IDLE'}
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '20px', height: '400px', overflowY: 'auto' }}>
            <h3>📋 LIVE LOGS</h3>
            {alerts.length === 0 ? (
              <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>System ready. Click RUN to start simulation...</div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} style={{ padding: '8px', marginBottom: '5px', borderRadius: '5px', background: alert.type === 'ATTACK' ? 'rgba(255,65,108,0.2)' : alert.type === 'CLEAN' ? 'rgba(0,176,155,0.2)' : 'rgba(0,212,255,0.2)', borderLeft: `3px solid ${alert.type === 'ATTACK' ? '#ff416c' : alert.type === 'CLEAN' ? '#00b09b' : '#00d4ff'}` }}>
                  <span style={{ fontSize: '11px', color: '#888' }}>[{alert.time}]</span>
                  <span style={{ fontWeight: 'bold', marginLeft: '8px' }}>[{alert.type}]</span>
                  <span style={{ marginLeft: '8px' }}>{alert.message}</span>
                  {alert.confidence && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#00d4ff' }}>({alert.confidence}% confidence)</span>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
