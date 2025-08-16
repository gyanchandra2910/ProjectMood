import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const PrivacyConsent = ({ onConsentGiven, requiredFeatures = [] }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [consent, setConsent] = useState({
    camera: 'none',
    microphone: 'none',
    storage: 'none'
  });

  useEffect(() => {
    checkExistingConsent();
  }, [user, requiredFeatures]);

  const checkExistingConsent = async () => {
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      const existingConsent = userData?.privacyConsent || {};

      // Check if we need to show consent for any required features
      const needsConsent = requiredFeatures.some(feature => 
        !existingConsent[feature] || existingConsent[feature] === 'none'
      );

      if (needsConsent) {
        setConsent(existingConsent);
        setIsVisible(true);
      } else {
        // User has already given consent for all required features
        onConsentGiven(existingConsent);
      }
    } catch (error) {
      console.error('Error checking consent:', error);
      setIsVisible(true); // Show consent modal if we can't check
    }
  };

  const handleConsentSubmit = async (consentType) => {
    if (!user) return;

    setLoading(true);
    try {
      const newConsent = { ...consent };
      
      // Update consent based on user choice
      requiredFeatures.forEach(feature => {
        if (consentType === 'session') {
          newConsent[feature] = 'session';
        } else if (consentType === 'storage') {
          newConsent[feature] = 'storage';
        }
      });

      // Add timestamp
      newConsent.lastUpdated = new Date().toISOString();
      newConsent.ipAddress = 'client-side'; // In real app, get from server

      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        privacyConsent: newConsent
      });

      setConsent(newConsent);
      setIsVisible(false);
      onConsentGiven(newConsent);
    } catch (error) {
      console.error('Error saving consent:', error);
      alert('Error saving consent preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = () => {
    setIsVisible(false);
    onConsentGiven({ denied: true });
  };

  const getFeatureDescription = (feature) => {
    const descriptions = {
      camera: {
        title: 'Camera Access',
        description: 'We use your camera to analyze facial expressions and determine your mood. Your face image is processed locally and not sent to our servers unless you explicitly opt-in.',
        icon: '📷'
      },
      microphone: {
        title: 'Microphone Access',
        description: 'We record 6 seconds of audio to analyze your voice tone and determine your mood. Audio is processed securely and can be deleted immediately after processing.',
        icon: '🎤'
      },
      storage: {
        title: 'Data Storage',
        description: 'We may store anonymized mood data to improve our service. You can choose session-only processing or allow storage for personalized insights.',
        icon: '💾'
      }
    };
    return descriptions[feature] || { title: feature, description: '', icon: '📋' };
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center mb-4">
          <div className="text-2xl mr-3">🔒</div>
          <h2 className="text-xl font-bold text-gray-800">Privacy & Data Consent</h2>
        </div>

        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            To provide mood detection features, we need your consent to access certain device capabilities. 
            Your privacy is our priority - you have full control over how your data is used.
          </p>

          <div className="space-y-4">
            {requiredFeatures.map(feature => {
              const info = getFeatureDescription(feature);
              return (
                <div key={feature} className="border rounded-lg p-4">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">{info.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-800">{info.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{info.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">🛡️ Your Rights (GDPR Compliant)</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• You can withdraw consent at any time in your profile settings</li>
            <li>• You can request deletion of all stored data</li>
            <li>• You can export your data in a portable format</li>
            <li>• Session-only data is never stored on our servers</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => handleConsentSubmit('session')}
            disabled={loading}
            className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            {loading ? '⏳ Saving...' : '✅ Use for Current Session Only'}
          </button>
          
          <button
            onClick={() => handleConsentSubmit('storage')}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? '⏳ Saving...' : '💾 Allow Storage & Personalization'}
          </button>
          
          <button
            onClick={handleDeny}
            disabled={loading}
            className="sm:w-auto bg-gray-500 text-white px-4 py-3 rounded-lg hover:bg-gray-600 disabled:opacity-50"
          >
            ❌ Deny
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          By continuing, you acknowledge that you have read and understood our data practices. 
          Last updated: August 2025
        </p>
      </div>
    </div>
  );
};

export default PrivacyConsent;
