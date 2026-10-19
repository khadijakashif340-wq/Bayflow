import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import {
  Wrench,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  MapPin,
  Calendar,
  Search,
  Sparkles,
  Phone,
  Layers,
} from 'lucide-react';
import { HeroContent, HeroFloatingCard } from '@/components/landing/HeroAnimation';
import { AnimatedSection } from '@/components/landing/AnimatedSection';
import { ShopCardsGrid } from '@/components/landing/ShopCardsGrid';
import { WorkflowSection } from '@/components/landing/WorkflowSection';
import { LandingStats } from '@/components/landing/LandingStats';

export const dynamic = 'force-dynamic';

async function getFeaturedShops() {
  return await prisma.shop.findMany({
    take: 3,
    orderBy: { createdAt: 'asc' },
    include: {
      _count: {
        select: { services: true, members: true },
      },
    },
  });
}

export default async function HomePage() {
  const shops = await getFeaturedShops();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-[#E7E0D5] bg-gradient-to-b from-[#FFFFFF] to-[#FAF7F2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Heading & CTAs with Staggered Motion */}
            <div className="lg:col-span-7">
              <HeroContent>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E8590C]/10 border border-[#E8590C]/20 text-[#E8590C] text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Next-Generation Auto Repair in Pakistan</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-stone-900 leading-[1.1] font-heading">
                  Precision Auto Repair.{' '}
                  <span className="text-[#E8590C]">Zero Surprises.</span>
                </h1>

                <p className="text-lg text-stone-600 max-w-2xl leading-relaxed">
                  BayFlow connects car owners in Lahore, Karachi, and Islamabad with certified workshops.
                  Track diagnosis in real-time, approve parts estimates digitally in PKR, and get vehicles back with verified QC inspection.
                </p>

                {/* Quick Search & City Pills */}
                <div className="pt-2">
                  <form action="/shops" method="GET" className="flex flex-col sm:flex-row items-stretch gap-2 max-w-xl">
                    <div className="relative flex-1">
                      <Search className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        name="query"
                        placeholder="Search workshop name, brakes, tuning..."
                        className="w-full pl-10 pr-4 py-3 bg-white border border-[#E7E0D5] rounded-xl text-sm focus:outline-none focus:border-[#E8590C] focus:ring-2 focus:ring-[#E8590C]/20 shadow-xs text-stone-900"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-6 py-3 rounded-xl bg-[#E8590C] text-white font-bold text-sm hover:bg-[#D04F0A] transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <span>Find Workshop</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>

                  {/* Popular City Filters */}
                  <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
                    <span className="text-stone-500 font-semibold">Quick Filter:</span>
                    {['Lahore', 'Karachi', 'Islamabad', 'All'].map((city) => (
                      <Link
                        key={city}
                        href={`/shops?city=${city}`}
                        className="px-3 py-1 rounded-lg bg-white border border-[#E7E0D5] text-stone-700 font-medium hover:border-[#E8590C] hover:text-[#E8590C] transition-colors shadow-2xs"
                      >
                        {city}
                      </Link>
                    ))}
                  </div>
                </div>
              </HeroContent>
            </div>

            {/* Right Column: Floating Interactive Demo Card */}
            <div className="lg:col-span-5">
              <HeroFloatingCard>
                <div className="bg-white rounded-2xl p-6 shadow-md border border-[#E7E0D5] space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                    <div>
                      <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                        Live Demonstration Tracker
                      </span>
                      <div className="font-mono text-lg font-bold text-stone-900 tracking-wider">
                        LEA-21-4892
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                      AWAITING_CUSTOMER
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Vehicle</span>
                      <span className="font-semibold text-stone-900">2021 Honda Civic Oriel</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Workshop</span>
                      <span className="font-semibold text-stone-900">BayFlow Central Lahore</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Assigned Master Tech</span>
                      <span className="font-semibold text-stone-900">Rashid Ali</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Estimate Total</span>
                      <span className="font-mono font-bold text-[#E8590C]">PKR 35,000</span>
                    </div>
                  </div>

                  {/* Progress Mini Bar */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
                      <span>Inspection Complete</span>
                      <span className="font-bold text-[#0F5C4D]">Step 6 of 17</span>
                    </div>
                    <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden border border-stone-200">
                      <div className="bg-[#E8590C] h-full w-[38%] rounded-full transition-all"></div>
                    </div>
                  </div>

                  <Link
                    href="/track/BF-2026-1001"
                    className="w-full py-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#E8590C] border border-[#E8590C]/30 text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Open Interactive Live Tracker</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </HeroFloatingCard>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics / Stats Counter Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full -mt-6 relative z-10">
        <LandingStats />
      </section>

      {/* Featured Verified Workshops */}
      <AnimatedSection className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 font-heading">
              Verified Partner Workshops
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              Equipped with calibrated diagnostic scanners and staffed with certified technicians.
            </p>
          </div>
          <Link
            href="/shops"
            className="text-sm font-bold text-[#E8590C] hover:text-[#D04F0A] flex items-center gap-1.5"
          >
            <span>View All Workshops</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <ShopCardsGrid shops={shops} />
      </AnimatedSection>

      {/* 4-Step Customer Flow with Animated SVG Connector */}
      <AnimatedSection className="py-16 bg-white border-y border-[#E7E0D5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 font-heading">
              How BayFlow Operates
            </h2>
            <p className="text-sm text-stone-600 mt-2">
              From the moment you reserve your bay to final Quality Control testing, every step is deterministic and recorded.
            </p>
          </div>

          <WorkflowSection />
        </div>
      </AnimatedSection>

      {/* CTA Banner */}
      <AnimatedSection className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="rounded-2xl bg-[#1C1917] text-white p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8 border border-stone-800 shadow-lg">
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold font-heading">
              Ready to service your vehicle?
            </h2>
            <p className="text-sm text-stone-400 max-w-xl">
              Book your slot with verified auto repair centers in Lahore, Karachi, or Islamabad in under 2 minutes.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link
              href="/book"
              className="px-6 py-3 rounded-xl bg-[#E8590C] hover:bg-[#D04F0A] text-white text-sm font-bold transition-colors shadow-sm text-center cursor-pointer active:scale-98"
            >
              Start 5-Step Booking Wizard
            </Link>
            <Link
              href="/track"
              className="px-6 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-sm font-medium transition-colors border border-stone-700 text-center cursor-pointer active:scale-98"
            >
              Track Existing Booking
            </Link>
          </div>
        </div>
      </AnimatedSection>

      <Footer />
    </div>
  );
}
