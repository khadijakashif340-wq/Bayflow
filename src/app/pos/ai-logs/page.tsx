'use client';

import React, { useState, useEffect } from 'react';
import { PosHeader } from '@/components/PosHeader';
import { AIFrontDeskModal } from '@/components/AIFrontDeskModal';

export default function AILogsPage() {
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'TASKS' | 'CALLS'>('TASKS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<any | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/logs');
      const json = await res.json();
      if (res.ok && json.data) {
        setCallLogs(json.data.callLogs || []);
        setTasks(json.data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to load AI logs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleTaskStatus(taskId: string, currentStatus: string) {
    const nextStatus = currentStatus === 'PENDING' ? 'IN_PROGRESS' : currentStatus === 'IN_PROGRESS' ? 'COMPLETED' : 'PENDING';
    try {
      const res = await fetch('/api/ai/logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status: nextStatus }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
        );
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917] flex flex-col font-sans">
      <PosHeader
        stationTitle="AI Front Desk & Automated Dispatch"
        stationSubtitle="OpenRouter Voice Call Records & Automated Task Queue"
        roleBadge="AI Receptionist"
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Banner with Action */}
        <div className="bg-[#1C1917] text-[#FAF7F2] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              <h2 className="text-xl sm:text-2xl font-bold font-heading">
                BayFlow AI Front Desk Center
              </h2>
              <span className="bg-[#E8590C] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                Live
              </span>
            </div>
            <p className="text-sm text-[#E7E0D5]/80 leading-relaxed">
              When workshop advisors are occupied, BayFlow AI automatically answers customer calls, checks vehicle status, quotes itemized parts and labor in PKR, and logs actionable follow-up tasks.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="shrink-0 bg-[#E8590C] hover:bg-[#d04a05] text-white px-5 py-3 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition"
          >
            <span>📞 Simulate Customer Call</span>
          </button>
        </div>

        {/* Tab Switcher & Metrics */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7E0D5] pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('TASKS')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                activeTab === 'TASKS'
                  ? 'bg-[#1C1917] text-white'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-[#E7E0D5]'
              }`}
            >
              <span>Automated Tasks</span>
              <span className="bg-[#E8590C] text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {tasks.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('CALLS')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                activeTab === 'CALLS'
                  ? 'bg-[#1C1917] text-white'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-[#E7E0D5]'
              }`}
            >
              <span>Call Transcripts & Summaries</span>
              <span className="bg-stone-200 text-stone-800 text-xs px-2 py-0.5 rounded-full font-bold">
                {callLogs.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              className="px-3 py-1.5 bg-white border border-[#E7E0D5] text-xs font-semibold rounded-lg hover:bg-stone-50 transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-stone-500">
            <div className="inline-block w-8 h-8 border-4 border-[#E8590C] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium">Loading AI Front Desk logs...</p>
          </div>
        ) : (
          <>
            {/* Tab 1: AI Generated Tasks */}
            {activeTab === 'TASKS' && (
              <div className="space-y-4">
                {tasks.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center border border-[#E7E0D5] space-y-3">
                    <span className="text-4xl">📋</span>
                    <h3 className="font-bold text-base text-stone-800">No Actionable Tasks Right Now</h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto">
                      All AI-generated follow-up items have been resolved, or no customer calls have generated punchlist tasks.
                    </p>
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="mt-2 bg-[#E8590C] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs"
                    >
                      Trigger New Call Test
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-white rounded-2xl p-5 border border-[#E7E0D5] shadow-xs flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                task.priority === 'URGENT'
                                  ? 'bg-red-100 text-red-800'
                                  : task.priority === 'HIGH'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-stone-100 text-stone-700'
                              }`}
                            >
                              {task.priority} Priority
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                task.status === 'COMPLETED'
                                  ? 'bg-teal-100 text-teal-800'
                                  : task.status === 'IN_PROGRESS'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-50 text-amber-900 border border-amber-200'
                              }`}
                            >
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>

                          <h4 className="font-bold text-sm text-[#1C1917] leading-snug">
                            {task.title}
                          </h4>
                          <p className="text-xs text-[#6B645B] leading-relaxed">
                            {task.description}
                          </p>
                        </div>

                        {task.booking && (
                          <div className="bg-[#FAF7F2] p-2.5 rounded-xl border border-[#E7E0D5] text-xs space-y-1">
                            <div className="flex justify-between font-mono font-bold text-stone-900">
                              <span>{task.booking.bookingNumber}</span>
                              <span className="text-[#E8590C]">{task.booking.licensePlate || task.booking.vehiclePlate}</span>
                            </div>
                            <p className="text-[11px] text-stone-500">
                              Status: {task.booking.status}
                            </p>
                          </div>
                        )}

                        <div className="pt-2 border-t border-[#E7E0D5] flex items-center justify-between">
                          <button
                            onClick={() => toggleTaskStatus(task.id, task.status)}
                            className="text-xs font-semibold text-[#E8590C] hover:text-[#d04a05] transition"
                          >
                            Mark {task.status === 'PENDING' ? 'In Progress' : task.status === 'IN_PROGRESS' ? 'Completed' : 'Pending'} &rarr;
                          </button>
                          <span className="text-[10px] text-stone-400">
                            {new Date(task.createdAt).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: AI Call Transcripts & Summaries */}
            {activeTab === 'CALLS' && (
              <div className="space-y-4">
                {callLogs.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center border border-[#E7E0D5] space-y-3">
                    <span className="text-4xl">🎙️</span>
                    <h3 className="font-bold text-base text-stone-800">No Call Logs Recorded Yet</h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto">
                      Simulate a customer call to test Web Speech voice synthesis and automated transcript logging.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {callLogs.map((log) => (
                      <div
                        key={log.id}
                        className="bg-white rounded-2xl p-5 border border-[#E7E0D5] shadow-xs space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#E8590C] flex items-center justify-center font-bold text-lg">
                              📞
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-[#1C1917]">
                                  {log.callerName || 'Inquirer'}
                                </h4>
                                <span className="font-mono text-xs text-stone-500">
                                  ({log.callerPhone || '+92 300 1234567'})
                                </span>
                              </div>
                              <p className="text-xs text-stone-500">
                                Workshop: {log.shop?.name || 'Lahore Central'} • Duration: {log.durationSeconds}s
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {log.booking && (
                              <span className="font-mono text-xs bg-stone-100 px-2 py-1 rounded border border-stone-200 text-stone-800 font-bold">
                                {log.booking.bookingNumber} ({log.booking.licensePlate || log.booking.vehiclePlate})
                              </span>
                            )}
                            <span className="text-[11px] text-stone-400">
                              {new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {/* Executive Summary */}
                        <div className="bg-[#FAF7F2] p-3 rounded-xl border border-[#E7E0D5]">
                          <p className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                            Executive Call Summary
                          </p>
                          <p className="text-xs text-[#1C1917] leading-relaxed">
                            {log.summary}
                          </p>
                        </div>

                        {/* Transcript Collapsible */}
                        <details className="text-xs text-stone-600 bg-stone-50 rounded-xl p-3 border border-stone-200">
                          <summary className="font-semibold text-stone-800 cursor-pointer hover:text-[#E8590C]">
                            View Complete Dialogue Transcript ({log.transcript.split('\n').length} lines)
                          </summary>
                          <div className="mt-3 whitespace-pre-wrap font-sans text-xs bg-white p-3 rounded-lg border border-stone-200 space-y-1 max-h-48 overflow-y-auto">
                            {log.transcript}
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <AIFrontDeskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          fetchLogs();
        }}
      />
    </div>
  );
}
