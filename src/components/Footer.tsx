import React from 'react';
import Link from 'next/link';
import { Wrench, Shield, CheckCircle2, Phone, MapPin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[#1C1917] text-[#FAF7F2] border-t border-[#2A2420] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#E8590C] flex items-center justify-center text-white">
                <Wrench className="w-4 h-4" />
              </div>
              <span className="font-heading text-xl font-bold tracking-tight text-white">
                Bay<span className="text-[#E8590C]">Flow</span>
              </span>
            </div>
            <p className="text-sm text-[#A8A196] leading-relaxed">
              Pakistan&apos;s verified auto repair operating system. Real-time diagnostic tracking, digital estimates, and certified QC guarantees.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-3">
              Platform
            </h4>
            <ul className="space-y-2 text-sm text-[#A8A196]">
              <li>
                <Link href="/shops" className="hover:text-white transition-colors">
                  Find Workshops
                </Link>
              </li>
              <li>
                <Link href="/book" className="hover:text-white transition-colors">
                  Book an Inspection
                </Link>
              </li>
              <li>
                <Link href="/track" className="hover:text-white transition-colors">
                  Live Vehicle Tracker
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Staff & Owner POS
                </Link>
              </li>
            </ul>
          </div>

          {/* Active Cities */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-3">
              Active Hubs
            </h4>
            <ul className="space-y-2 text-sm text-[#A8A196]">
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#E8590C]" />
                Lahore (Gulberg, DHA, Johar Town)
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#E8590C]" />
                Karachi (PECHS, Clifton, Korangi)
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#E8590C]" />
                Islamabad (I-9 Industrial, G-11)
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#E8590C]" />
                Rawalpindi (Saddar, Westridge)
              </li>
            </ul>
          </div>

          {/* Service Guarantee */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-3">
              Service Standards
            </h4>
            <div className="space-y-2.5 text-xs text-[#A8A196]">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0F5C4D] shrink-0 mt-0.5" />
                <span>Deterministic 17-step state machine with real-time status updates</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0F5C4D] shrink-0 mt-0.5" />
                <span>Independent Quality Control (QC) inspection before customer delivery</span>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-[#0F5C4D] shrink-0 mt-0.5" />
                <span>Customer sign-off required for any additional parts or labor in PKR</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#2A2420] flex flex-col sm:flex-row items-center justify-between text-xs text-[#A8A196] gap-4">
          <p>© 2026 BayFlow Technologies Ltd. Built for Pakistan automotive workshops.</p>
          <div className="flex items-center gap-4">
            <span className="text-[#0F5C4D] flex items-center gap-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#0F5C4D] animate-pulse"></span>
              All Systems Operational (Neon DB Connected)
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
