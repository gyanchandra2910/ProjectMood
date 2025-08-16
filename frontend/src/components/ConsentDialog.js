/**
 * Accessible Consent Dialog Component
 * Manages user consent for audio/video usage with GDPR compliance
 */

import React, { useState, useEffect, useRef } from 'react';
import './ConsentDialog.css';

const ConsentDialog = ({ 
  isOpen, 
  onConsent, 
  onDecline, 
  features = ['microphone', 'camera'],
  privacyPolicyUrl = '/privacy-policy',
  onSavePreferences = null 
}) => {
  const [sessionConsent, setSessionConsent] = useState({});
  const [persistentConsent, setPersistentConsent] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  const dialogRef = useRef(null);
  const initialFocusRef = useRef(null);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      // Focus management for accessibility
      const focusableElements = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }

      // Trap focus within dialog
      const handleTabKey = (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === focusableElements[0]) {
              e.preventDefault();
              focusableElements[focusableElements.length - 1].focus();
            }
          } else {
            if (document.activeElement === focusableElements[focusableElements.length - 1]) {
              e.preventDefault();
              focusableElements[0].focus();
            }
          }
        }
      };

      const handleEscapeKey = (e) => {
        if (e.key === 'Escape') {
          handleDecline();
        }
      };

      document.addEventListener('keydown', handleTabKey);
      document.addEventListener('keydown', handleEscapeKey);

      return () => {
        document.removeEventListener('keydown', handleTabKey);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isOpen]);

  const handleSessionConsentChange = (feature, granted) => {
    setSessionConsent(prev => ({
      ...prev,
      [feature]: granted
    }));
  };

  const handlePersistentConsentChange = (feature, granted) => {
    setPersistentConsent(prev => ({
      ...prev,
      [feature]: granted
    }));
  };

  const handleAccept = () => {
    const finalConsent = {
      session: sessionConsent,
      persistent: persistentConsent,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };

    // Save to localStorage if persistent consent given
    Object.keys(persistentConsent).forEach(feature => {
      if (persistentConsent[feature]) {
        localStorage.setItem(`consent_${feature}`, JSON.stringify({
          granted: true,
          timestamp: finalConsent.timestamp,
          version: finalConsent.version
        }));
      }
    });

    onConsent(finalConsent);
  };

  const handleDecline = () => {
    const declineData = {
      session: {},
      persistent: {},
      declined: true,
      timestamp: new Date().toISOString()
    };

    onDecline(declineData);
  };

  const getFeatureDescription = (feature) => {
    const descriptions = {
      microphone: {
        title: 'Microphone Access',
        description: 'Analyze your voice for mood detection and enhance your music experience.',
        details: 'Your voice will be processed locally on your device. Audio data is not stored unless you explicitly choose to save mood profiles.',
        risks: 'Voice patterns could potentially be used to identify emotional states.',
        benefits: 'More accurate mood detection and personalized music recommendations.'
      },
      camera: {
        title: 'Camera Access',
        description: 'Detect facial expressions to understand your emotional state.',
        details: 'Facial analysis happens in your browser. Images are never stored or transmitted unless you opt in to enhanced features.',
        risks: 'Facial data could be used for identification if stored.',
        benefits: 'Real-time emotion detection for better mood-based music matching.'
      },
      location: {
        title: 'Location Access',
        description: 'Find nearby users and location-based mood trends.',
        details: 'Location data is used only for discovering local music rooms and events.',
        risks: 'Location data could reveal personal patterns and habits.',
        benefits: 'Connect with nearby users and discover local music scenes.'
      }
    };

    return descriptions[feature] || {
      title: feature,
      description: `Access to ${feature} for enhanced functionality.`,
      details: 'This feature enhances your experience with additional capabilities.',
      risks: 'Data usage depends on your privacy settings.',
      benefits: 'Improved personalization and functionality.'
    };
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="consent-dialog-backdrop"
        aria-hidden="true"
        onClick={handleDecline}
      />
      
      {/* Dialog */}
      <div
        ref={dialogRef}
        className="consent-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-dialog-title"
        aria-describedby="consent-dialog-description"
      >
        <div className="consent-dialog-header">
          <h2 id="consent-dialog-title" className="consent-dialog-title">
            🔒 Privacy & Consent
          </h2>
          <button
            type="button"
            className="consent-dialog-close"
            onClick={handleDecline}
            aria-label="Close consent dialog"
          >
            ×
          </button>
        </div>

        <div className="consent-dialog-content">
          <div id="consent-dialog-description" className="consent-dialog-intro">
            <p>
              MoodFusion respects your privacy. We need your consent to access certain features 
              that enhance your music experience. You have full control over your data.
            </p>
          </div>

          <div className="consent-features">
            {features.map(feature => {
              const featureInfo = getFeatureDescription(feature);
              
              return (
                <div key={feature} className="consent-feature">
                  <div className="consent-feature-header">
                    <h3 className="consent-feature-title">
                      {featureInfo.title}
                    </h3>
                    <button
                      type="button"
                      className="consent-feature-toggle"
                      onClick={() => setShowDetails(prev => ({ ...prev, [feature]: !prev[feature] }))}
                      aria-expanded={showDetails[feature] || false}
                      aria-controls={`consent-details-${feature}`}
                    >
                      {showDetails[feature] ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>

                  <p className="consent-feature-description">
                    {featureInfo.description}
                  </p>

                  {showDetails[feature] && (
                    <div 
                      id={`consent-details-${feature}`}
                      className="consent-feature-details"
                    >
                      <div className="consent-detail-section">
                        <h4>How it works:</h4>
                        <p>{featureInfo.details}</p>
                      </div>
                      
                      <div className="consent-detail-section">
                        <h4>Potential risks:</h4>
                        <p>{featureInfo.risks}</p>
                      </div>
                      
                      <div className="consent-detail-section">
                        <h4>Benefits:</h4>
                        <p>{featureInfo.benefits}</p>
                      </div>
                    </div>
                  )}

                  <div className="consent-feature-controls">
                    <div className="consent-option">
                      <label className="consent-checkbox-label">
                        <input
                          type="checkbox"
                          checked={sessionConsent[feature] || false}
                          onChange={(e) => handleSessionConsentChange(feature, e.target.checked)}
                          aria-describedby={`session-help-${feature}`}
                        />
                        <span className="consent-checkbox-text">
                          Use for this session only
                        </span>
                      </label>
                      <div 
                        id={`session-help-${feature}`}
                        className="consent-help-text"
                      >
                        Temporary access that expires when you close the browser
                      </div>
                    </div>

                    <div className="consent-option">
                      <label className="consent-checkbox-label">
                        <input
                          type="checkbox"
                          checked={persistentConsent[feature] || false}
                          onChange={(e) => handlePersistentConsentChange(feature, e.target.checked)}
                          aria-describedby={`persistent-help-${feature}`}
                        />
                        <span className="consent-checkbox-text">
                          Save for future sessions
                        </span>
                      </label>
                      <div 
                        id={`persistent-help-${feature}`}
                        className="consent-help-text"
                      >
                        Remember your choice for future visits (you can change this anytime)
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="consent-dialog-info">
            <h3>Your Rights</h3>
            <ul>
              <li>You can withdraw consent at any time in your profile settings</li>
              <li>You can request deletion of all stored data</li>
              <li>You can export your data in a machine-readable format</li>
              <li>Data processing is minimized and happens locally when possible</li>
            </ul>

            <p>
              <a 
                href={privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="consent-privacy-link"
              >
                Read our full Privacy Policy
              </a>
            </p>
          </div>
        </div>

        <div className="consent-dialog-actions">
          <button
            type="button"
            className="consent-button consent-button-secondary"
            onClick={handleDecline}
          >
            Decline All
          </button>
          
          <button
            type="button"
            className="consent-button consent-button-primary"
            onClick={handleAccept}
            disabled={Object.keys(sessionConsent).length === 0 && Object.keys(persistentConsent).length === 0}
          >
            Accept Selected
          </button>
        </div>
      </div>
    </>
  );
};

export default ConsentDialog;
