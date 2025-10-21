import React, { useRef, useEffect, useState } from 'react';
import { XIcon } from './Icons';
import { translations } from '../translations';

type TFunction = (key: keyof typeof translations.fr) => string;

interface ScannerModalProps {
  onScan: (code: string) => void;
  onClose: () => void;
  t: TFunction;
}

const ScannerModal: React.FC<ScannerModalProps> = ({ onScan, onClose, t }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        } else {
          setError('getUserMedia not supported on this browser.');
        }
      } catch (err) {
        console.error("Error accessing camera: ", err);
        setError('Could not access the camera. Please check permissions.');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Barcode scanning logic would go here, likely involving a library
  // and analyzing frames from the video stream.
  // For now, we'll just show the video feed.
  const handleSimulateScan = () => {
    // This is a placeholder for a real scan result
    onScan('1234567890123');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-lg w-full p-4 relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100">
          <XIcon className="w-6 h-6" />
        </button>
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 text-center">Scan Barcode</h3>
        {error ? (
          <div className="text-red-500 text-center p-4">{error}</div>
        ) : (
          <video ref={videoRef} className="w-full h-64 bg-black rounded-md" playsInline />
        )}
        <div className="mt-4 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">Point the camera at a barcode.</p>
            {/* Remove this button in production */}
            <button onClick={handleSimulateScan} className="mt-2 bg-teal-500 text-white font-bold py-2 px-4 rounded-lg">
                Simulate Scan
            </button>
        </div>
      </div>
    </div>
  );
};

export default ScannerModal;
