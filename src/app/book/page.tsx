'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import {
  Wrench,
  Calendar,
  Clock,
  Car,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Shield,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { slideStep, buttonTapProps } from '@/lib/motion';

type Shop = {
  id: string;
  name: string;
  city: string;
  address: string;
  openTime: string;
  closeTime: string;
  workingDays: string;
  maxParallelSlots: number;
};

type Service = {
  id: string;
  name: string;
  description: string;
  category: string;
  durationMinutes: number;
  basePrice: string | number;
};

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  availableSpots: number;
  isFull: boolean;
};

function BookingWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialShopId = searchParams.get('shopId');

  // Wizard state
  const [step, setStep] = useState<number>(1);
  const [direction, setDirection] = useState<number>(1);
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const goToStep = (nextStep: number) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  // Form selections
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>(initialShopId || '');
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  
  // Date & Slot
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');

  // Customer & Vehicle details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+92 ');
  const [customerEmail, setCustomerEmail] = useState('');
  const [vehicleMake, setVehicleMake] = useState('Toyota');
  const [vehicleModel, setVehicleModel] = useState('Corolla Altis');
  const [vehicleYear, setVehicleYear] = useState('2022');
  const [licensePlate, setLicensePlate] = useState('ICT-22-9011');
  const [mileage, setMileage] = useState('32000');
  const [customerNotes, setCustomerNotes] = useState('');

  // 1. Fetch Shops
  useEffect(() => {
    async function loadShops() {
      try {
        setLoading(true);
        const res = await fetch('/api/shops');
        const json = await res.json();
        if (json.data) {
          setShops(json.data);
          if (!selectedShopId && json.data.length > 0) {
            setSelectedShopId(json.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load shops:', err);
      } finally {
        setLoading(false);
      }
    }
    loadShops();
  }, [selectedShopId]);

  // 2. Fetch Services when Shop changes
  useEffect(() => {
    if (!selectedShopId) return;
    async function loadServices() {
      try {
        const res = await fetch(`/api/shops/${selectedShopId}/services`);
        const json = await res.json();
        if (json.data) {
          setServices(json.data);
          // Auto select first service if empty
          if (json.data.length > 0 && selectedServiceIds.length === 0) {
            setSelectedServiceIds([json.data[0].id]);
          }
        }
      } catch (err) {
        console.error('Failed to load services:', err);
      }
    }
    loadServices();
  }, [selectedShopId]);

  // 3. Fetch Slots when Shop or Date changes
  useEffect(() => {
    if (!selectedShopId || !selectedDate) return;
    async function loadSlots() {
      try {
        const res = await fetch(`/api/shops/${selectedShopId}/slots?date=${selectedDate}`);
        const json = await res.json();
        if (json.data) {
          setSlots(json.data);
          const firstAvailable = json.data.find((s: Slot) => !s.isFull);
          if (firstAvailable) {
            setSelectedSlotId(firstAvailable.id);
          } else {
            setSelectedSlotId('');
          }
        }
      } catch (err) {
        console.error('Failed to load slots:', err);
      }
    }
    loadSlots();
  }, [selectedShopId, selectedDate]);

  // Calculations
  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const estimatedTotal = selectedServices.reduce((sum, s) => sum + Number(s.basePrice), 0);
  const selectedShop = shops.find((s) => s.id === selectedShopId);
  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  const toggleService = (id: string) => {
    if (selectedServiceIds.includes(id)) {
      if (selectedServiceIds.length === 1) return; // Keep at least one
      setSelectedServiceIds(selectedServiceIds.filter((item) => item !== id));
    } else {
      setSelectedServiceIds([...selectedServiceIds, id]);
    }
  };

  // Submit Final Booking
  const handleFinalSubmit = async () => {
    try {
      setSubmitting(true);
      setErrorMsg(null);

      const payload = {
        shopId: selectedShopId,
        slotId: selectedSlotId || null,
        serviceIds: selectedServiceIds,
        vehicleMake,
        vehicleModel,
        vehicleYear: parseInt(vehicleYear, 10),
        licensePlate: licensePlate.toUpperCase().trim(),
        mileage: mileage ? parseInt(mileage, 10) : null,
        customerNotes,
        customerName,
        customerPhone,
        customerEmail,
      };

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(json.error?.message || 'Failed to complete booking');
        setSubmitting(false);
        return;
      }

      const booking = json.data;
      router.push(`/track/${booking.bookingNumber}?justBooked=true`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error submitting booking');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
        {/* Wizard Header */}
        <div className="text-center mb-8 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E8590C]">
            Direct Online Booking
          </span>
          <h1 className="text-3xl font-bold font-heading text-[#1C1917]">
            Reserve Your Workshop Bay
          </h1>
          <p className="text-sm text-[#6B645B] max-w-md mx-auto">
            Deterministic bay allocation with itemized digital estimation and certified QC.
          </p>
        </div>

        {/* Stepper Progress Indicator */}
        <div className="card-bayflow p-4 bg-[#FFFFFF] mb-8">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Workshop' },
              { num: 2, label: 'Services' },
              { num: 3, label: 'Date & Slot' },
              { num: 4, label: 'Vehicle' },
              { num: 5, label: 'Review' },
            ].map((s, idx) => (
              <React.Fragment key={s.num}>
                <div className="flex flex-col items-center">
                  <motion.div
                    animate={
                      step === s.num
                        ? { scale: [1, 1.08, 1], transition: { duration: 0.3 } }
                        : { scale: 1 }
                    }
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step === s.num
                        ? 'bg-[#E8590C] text-white shadow-sm ring-4 ring-[#E8590C]/20'
                        : step > s.num
                        ? 'bg-[#0F5C4D] text-white'
                        : 'bg-[#FAF7F2] text-[#6B645B] border border-[#E7E0D5]'
                    }`}
                  >
                    {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </motion.div>
                  <span
                    className={`text-[11px] font-medium mt-1.5 hidden sm:block ${
                      step === s.num ? 'text-[#1C1917] font-semibold' : 'text-[#6B645B]'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < 4 && (
                  <div className="flex-1 h-1 mx-2 bg-stone-100 rounded-full overflow-hidden relative">
                    <motion.div
                      className="h-full bg-[#0F5C4D]"
                      initial={false}
                      animate={{ width: step > s.num ? '100%' : '0%' }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-[#B91C1C]/10 border border-[#B91C1C]/30 text-[#B91C1C] text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Unable to proceed</div>
              <div className="text-xs mt-0.5">{errorMsg}</div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          {/* STEP 1: Workshop Selection */}
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={shouldReduceMotion ? undefined : slideStep}
              initial="initial"
              animate="animate"
              exit="exit"
              className="card-bayflow p-6 bg-[#FFFFFF] space-y-6"
            >
              <div className="border-b border-[#E7E0D5] pb-4">
                <h2 className="text-lg font-bold font-heading text-[#1C1917]">
                  Step 1: Select Verified Workshop
                </h2>
                <p className="text-xs text-[#6B645B] mt-1">
                  Choose the certified facility closest to your location.
                </p>
              </div>

              {loading ? (
                <div className="py-12 flex justify-center text-[#E8590C]">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {shops.map((shop) => (
                    <label
                      key={shop.id}
                      onClick={() => setSelectedShopId(shop.id)}
                      className={`flex items-start justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedShopId === shop.id
                          ? 'border-[#E8590C] bg-[#FAF7F2] ring-1 ring-[#E8590C]'
                          : 'border-[#E7E0D5] bg-[#FFFFFF] hover:bg-[#FAF7F2]/50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold text-base text-[#1C1917]">
                            {shop.name}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#0F5C4D]/10 text-[#0F5C4D]">
                            {shop.city}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#6B645B]">
                          <MapPin className="w-3.5 h-3.5 text-[#6B645B]" />
                          <span>{shop.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#6B645B]">
                          <Clock className="w-3.5 h-3.5 text-[#6B645B]" />
                          <span>{shop.openTime} - {shop.closeTime} ({shop.workingDays})</span>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="shop"
                        checked={selectedShopId === shop.id}
                        onChange={() => setSelectedShopId(shop.id)}
                        className="mt-1 accent-[#E8590C]"
                      />
                    </label>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-[#E7E0D5]">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  disabled={!selectedShopId}
                  className="px-6 py-2.5 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <span>Continue to Services</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

        {/* STEP 2: Service Selection */}
        {step === 2 && (
          <motion.div
            key="step2"
            custom={direction}
            variants={shouldReduceMotion ? undefined : slideStep}
            initial="initial"
            animate="animate"
            exit="exit"
            className="card-bayflow p-6 bg-[#FFFFFF] space-y-6"
          >
            <div className="border-b border-[#E7E0D5] pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-heading text-[#1C1917]">
                  Step 2: Select Required Services
                </h2>
                <p className="text-xs text-[#6B645B] mt-1">
                  Pricing includes genuine fluids and standardized workshop labor in PKR.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#6B645B]">Estimated Subtotal</span>
                <div className="font-mono font-bold text-lg text-[#E8590C]">
                  PKR {estimatedTotal.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {services.map((svc) => {
                const isSelected = selectedServiceIds.includes(svc.id);
                return (
                  <motion.div
                    key={svc.id}
                    whileHover={shouldReduceMotion ? {} : { y: -2 }}
                    whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                    animate={shouldReduceMotion ? {} : { scale: isSelected ? 1 : 0.99 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    onClick={() => toggleService(svc.id)}
                    className={`flex items-start justify-between p-4 rounded-xl border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-[#E8590C] bg-[#FAF7F2] ring-1 ring-[#E8590C]'
                        : 'border-[#E7E0D5] bg-[#FFFFFF] hover:bg-[#FAF7F2]/50'
                    }`}
                  >
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-semibold text-sm text-[#1C1917]">
                          {svc.name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FAF7F2] border border-[#E7E0D5] text-[#6B645B]">
                          {svc.category}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B645B] leading-relaxed">
                        {svc.description}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-[#6B645B] pt-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Approx. {svc.durationMinutes} mins</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-2">
                      <span className="font-mono font-bold text-sm text-[#1C1917]">
                        PKR {Number(svc.basePrice).toLocaleString()}
                      </span>
                      {isSelected ? (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        >
                          <CheckCircle2 className="w-5 h-5 text-[#E8590C]" />
                        </motion.div>
                      ) : (
                        <div className="w-5 h-5 rounded border border-stone-300 bg-white" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="flex justify-between pt-4 border-t border-[#E7E0D5]">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="px-4 py-2.5 border border-[#E7E0D5] text-[#1C1917] rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-[#FAF7F2]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => goToStep(3)}
                disabled={selectedServiceIds.length === 0}
                className="px-6 py-2.5 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <span>Select Appointment Slot</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Slot Selection */}
        {step === 3 && (
          <motion.div
            key="step3"
            custom={direction}
            variants={shouldReduceMotion ? undefined : slideStep}
            initial="initial"
            animate="animate"
            exit="exit"
            className="card-bayflow p-6 bg-[#FFFFFF] space-y-6"
          >
            <div className="border-b border-[#E7E0D5] pb-4">
              <h2 className="text-lg font-bold font-heading text-[#1C1917]">
                Step 3: Select Date & Slot
              </h2>
              <p className="text-xs text-[#6B645B] mt-1">
                Parallel bay capacity ensures your vehicle is checked in promptly.
              </p>
            </div>

            {/* Date Picker Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1C1917] uppercase tracking-wider">
                Appointment Date
              </label>
              <input
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-64 px-4 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm font-medium focus:outline-none focus:border-[#E8590C] text-[#1C1917]"
              />
            </div>

            {/* Slots Grid */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#1C1917] uppercase tracking-wider block">
                Available Hourly Slots ({selectedShop?.name})
              </label>
              {slots.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#6B645B] bg-[#FAF7F2] rounded-xl border border-[#E7E0D5]">
                  No slots available for this day. Please pick another date.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {slots.map((s) => {
                    const startFormatted = new Date(s.startTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const endFormatted = new Date(s.endTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const isSelected = selectedSlotId === s.id;

                    return (
                      <motion.button
                        key={s.id}
                        type="button"
                        disabled={s.isFull}
                        whileHover={s.isFull || shouldReduceMotion ? {} : { y: -2 }}
                        whileTap={s.isFull || shouldReduceMotion ? {} : { scale: 0.98 }}
                        animate={shouldReduceMotion ? {} : { scale: isSelected ? 1 : 0.99 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        onClick={() => setSelectedSlotId(s.id)}
                        className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                          s.isFull
                            ? 'bg-[#FAF7F2] border-[#E7E0D5] opacity-40 cursor-not-allowed'
                            : isSelected
                            ? 'border-[#E8590C] bg-[#FAF7F2] ring-1 ring-[#E8590C]'
                            : 'border-[#E7E0D5] bg-[#FFFFFF] hover:border-[#6B645B]'
                        }`}
                      >
                        <div className="font-mono text-sm font-bold text-[#1C1917]">
                          {startFormatted}
                        </div>
                        <div className="text-[10px] text-[#6B645B] mt-0.5">
                          until {endFormatted}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              s.isFull
                                ? 'bg-[#B91C1C]/10 text-[#B91C1C]'
                                : 'bg-[#0F5C4D]/10 text-[#0F5C4D]'
                            }`}
                          >
                            {s.isFull ? 'Full' : `${s.availableSpots} bays open`}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4 border-t border-[#E7E0D5]">
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="px-4 py-2.5 border border-[#E7E0D5] text-[#1C1917] rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-[#FAF7F2]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => goToStep(4)}
                disabled={!selectedSlotId}
                className="px-6 py-2.5 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <span>Vehicle & Customer Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 4: Vehicle & Customer Details */}
        {step === 4 && (
          <motion.div
            key="step4"
            custom={direction}
            variants={shouldReduceMotion ? undefined : slideStep}
            initial="initial"
            animate="animate"
            exit="exit"
            className="card-bayflow p-6 bg-[#FFFFFF] space-y-6"
          >
            <div className="border-b border-[#E7E0D5] pb-4">
              <h2 className="text-lg font-bold font-heading text-[#1C1917]">
                Step 4: Vehicle & Contact Information
              </h2>
              <p className="text-xs text-[#6B645B] mt-1">
                Used to create your live tracking account and vehicle service record.
              </p>
            </div>

            {/* Vehicle Inputs */}
            <div>
              <span className="text-xs font-bold text-[#E8590C] uppercase tracking-wider block mb-3">
                Vehicle Specifications
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Make</label>
                  <input
                    type="text"
                    required
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    placeholder="e.g. Toyota, Honda, Kia"
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Model</label>
                  <input
                    type="text"
                    required
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="e.g. Civic, Corolla, Sportage"
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Year</label>
                  <input
                    type="number"
                    required
                    min={1990}
                    max={2030}
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">
                    License Plate (Pakistan Format)
                  </label>
                  <input
                    type="text"
                    required
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                    placeholder="e.g. LEA-21-4892, ICT-22-9011"
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl font-mono text-sm uppercase font-semibold text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">
                    Odometer Mileage (km)
                  </label>
                  <input
                    type="number"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    placeholder="e.g. 45000"
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs font-semibold text-[#1C1917] block mb-1">
                  Symptoms or Special Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="e.g. Squeaking noise while turning, AC cooling drops in slow traffic..."
                  className="w-full px-3.5 py-2 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                />
              </div>
            </div>

            {/* Customer Contact */}
            <div className="pt-4 border-t border-[#E7E0D5]">
              <span className="text-xs font-bold text-[#E8590C] uppercase tracking-wider block mb-3">
                Customer Contact Details
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Hamza Khan"
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="hamza@example.com"
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:border-[#E8590C]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-[#E7E0D5]">
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="px-4 py-2.5 border border-[#E7E0D5] text-[#1C1917] rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-[#FAF7F2]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => goToStep(5)}
                disabled={!customerName || !customerPhone || !customerEmail || !vehicleMake || !vehicleModel || !licensePlate}
                className="px-6 py-2.5 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <span>Review & Confirm</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 5: Review & Submit */}
        {step === 5 && (
          <motion.div
            key="step5"
            custom={direction}
            variants={shouldReduceMotion ? undefined : slideStep}
            initial="initial"
            animate="animate"
            exit="exit"
            className="card-bayflow p-6 bg-[#FFFFFF] space-y-6"
          >
            <div className="border-b border-[#E7E0D5] pb-4">
              <h2 className="text-lg font-bold font-heading text-[#1C1917]">
                Step 5: Review Booking Details
              </h2>
              <p className="text-xs text-[#6B645B] mt-1">
                Please verify everything before confirming your workshop bay.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              <div className="space-y-3 bg-[#FAF7F2] p-4 rounded-xl border border-[#E7E0D5]">
                <span className="text-xs font-bold text-[#E8590C] uppercase tracking-wider block">
                  Workshop & Time
                </span>
                <div>
                  <div className="font-semibold text-[#1C1917]">{selectedShop?.name}</div>
                  <div className="text-xs text-[#6B645B]">{selectedShop?.address}, {selectedShop?.city}</div>
                </div>
                <div className="pt-2 border-t border-[#E7E0D5] text-xs space-y-1">
                  <div>
                    <span className="text-[#6B645B]">Date: </span>
                    <span className="font-semibold text-[#1C1917]">{selectedDate}</span>
                  </div>
                  <div>
                    <span className="text-[#6B645B]">Slot: </span>
                    <span className="font-semibold text-[#1C1917]">
                      {selectedSlot ? new Date(selectedSlot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Standard Queue'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-[#FAF7F2] p-4 rounded-xl border border-[#E7E0D5]">
                <span className="text-xs font-bold text-[#E8590C] uppercase tracking-wider block">
                  Vehicle & Customer
                </span>
                <div>
                  <div className="font-semibold text-[#1C1917]">
                    {vehicleYear} {vehicleMake} {vehicleModel}
                  </div>
                  <div className="font-mono text-xs font-bold text-[#0F5C4D]">
                    {licensePlate}
                  </div>
                </div>
                <div className="pt-2 border-t border-[#E7E0D5] text-xs space-y-1">
                  <div>
                    <span className="text-[#6B645B]">Owner: </span>
                    <span className="font-semibold text-[#1C1917]">{customerName}</span>
                  </div>
                  <div>
                    <span className="text-[#6B645B]">Phone: </span>
                    <span className="font-semibold text-[#1C1917]">{customerPhone}</span>
                  </div>
                  <div>
                    <span className="text-[#6B645B]">Email: </span>
                    <span className="font-semibold text-[#1C1917]">{customerEmail}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Services Summary */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#1C1917] uppercase tracking-wider block">
                Selected Services
              </span>
              <div className="space-y-1.5 border border-[#E7E0D5] rounded-xl p-3 bg-[#FAF7F2]/50">
                {selectedServices.map((svc) => (
                  <div key={svc.id} className="flex justify-between text-xs py-1">
                    <span className="text-[#1C1917] font-medium">{svc.name}</span>
                    <span className="font-mono font-semibold text-[#1C1917]">
                      PKR {Number(svc.basePrice).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="border-t border-[#E7E0D5] pt-2 mt-2 flex justify-between text-sm font-bold">
                  <span className="text-[#1C1917]">Estimated Total</span>
                  <span className="font-mono text-[#E8590C]">
                    PKR {estimatedTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0F5C4D]/10 border border-[#0F5C4D]/20 text-[#0F5C4D] text-xs flex items-center gap-2">
              <Shield className="w-4 h-4 shrink-0" />
              <span>
                Zero advance payment required. You will receive itemized estimate approval requests before any repair work starts.
              </span>
            </div>

            <div className="flex justify-between pt-4 border-t border-[#E7E0D5]">
              <button
                type="button"
                onClick={() => goToStep(4)}
                disabled={submitting}
                className="px-4 py-2.5 border border-[#E7E0D5] text-[#1C1917] rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-[#FAF7F2]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="px-8 py-3 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Reserving Bay...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Book Appointment</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>

      <Footer />
    </div>
  );
}

export default function BookingWizardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
        <Loader2 className="w-8 h-8 animate-spin text-[#E8590C]" />
      </div>
    }>
      <BookingWizardContent />
    </Suspense>
  );
}
