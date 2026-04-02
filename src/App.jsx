import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const videoRef = useRef(null);
  const [threatLevel, setThreatLevel] = useState('CLEAR');
  const [confidence, setConfidence] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [scannedCount, setScannedCount] = useState(0);
  const [threatCount, setThreatCount] = useState(0);

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

  // Simulate threat detection (replace with actual API call)
  useEffect(() => {
    const interval = setInterval(() => {
      const random = Math.random();
      if (random > 0.85) {
        setThreatLevel('CRITICAL');
        setConfidence(0.85 + Math.random() * 0.1);
        setThreatCount(prev => prev + 1);
        setAlerts(prev => [{
          id: Date.now(),
          time: new Date().toLocaleTimeString(),
          confidence: 0.85 + Math.random() * 0.1
        }, ...prev].slice(0, 10));
      } else {
        setThreatLevel('CLEAR');
        setConfidence(0.1 + Math.random() * 0.3);
      }
      setScannedCount(prev => prev + 1);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="military-dashboard">
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