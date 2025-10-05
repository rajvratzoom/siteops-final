'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Camera, CameraOff, AlertTriangle, Users, Truck, Loader2, Clock } from 'lucide-react';
import { supabase, DEFAULT_SITE_ID } from '@/lib/supabase';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

type Detection = {
  bbox: [number, number, number, number];
  class: string;
  score: number;
};

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [loadingModel, setLoadingModel] = useState(false);
  const [detectedPeople, setDetectedPeople] = useState(0);
  const [detectedVehicles, setDetectedVehicles] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState<string[]>([]);
  const [monitoringInterval, setMonitoringInterval] = useState(5); // minutes
  const [peopleHistory, setPeopleHistory] = useState<Array<{ count: number; timestamp: number }>>([]);
  const animationFrameRef = useRef<number>();
  const lastCheckRef = useRef<number>(0);
  const alertCooldownRef = useRef<Map<string, number>>(new Map());
  const fallStateRef = useRef<Map<number, { firstDetected: number; alerted: boolean }>>(new Map());
  const [storageError, setStorageError] = useState(false);

  const PROXIMITY_THRESHOLD = 400; // pixels
  const VEHICLE_CLASSES = ['car', 'truck', 'bus', 'motorcycle', 'bicycle'];
  const ALERT_COOLDOWN = 10000; // 10 seconds between same type of alerts
  const FALL_ASPECT_RATIO_THRESHOLD = 0.67; // height/width < this = fallen (1/1.5)
  const FALL_MIN_DURATION = 1500; // milliseconds (1.5 seconds)

  // Load TensorFlow model
  useEffect(() => {
    const loadModel = async () => {
      setLoadingModel(true);
      try {
        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
        console.log('COCO-SSD model loaded');
      } catch (err) {
        console.error('Error loading model:', err);
        setError('Failed to load detection model');
      } finally {
        setLoadingModel(false);
      }
    };
    loadModel();
  }, []);

  const captureScreenshot = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      // Wait for next frame to ensure canvas is fully rendered
      requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        
        if (!canvas || !video) {
          console.warn('⚠️ Canvas or video not ready for screenshot');
          resolve(null);
          return;
        }

        // Use video's actual dimensions for high quality screenshot
        const width = video.videoWidth || canvas.width || 1280;
        const height = video.videoHeight || canvas.height || 720;

        console.log(`📸 Capturing screenshot: ${width}x${height}, canvas: ${canvas.width}x${canvas.height}`);

        // Create a temporary canvas to capture both video and overlay
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const ctx = tempCanvas.getContext('2d');
        
        if (!ctx) {
          console.warn('⚠️ Could not get 2D context');
          resolve(null);
          return;
        }

        // Draw video frame at full resolution
        ctx.drawImage(video, 0, 0, width, height);
        
        // Draw overlay canvas on top (scale if needed)
        if (canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);
          console.log('✅ Overlay canvas drawn on screenshot');
        } else {
          console.warn('⚠️ Canvas has no content, screenshot will be blank');
        }

        // Convert to blob
        tempCanvas.toBlob((blob) => {
          if (blob) {
            console.log(`✅ Screenshot blob created: ${(blob.size / 1024).toFixed(1)}KB`);
          }
          resolve(blob);
        }, 'image/jpeg', 0.95);
      });
    });
  };

  const uploadScreenshot = async (blob: Blob): Promise<string | null> => {
    try {
      const filename = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
      console.log('📸 Uploading screenshot:', filename, `(${(blob.size / 1024).toFixed(1)} KB)`);
      
      const { data, error } = await supabase.storage
        .from('alert-screenshots')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });

      if (error) {
        console.error('❌ Screenshot upload failed:', error.message);
        console.error('Full error:', error);
        
        // Show user-friendly error
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
          console.error('💡 Fix: Create "alert-screenshots" storage bucket in Supabase Dashboard');
          console.error('💡 See SUPABASE_STORAGE_SETUP.md for instructions');
          setStorageError(true);
        }
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('alert-screenshots')
        .getPublicUrl(filename);

      console.log('✅ Screenshot uploaded successfully:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (err) {
      console.error('❌ Screenshot upload error:', err);
      return null;
    }
  };

  const saveAlertToDatabase = async (
    type: string,
    title: string,
    details: any,
    screenshotUrl: string | null
  ) => {
    try {
      console.log('💾 Saving alert:', {
        type,
        title,
        hasScreenshot: !!screenshotUrl,
        screenshotUrl: screenshotUrl ? screenshotUrl.substring(0, 60) + '...' : 'none',
      });

      const { data, error } = await supabase.from('alerts').insert([
        {
          site_id: DEFAULT_SITE_ID,
          type: type,
          severity: type === 'ProximityWarning' ? 'High' : type === 'PersonDown' ? 'Critical' : 'Medium',
          person_track_id: details.person_track_id || null,
          metadata: details,
          snapshot_url: screenshotUrl,
          acknowledged: false,
          created_at: new Date().toISOString(),
        },
      ]).select();

      if (error) {
        console.error('❌ Database insert error:', error);
      } else {
        console.log('✅ Alert saved:', title, '| ID:', data?.[0]?.id);
        if (screenshotUrl) {
          console.log('🖼️  Screenshot URL:', screenshotUrl);
        }
      }
    } catch (err) {
      console.error('❌ Save alert error:', err);
    }
  };

  const canSendAlert = (alertKey: string): boolean => {
    const now = Date.now();
    const lastAlert = alertCooldownRef.current.get(alertKey);
    
    if (!lastAlert || now - lastAlert > ALERT_COOLDOWN) {
      alertCooldownRef.current.set(alertKey, now);
      return true;
    }
    
    return false;
  };

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        lastCheckRef.current = Date.now();
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Failed to access camera. Please grant camera permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setPeopleHistory([]);
    fallStateRef.current.clear(); // Clear fall detection state
  };

  const calculateDistance = (
    bbox1: [number, number, number, number],
    bbox2: [number, number, number, number]
  ): number => {
    const center1 = {
      x: bbox1[0] + bbox1[2] / 2,
      y: bbox1[1] + bbox1[3] / 2,
    };
    const center2 = {
      x: bbox2[0] + bbox2[2] / 2,
      y: bbox2[1] + bbox2[3] / 2,
    };

    return Math.sqrt(
      Math.pow(center2.x - center1.x, 2) + Math.pow(center2.y - center1.y, 2)
    );
  };

  const drawDetections = async (detections: Detection[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const people = detections.filter((d) => d.class === 'person');
    const vehicles = detections.filter((d) => VEHICLE_CLASSES.includes(d.class));

    setDetectedPeople(people.length);
    setDetectedVehicles(vehicles.length);

    // Record people count for headcount monitoring
    const now = Date.now();
    setPeopleHistory((prev) => {
      const updated = [...prev, { count: people.length, timestamp: now }];
      // Keep only last N minutes of data
      const cutoff = now - monitoringInterval * 60 * 1000;
      return updated.filter((entry) => entry.timestamp >= cutoff);
    });

    // Check if monitoring interval has passed
    if (now - lastCheckRef.current >= monitoringInterval * 60 * 1000) {
      checkHeadcount();
      lastCheckRef.current = now;
    }

    const proximityPairs: Array<{ person: Detection; vehicle: Detection; distance: number }> = [];
    
    people.forEach((person, pIdx) => {
      vehicles.forEach((vehicle, vIdx) => {
        const distance = calculateDistance(person.bbox, vehicle.bbox);
        if (distance <= PROXIMITY_THRESHOLD) {
          proximityPairs.push({ person, vehicle, distance });
          
          const alertMsg = `⚠️ Person too close to ${vehicle.class} (${Math.round(distance)}px)`;
          setRecentAlerts((prev) => {
            const newAlerts = [alertMsg, ...prev];
            return newAlerts.slice(0, 5);
          });

          // Save to database with screenshot
          const alertKey = `proximity_${pIdx}_${vIdx}`;
          if (canSendAlert(alertKey)) {
            const title = `Proximity Warning: Person near ${vehicle.class}`;
            captureScreenshot().then(async (blob) => {
              const screenshotUrl = blob ? await uploadScreenshot(blob) : null;
              await saveAlertToDatabase(
                'ProximityWarning',
                title,
                {
                  person_track_id: pIdx,
                  vehicle_type: vehicle.class,
                  distance_px: Math.round(distance),
                  person_confidence: person.score,
                  vehicle_confidence: vehicle.score,
                },
                screenshotUrl
              );
            });
          }
        }
      });
    });

    // Draw proximity lines
    proximityPairs.forEach(({ person, vehicle, distance }) => {
      const personCenter = {
        x: person.bbox[0] + person.bbox[2] / 2,
        y: person.bbox[1] + person.bbox[3] / 2,
      };
      const vehicleCenter = {
        x: vehicle.bbox[0] + vehicle.bbox[2] / 2,
        y: vehicle.bbox[1] + vehicle.bbox[3] / 2,
      };

      ctx.beginPath();
      ctx.setLineDash([10, 5]);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 3;
      ctx.moveTo(personCenter.x, personCenter.y);
      ctx.lineTo(vehicleCenter.x, vehicleCenter.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const midX = (personCenter.x + vehicleCenter.x) / 2;
      const midY = (personCenter.y + vehicleCenter.y) / 2;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(midX - 40, midY - 15, 80, 30);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(distance)}px`, midX, midY);

      ctx.beginPath();
      ctx.arc(personCenter.x, personCenter.y, 40, 0, 2 * Math.PI);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    // Fall detection
    const fallenPeople: Set<number> = new Set();
    const activeFallStates = new Map(fallStateRef.current);
    
    people.forEach((detection, idx) => {
      const [x, y, width, height] = detection.bbox;
      const aspectRatio = height / width;
      
      // Check if person is in horizontal pose (fallen)
      if (aspectRatio < FALL_ASPECT_RATIO_THRESHOLD) {
        const existingState = activeFallStates.get(idx);
        const now = Date.now();
        
        if (!existingState) {
          // First time detecting this person as fallen
          activeFallStates.set(idx, { firstDetected: now, alerted: false });
        } else {
          const duration = now - existingState.firstDetected;
          
          if (duration >= FALL_MIN_DURATION && !existingState.alerted) {
            // Person has been down long enough - trigger alert
            fallenPeople.add(idx);
            existingState.alerted = true;
            
            const alertMsg = `⚠️ PERSON DOWN! (down for ${(duration / 1000).toFixed(1)}s)`;
            setRecentAlerts((prev) => {
              const newAlerts = [alertMsg, ...prev];
              return newAlerts.slice(0, 5);
            });
            
            const alertKey = `fall_${idx}`;
            if (canSendAlert(alertKey)) {
              const title = `Fall Alert: Person Detected Down`;
              captureScreenshot().then(async (blob) => {
                const screenshotUrl = blob ? await uploadScreenshot(blob) : null;
                await saveAlertToDatabase(
                  'PersonDown',
                  title,
                  {
                    person_track_id: idx,
                    duration_s: duration / 1000,
                    aspect_ratio: aspectRatio.toFixed(2),
                    person_confidence: detection.score,
                  },
                  screenshotUrl
                );
              });
            }
          } else if (duration >= FALL_MIN_DURATION) {
            // Still fallen and already alerted
            fallenPeople.add(idx);
          }
        }
      } else {
        // Person is upright - remove from fall state
        activeFallStates.delete(idx);
      }
    });
    
    // Update fall state ref
    fallStateRef.current = activeFallStates;

    // Draw people boxes (green for normal, RED for fallen)
    people.forEach((detection, idx) => {
      const [x, y, width, height] = detection.bbox;
      const isFallen = fallenPeople.has(idx);
      
      ctx.strokeStyle = isFallen ? '#ff0000' : '#00ff00';
      ctx.lineWidth = isFallen ? 4 : 3;
      ctx.strokeRect(x, y, width, height);

      const label = isFallen 
        ? `⚠️ PERSON DOWN` 
        : `Person ${Math.round(detection.score * 100)}%`;
      ctx.font = isFallen ? 'bold 18px Arial' : '16px Arial';
      const textWidth = ctx.measureText(label).width;
      
      ctx.fillStyle = isFallen ? '#ff0000' : '#00ff00';
      ctx.fillRect(x, y - 25, textWidth + 10, 25);
      
      ctx.fillStyle = isFallen ? '#ffffff' : '#000000';
      ctx.fillText(label, x + 5, y - 7);
    });

    // Draw vehicle boxes (blue)
    vehicles.forEach((detection) => {
      const [x, y, width, height] = detection.bbox;
      
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      const label = `${detection.class} ${Math.round(detection.score * 100)}%`;
      ctx.font = '16px Arial';
      const textWidth = ctx.measureText(label).width;
      
      ctx.fillStyle = '#0066ff';
      ctx.fillRect(x, y - 25, textWidth + 10, 25);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + 5, y - 7);
    });
  };

  const checkHeadcount = async () => {
    if (peopleHistory.length === 0) return;

    // Calculate mode (most frequent count)
    const counts = peopleHistory.map((entry) => entry.count);
    const frequency: Record<number, number> = {};
    counts.forEach((count) => {
      frequency[count] = (frequency[count] || 0) + 1;
    });

    const mode = parseInt(
      Object.keys(frequency).reduce((a, b) =>
        frequency[parseInt(a)] > frequency[parseInt(b)] ? a : b
      )
    );

    // For demo, assume expected count is set somewhere (could be from People page)
    // Here we'll just alert if mode changes significantly
    const currentCount = detectedPeople;
    
    if (Math.abs(mode - currentCount) > 1) {
      const alertKey = 'headcount_mismatch';
      if (canSendAlert(alertKey)) {
        const title = `Headcount Alert: Detected ${mode} people`;
        const alertMsg = `👥 Headcount: Mode ${mode}, Current ${currentCount}`;
        setRecentAlerts((prev) => [alertMsg, ...prev].slice(0, 5));

        captureScreenshot().then(async (blob) => {
          const screenshotUrl = blob ? await uploadScreenshot(blob) : null;
          await saveAlertToDatabase(
            'HeadcountMismatch',
            title,
            {
              mode_count: mode,
              current_count: currentCount,
              monitoring_interval_minutes: monitoringInterval,
            },
            screenshotUrl
          );
        });
      }
    }
  };

  const detectObjects = async () => {
    if (!model || !videoRef.current || !isStreaming) return;

    try {
      const predictions = await model.detect(videoRef.current);
      
      const detections: Detection[] = predictions.map((pred) => ({
        bbox: pred.bbox as [number, number, number, number],
        class: pred.class,
        score: pred.score,
      }));

      await drawDetections(detections);
    } catch (err) {
      console.error('Detection error:', err);
    }

    if (isStreaming) {
      animationFrameRef.current = requestAnimationFrame(detectObjects);
    }
  };

  useEffect(() => {
    if (isStreaming && model) {
      detectObjects();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isStreaming, model]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Live Camera Monitoring</h1>
        <p className="text-gray-500 mt-1">Real-time safety detection with TensorFlow.js</p>
      </div>

      {loadingModel && (
        <Alert className="border-blue-300 bg-blue-50">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          <AlertDescription className="text-blue-800">
            Loading AI detection model... This may take a moment.
          </AlertDescription>
        </Alert>
      )}

      {/* Monitoring Interval Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Headcount Monitoring Interval
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              min="1"
              max="60"
              value={monitoringInterval}
              onChange={(e) => setMonitoringInterval(parseInt(e.target.value) || 1)}
              className="w-24"
            />
            <span className="text-sm text-gray-600">
              minutes - System checks headcount every {monitoringInterval} minute{monitoringInterval !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Alerts are automatically saved to the database with screenshots and timestamps
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Camera Feed</span>
              <div className="flex gap-2">
                {!isStreaming ? (
                  <Button onClick={startCamera} size="sm" disabled={loadingModel || !model}>
                    <Camera className="w-4 h-4 mr-2" />
                    Start Camera
                  </Button>
                ) : (
                  <Button onClick={stopCamera} variant="destructive" size="sm">
                    <CameraOff className="w-4 h-4 mr-2" />
                    Stop Camera
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
              />
              {!isStreaming && !error && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <div className="text-center">
                    <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Click "Start Camera" to begin monitoring</p>
                    {loadingModel && <p className="text-sm mt-2">Loading AI model...</p>}
                  </div>
                </div>
              )}
              {isStreaming && (
                <div className="absolute top-4 left-4 space-y-2">
                  <Badge className="bg-red-600 text-white">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2" />
                    LIVE DETECTION
                  </Badge>
                </div>
              )}
            </div>

            {error && (
              <Alert className="mt-4 border-red-300 bg-red-50">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            {storageError && (
              <Alert className="mt-4 border-yellow-300 bg-yellow-50">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <strong>Storage not configured:</strong> Alert screenshots won't be saved. 
                  <br />
                  <span className="text-xs mt-1 block">
                    Create the <code className="bg-yellow-100 px-1 rounded">alert-screenshots</code> storage bucket in Supabase. 
                    See <code className="bg-yellow-100 px-1 rounded">SUPABASE_STORAGE_SETUP.md</code> for instructions.
                  </span>
                </AlertDescription>
              </Alert>
            )}

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">Detection Status</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">People Detected</p>
                    <p className="text-2xl font-bold text-green-600">{detectedPeople}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Vehicles Detected</p>
                    <p className="text-2xl font-bold text-blue-600">{detectedVehicles}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {recentAlerts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No alerts</p>
            ) : (
              <div className="space-y-2">
                {recentAlerts.map((alert, i) => (
                  <Alert key={i} className="border-orange-300 bg-orange-50">
                    <AlertDescription className="text-sm text-orange-800">
                      {alert}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-4">
              Alerts are saved to database with screenshots
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detection Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded"></span>
                People Detection
              </h3>
              <p className="text-gray-600">
                Green bounding boxes identify people in the frame with confidence scores.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded"></span>
                Vehicle Detection
              </h3>
              <p className="text-gray-600">
                Blue boxes identify vehicles (cars, trucks, buses, motorcycles).
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded"></span>
                Proximity Warning
              </h3>
              <p className="text-gray-600">
                Red dashed lines appear when person is within {PROXIMITY_THRESHOLD}px of a vehicle.
                Screenshots saved to database.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="w-3 h-3 bg-purple-500 rounded"></span>
                Headcount Monitoring
              </h3>
              <p className="text-gray-600">
                Checks people count every {monitoringInterval} min. Alerts with screenshots when mismatch detected.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}