'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  tools?: string[];
}

interface AIFrontDeskModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId?: string;
  defaultCallerPhone?: string;
  defaultCallerName?: string;
  defaultBookingNumber?: string;
}

export function AIFrontDeskModal({
  isOpen,
  onClose,
  shopId,
  defaultCallerPhone = '+92 300 1234567',
  defaultCallerName = 'Ahmed Khan',
  defaultBookingNumber = 'BF-2026-1001',
}: AIFrontDeskModalProps) {
  const [callState, setCallState] = useState<'RINGING' | 'CONNECTED' | 'ENDED'>('RINGING');
  const [ringCountdown, setRingCountdown] = useState(20);
  const [duration, setDuration] = useState(0);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Assalam-o-Alaikum! Welcome to BayFlow Auto Front Desk. I am your virtual service assistant. How can I assist you with your vehicle today?',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [summaryData, setSummaryData] = useState<{ summary: string; tasks: any[] } | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callDurationRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle 20s ringing countdown
  useEffect(() => {
    if (!isOpen) {
      setCallState('RINGING');
      setRingCountdown(20);
      setDuration(0);
      setSummaryData(null);
      if (timerRef.current) clearInterval(timerRef.current);
      if (callDurationRef.current) clearInterval(callDurationRef.current);
      return;
    }

    if (callState === 'RINGING') {
      timerRef.current = setInterval(() => {
        setRingCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            // 20s unattended trigger: AI answers automatically!
            handleAcceptCall();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, callState]);

  // Handle call duration counter
  useEffect(() => {
    if (callState === 'CONNECTED') {
      callDurationRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callDurationRef.current) clearInterval(callDurationRef.current);
    }
    return () => {
      if (callDurationRef.current) clearInterval(callDurationRef.current);
    };
  }, [callState]);

  function handleAcceptCall() {
    setCallState('CONNECTED');
    if (timerRef.current) clearInterval(timerRef.current);
    speakVoice('Assalam-o-Alaikum! Welcome to BayFlow Auto Front Desk. How may I help you?');
  }

  function speakVoice(text: string) {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_•]/g, ''));
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  // Web Speech recognition
  function toggleListening() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please type your message below.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          sendMessage(transcript);
        }
      };
      recognition.start();
    } catch (err) {
      console.warn('Recognition start error:', err);
      setIsListening(false);
    }
  }

  async function sendMessage(textToSend?: string) {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInputMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          shopId,
          callerPhone: defaultCallerPhone,
          callerName: defaultCallerName,
        }),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        const toolNames = (json.data.toolCalls || []).map((t: any) => t.tool);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: json.data.message,
            tools: toolNames,
          },
        ]);
        speakVoice(json.data.message);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Apologies, could not process query. Please try again.' },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Connection error with AI Front Desk service.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleEndCall() {
    setLoading(true);
    if (callDurationRef.current) clearInterval(callDurationRef.current);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'Caller' : 'AI Front Desk'}: ${m.content}`)
      .join('\n');

    try {
      const res = await fetch('/api/ai/end-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          bookingNumber: defaultBookingNumber,
          callerPhone: defaultCallerPhone,
          callerName: defaultCallerName,
          transcript,
          durationSeconds: duration || 35,
        }),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        setSummaryData({
          summary: json.data.summary,
          tasks: json.data.tasks,
        });
        setCallState('ENDED');
      } else {
        setCallState('ENDED');
      }
    } catch (e) {
      setCallState('ENDED');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl bg-[#FFFFFF] rounded-2xl shadow-2xl border border-[#E7E0D5] overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Top Header */}
            <div className="bg-[#1C1917] text-[#FAF7F2] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#E8590C] flex items-center justify-center font-bold text-lg shadow-sm">
                  🤖
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base tracking-tight font-heading">BayFlow AI Front Desk</h3>
                    <span className="text-[10px] bg-[#E8590C]/20 border border-[#E8590C]/40 text-[#FFA94D] px-2 py-0.5 rounded-full font-semibold">
                      OpenRouter / Tool Calling
                    </span>
                  </div>
                  <p className="text-xs text-[#E7E0D5]/70">Automated Workshop Receptionist & Dispatcher</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-stone-800 transition"
              >
                ✕
              </button>
            </div>

            {/* State 1: 20-Second Unanswered SA Ringing Alert */}
            {callState === 'RINGING' && (
              <div className="p-8 text-center flex flex-col items-center justify-center space-y-6">
                <div className="relative flex items-center justify-center my-2">
                  {!shouldReduceMotion && (
                    <>
                      <motion.div
                        className="absolute w-28 h-28 rounded-full bg-amber-500/20"
                        animate={{ scale: [1, 1.55, 1], opacity: [0.7, 0, 0.7] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                      />
                      <motion.div
                        className="absolute w-28 h-28 rounded-full bg-amber-500/30"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.9, 0, 0.9] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.5, ease: 'easeOut' }}
                      />
                    </>
                  )}
                  <div className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center relative z-10 shadow-sm">
                    <span className="text-4xl">📞</span>
                  </div>
                  <div className="absolute -top-1 -right-1 bg-[#D97706] text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow z-20">
                    Ringing
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-bold text-[#1C1917] font-heading">
                    Incoming Customer Call
                  </h4>
                  <p className="text-sm text-[#6B645B] mt-1">
                    Caller: <span className="font-semibold text-[#1C1917]">{defaultCallerName}</span> ({defaultCallerPhone})
                  </p>
                  <p className="text-xs text-stone-500 font-mono mt-0.5">
                    Vehicle: 2021 Honda Civic (LEA-21-4892)
                  </p>
                </div>

                {/* 20-second unattended SA trigger with Circular Countdown Ring */}
                <div className="w-full max-w-md bg-stone-100 p-5 rounded-2xl border border-stone-200 flex flex-col items-center gap-4">
                  <div className="flex items-center gap-4 w-full">
                    {/* SVG circular countdown timer */}
                    <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                      <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          stroke="#E7E0D5"
                          strokeWidth="4"
                          fill="transparent"
                        />
                        <motion.circle
                          cx="32"
                          cy="32"
                          r="26"
                          stroke="#E8590C"
                          strokeWidth="4"
                          fill="transparent"
                          strokeLinecap="round"
                          strokeDasharray={163.36}
                          animate={{
                            strokeDashoffset: 163.36 * (1 - ringCountdown / 20),
                          }}
                          transition={{ duration: 0.9, ease: 'linear' }}
                        />
                      </svg>
                      <span className="absolute font-mono font-bold text-sm text-[#E8590C]">
                        {ringCountdown}s
                      </span>
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-stone-800">
                        <span>Unanswered SA Countdown</span>
                        <span className="font-mono text-[#E8590C]">{ringCountdown}s remaining</span>
                      </div>
                      <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                        <motion.div
                          className="bg-[#E8590C] h-2 rounded-full"
                          animate={{ width: `${(ringCountdown / 20) * 100}%` }}
                          transition={{ duration: 0.9, ease: 'linear' }}
                        />
                      </div>
                      <p className="text-[11px] text-stone-500 pt-0.5 leading-snug">
                        Auto-answers after 20s to ensure zero lost customer inquiries.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 w-full max-w-sm">
                  <button
                    onClick={handleAcceptCall}
                    className="flex-1 bg-[#0F5C4D] hover:bg-[#0c4b3f] text-white py-3 px-4 rounded-xl font-semibold shadow-md flex items-center justify-center gap-2 transition"
                  >
                    <span>⚡ Answer with AI Now</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="px-5 py-3 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 font-medium transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* State 2: Call In Progress / Connected */}
            {callState === 'CONNECTED' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Live Call Bar */}
                <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-semibold text-emerald-800">
                      Call Connected • {defaultCallerName}
                    </span>

                    {/* Animated Equalizer Waveform Bars */}
                    <div className="flex items-center gap-0.5 h-4 px-1" title="Voice audio waveform">
                      {[14, 22, 10, 18].map((h, i) => (
                        <motion.span
                          key={i}
                          className="w-1 bg-[#0F5C4D] rounded-full inline-block"
                          animate={
                            shouldReduceMotion
                              ? {}
                              : {
                                  height: [`${h * 0.4}px`, `${h}px`, `${h * 0.3}px`],
                                }
                          }
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            repeatType: 'reverse',
                            delay: i * 0.18,
                            ease: 'easeInOut',
                          }}
                          style={{ height: `${h * 0.6}px` }}
                        />
                      ))}
                    </div>

                    <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-700 font-bold">
                      {Math.floor(duration / 60)
                        .toString()
                        .padStart(2, '0')}
                      :{(duration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVoiceEnabled(!voiceEnabled)}
                      className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 font-medium transition ${
                        voiceEnabled
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-white text-stone-600 border-stone-300'
                      }`}
                      title="Toggle Web Speech synthesis voice output"
                    >
                      <span>{voiceEnabled ? '🔊 Voice On' : '🔇 Muted'}</span>
                    </button>

                    <button
                      onClick={handleEndCall}
                      disabled={loading}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded-lg font-semibold shadow-sm transition"
                    >
                      End & Auto-Log
                    </button>
                  </div>
                </div>

                {/* Conversation Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF7F2]">
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                          m.role === 'user'
                            ? 'bg-[#E8590C] text-white rounded-br-xs'
                            : 'bg-white border border-[#E7E0D5] text-[#1C1917] rounded-bl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        {m.tools && m.tools.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-stone-200 flex flex-wrap gap-1">
                            {m.tools.map((t, tidx) => (
                              <span
                                key={tidx}
                                className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-mono font-semibold"
                              >
                                ⚡ Tool executed: {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 mt-1 px-1">
                        {m.role === 'user' ? 'Customer' : 'AI Front Desk'}
                      </span>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex items-center gap-2 text-stone-500 text-xs py-2">
                      <div className="flex items-center gap-1 h-4">
                        {[12, 20, 8, 16].map((h, i) => (
                          <motion.span
                            key={i}
                            className="w-1 bg-[#E8590C] rounded-full inline-block"
                            animate={{ height: [`4px`, `${h}px`, `4px`] }}
                            transition={{
                              duration: 0.6,
                              repeat: Infinity,
                              repeatType: 'reverse',
                              delay: i * 0.15,
                            }}
                          />
                        ))}
                      </div>
                      <span>AI Front Desk is querying workshop database...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

            {/* Quick Suggestion Pills */}
            <div className="px-4 py-2 bg-stone-100 border-t border-stone-200 flex items-center gap-1.5 overflow-x-auto text-[11px]">
              <span className="text-stone-500 font-medium shrink-0">Quick Queries:</span>
              <button
                type="button"
                onClick={() => sendMessage('Check status of vehicle LEA-21-4892')}
                className="shrink-0 bg-white hover:bg-stone-200 px-2.5 py-1 rounded-md border border-stone-300 text-stone-700"
              >
                Status of LEA-21-4892?
              </button>
              <button
                type="button"
                onClick={() => sendMessage('What is the itemized estimate in PKR for BF-2026-1001?')}
                className="shrink-0 bg-white hover:bg-stone-200 px-2.5 py-1 rounded-md border border-stone-300 text-stone-700"
              >
                Check Estimate (PKR)?
              </button>
              <button
                type="button"
                onClick={() => sendMessage('When will my car be ready for pickup?')}
                className="shrink-0 bg-white hover:bg-stone-200 px-2.5 py-1 rounded-md border border-stone-300 text-stone-700"
              >
                Ready for Pickup?
              </button>
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white border-t border-[#E7E0D5] flex items-center gap-2">
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2.5 rounded-xl border transition flex items-center justify-center ${
                  isListening
                    ? 'bg-red-500 text-white border-red-600 animate-pulse'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border-stone-300'
                }`}
                title={isListening ? 'Listening... click to stop' : 'Click to speak via Microphone'}
              >
                🎤
              </button>

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about status, parts quotation in PKR, or booking details..."
                className="flex-1 px-4 py-2 text-sm border border-[#E7E0D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E8590C]"
              />

              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={loading || !inputMessage.trim()}
                className="bg-[#E8590C] hover:bg-[#d04a05] text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* State 3: Call Concluded & Generated Action Items */}
        {callState === 'ENDED' && summaryData && (
          <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-2xl">✅</span>
              <div>
                <h4 className="font-bold text-emerald-900 text-sm">Call Concluded & Auto-Logged to Database</h4>
                <p className="text-xs text-emerald-700">Duration: {duration} seconds • Caller: {defaultCallerName}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold text-stone-700 uppercase tracking-wider">AI Executive Summary</h5>
              <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E7E0D5] text-sm text-[#1C1917] leading-relaxed">
                {summaryData.summary}
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Automated Follow-Up Tasks Generated ({summaryData.tasks.length})
              </h5>
              <div className="space-y-2">
                {summaryData.tasks.map((task, idx) => (
                  <div key={idx} className="p-3 bg-white border border-stone-200 rounded-xl shadow-xs flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900">{task.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          task.priority === 'URGENT' || task.priority === 'HIGH'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1">{task.description}</p>
                    </div>
                    <span className="text-[10px] bg-stone-100 text-stone-700 px-2 py-1 rounded font-medium shrink-0">
                      Status: {task.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-stone-200">
              <Link
                href="/pos/ai-logs"
                onClick={onClose}
                className="text-xs font-semibold text-[#E8590C] hover:underline"
              >
                View all AI Dispatch Logs & Tasks &rarr;
              </Link>
              <button
                onClick={onClose}
                className="bg-[#1C1917] hover:bg-stone-800 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
