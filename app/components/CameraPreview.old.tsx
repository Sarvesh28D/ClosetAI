// app/components/CameraPreview.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Video, VideoOff } from "lucide-react";
import { GeminiWebSocket } from '../services/geminiWebSocket';
import { Base64 } from 'js-base64';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface CameraPreviewProps {
  onTranscription: (text: string) => void;
}

export default function CameraPreview({ onTranscription }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const geminiWsRef = useRef<GeminiWebSocket | null>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const [isAudioSetup, setIsAudioSetup] = useState(false);
  const setupInProgressRef = useRef(false);
  const [isWebSocketReady, setIsWebSocketReady] = useState(false);
  const imageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [outputAudioLevel, setOutputAudioLevel] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  const cleanupAudio = useCallback(() => {
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const cleanupWebSocket = useCallback(() => {
    if (geminiWsRef.current) {
      geminiWsRef.current.disconnect();
      geminiWsRef.current = null;
    }
  }, []);

  // Simplify sendAudioData to just send continuously
  const sendAudioData = (b64Data: string) => {
    if (!geminiWsRef.current) return;
    geminiWsRef.current.sendMediaChunk(b64Data, "audio/pcm");
  };

  const toggleCamera = async () => {
    if (isStreaming && stream) {
      setIsStreaming(false);
      cleanupWebSocket();
      cleanupAudio();
      stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: false
        });

        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true,
          }
        });

        audioContextRef.current = new AudioContext({
          sampleRate: 16000,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = videoStream;
          videoRef.current.muted = true;
        }

        const combinedStream = new MediaStream([
          ...videoStream.getTracks(),
          ...audioStream.getTracks()
        ]);

        setStream(combinedStream);
        setIsStreaming(true);
      } catch (err) {
        console.error('Error accessing media devices:', err);
        cleanupAudio();
      }
    }
  };

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isStreaming) {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');
    geminiWsRef.current = new GeminiWebSocket(
      (text) => {
        console.log("Received from Gemini:", text);
      },
      () => {
        console.log("[Camera] WebSocket setup complete, starting media capture");
        setIsWebSocketReady(true);
        setConnectionStatus('connected');
      },
      (isPlaying) => {
        setIsModelSpeaking(isPlaying);
      },
      (level) => {
        setOutputAudioLevel(level);
      },
      onTranscription
    );
    geminiWsRef.current.connect();

    return () => {
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
      cleanupWebSocket();
      setIsWebSocketReady(false);
      setConnectionStatus('disconnected');
    };
  }, [isStreaming, onTranscription, cleanupWebSocket]);

  // Start image capture only after WebSocket is ready
  useEffect(() => {
    if (!isStreaming || !isWebSocketReady) return;

    console.log("[Camera] Starting image capture interval");
    imageIntervalRef.current = setInterval(captureAndSendImage, 1000);

    return () => {
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
    };
  }, [isStreaming, isWebSocketReady]);

  // Update audio processing setup
  useEffect(() => {
    if (!isStreaming || !stream || !audioContextRef.current || 
        !isWebSocketReady || isAudioSetup || setupInProgressRef.current) return;

    let isActive = true;
    setupInProgressRef.current = true;

    const setupAudioProcessing = async () => {
      try {
        const ctx = audioContextRef.current;
        if (!ctx || ctx.state === 'closed' || !isActive) {
          setupInProgressRef.current = false;
          return;
        }

        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        await ctx.audioWorklet.addModule('/worklets/audio-processor.js');

        if (!isActive) {
          setupInProgressRef.current = false;
          return;
        }

        audioWorkletNodeRef.current = new AudioWorkletNode(ctx, 'audio-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          processorOptions: {
            sampleRate: 16000,
            bufferSize: 4096,  // Larger buffer size like original
          },
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers'
        });

        const source = ctx.createMediaStreamSource(stream);
        audioWorkletNodeRef.current.port.onmessage = (event) => {
          if (!isActive || isModelSpeaking) return;
          const { pcmData, level } = event.data;
          setAudioLevel(level);

          const pcmArray = new Uint8Array(pcmData);
          const b64Data = Base64.fromUint8Array(pcmArray);
          sendAudioData(b64Data);
        };

        source.connect(audioWorkletNodeRef.current);
        setIsAudioSetup(true);
        setupInProgressRef.current = false;

        return () => {
          source.disconnect();
          if (audioWorkletNodeRef.current) {
            audioWorkletNodeRef.current.disconnect();
          }
          setIsAudioSetup(false);
        };
      } catch (error) {
        if (isActive) {
          cleanupAudio();
          setIsAudioSetup(false);
        }
        setupInProgressRef.current = false;
      }
    };

    console.log("[Camera] Starting audio processing setup");
    setupAudioProcessing();

    return () => {
      isActive = false;
      setIsAudioSetup(false);
      setupInProgressRef.current = false;
      if (audioWorkletNodeRef.current) {
        audioWorkletNodeRef.current.disconnect();
        audioWorkletNodeRef.current = null;
      }
    };
  }, [isStreaming, stream, isWebSocketReady, isModelSpeaking]);

  // Capture and send image
  const captureAndSendImage = () => {
    if (!videoRef.current || !videoCanvasRef.current || !geminiWsRef.current) return;

    const canvas = videoCanvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size to match video
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    // Draw video frame to canvas
    context.drawImage(videoRef.current, 0, 0);

    // Convert to base64 and send
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    const b64Data = imageData.split(',')[1];
    geminiWsRef.current.sendMediaChunk(b64Data, "image/jpeg");
  };
  return (
    <div className="space-y-6">
      {/* Camera Header */}
      <div className="flex items-center justify-between p-4 bg-card/60 backdrop-blur-sm border border-border/30 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-accent to-warning rounded-xl flex items-center justify-center">
            <Video className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground font-fredoka">Style Camera</h3>
            <p className="text-xs text-muted-foreground">Show me your outfit!</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-success animate-pulse' : connectionStatus === 'connecting' ? 'bg-warning animate-pulse' : 'bg-destructive'}`}></div>
          <span className="text-xs font-medium capitalize">{connectionStatus}</span>
        </div>
      </div>

      {/* Camera Container */}
      <div className="relative card-cartoon bg-gradient-to-br from-card/80 to-card/60 p-6">
        <div className="relative aspect-[4/3] w-full max-w-2xl mx-auto rounded-3xl overflow-hidden bg-gradient-to-br from-muted/50 to-muted/30">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Decorative frame overlay */}
          <div className="absolute inset-0 border-4 border-gradient-to-br from-primary/20 via-transparent to-secondary/20 rounded-3xl pointer-events-none"></div>
          
          {/* Connection Status Overlay */}
          {isStreaming && connectionStatus !== 'connected' && (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-[hsl(var(--outfit-buddy))]/90 flex items-center justify-center backdrop-blur-sm rounded-3xl">
              <div className="text-center space-y-4 p-8">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/30 border-t-white mx-auto" />
                  <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border border-white/20 mx-auto" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-white font-bold text-lg font-fredoka">
                    {connectionStatus === 'connecting' ? '✨ Connecting to ClosetAI...' : '❌ Connection Lost'}
                  </h3>
                  <p className="text-white/80 text-sm max-w-xs mx-auto">
                    {connectionStatus === 'connecting' 
                      ? 'Getting ready to analyze your amazing style!' 
                      : 'Trying to reconnect with your fashion assistant...'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Camera Control Button */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <button
              onClick={toggleCamera}
              className={`btn-cartoon relative group w-16 h-16 rounded-full transition-all duration-300 ${
                isStreaming 
                  ? 'bg-gradient-to-br from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70 text-white' 
                  : 'bg-gradient-to-br from-success to-success/80 hover:from-success/90 hover:to-success/70 text-white'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent rounded-full"></div>
              {isStreaming ? (
                <VideoOff className="h-7 w-7 relative z-10" />
              ) : (
                <Video className="h-7 w-7 relative z-10" />
              )}
              
              {/* Tooltip */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-foreground/90 text-background text-xs px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {isStreaming ? 'Stop Camera' : 'Start Camera'}
              </div>
            </button>
          </div>

          {/* Audio Level Indicator */}
          {isStreaming && (
            <div className="absolute top-4 left-4 right-4">
              <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-3 border border-border/30">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isModelSpeaking ? 'bg-info animate-pulse' : 'bg-success animate-pulse'}`}></div>
                    <span className="text-xs font-medium">
                      {isModelSpeaking ? 'ClosetAI Speaking' : 'Listening'}
                    </span>
                  </div>
                  <div className="flex-1 h-2 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-100 ${
                        isModelSpeaking 
                          ? 'bg-gradient-to-r from-info to-info/70' 
                          : 'bg-gradient-to-r from-success to-success/70'
                      }`}
                      style={{ 
                        width: `${Math.max(5, isModelSpeaking ? outputAudioLevel : audioLevel)}%`,
                        transition: 'width 100ms ease-out'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Camera Tips */}
        {!isStreaming && (
          <div className="mt-6 p-4 bg-gradient-to-r from-accent/10 to-warning/10 border border-accent/20 rounded-2xl">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-br from-accent to-warning rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs">💡</span>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-accent-foreground font-fredoka">Style Tips:</h4>
                <ul className="text-sm text-foreground/80 space-y-1">
                  <li>• Stand in good lighting so I can see your outfit clearly</li>
                  <li>• Make sure your full outfit is visible in the camera</li>
                  <li>• Speak naturally - I can hear and respond to you!</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <canvas ref={videoCanvasRef} className="hidden" />
    </div>
  );
}
