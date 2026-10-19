import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { MapPin, Clock, Phone, Mail, Layers, Wrench, ArrowRight, Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ShopsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; query?: string }>;
}) {
  const { city, query } = await searchParams;

  const whereClause: Record<string, unknown> = {};

  if (city && city !== 'All') {
    whereClause.city = { equals: city, mode: 'insensitive' };
  }

  if (query && query.trim() !== '') {
    whereClause.OR = [
      { name: { contains: query.trim(), mode: 'insensitive' } },
      { address: { contains: query.trim(), mode: 'insensitive' } },
      { description: { contains: query.trim(), mode: 'insensitive' } },
    ];
  }

  const shops = await prisma.shop.findMany({
    where: whereClause,
    include: {
      services: {
        where: { isActive: true },
        take: 4,
      },
      _count: {
        select: { services: true, members: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const cities = ['All', 'Lahore', 'Karachi', 'Islamabad', 'Rawalpindi'];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
        {/* Header */}
        <div className="mb-8 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#E8590C] uppercase tracking-wider">
            <Wrench className="w-4 h-4" />
            <span>Authorized Network</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-heading text-[#1C1917]">
            Auto Repair Workshops in Pakistan
          </h1>
          <p className="text-sm text-[#6B645B] max-w-2xl">
            Choose from calibrated multi-bay workshops with real-time status tracking and certified Quality Control inspection.
          </p>
        </div>

        {/* Search & City Filter Bar */}
        <div className="card-bayflow p-4 bg-[#FFFFFF] mb-8 space-y-4">
          <form method="GET" action="/shops" className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#6B645B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="query"
                defaultValue={query || ''}
                placeholder="Search workshop name, Gulberg, EFI diagnostics..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#FAF7F2] border border-[#E7E0D5] rounded-xl text-sm focus:outline-none focus:border-[#E8590C] text-[#1C1917]"
              />
            </div>
            {city && city !== 'All' && (
              <input type="hidden" name="city" value={city} />
            )}
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#E8590C] hover:bg-[#D04F0A] text-white rounded-xl text-sm font-semibold transition-colors shrink-0"
            >
              Search
            </button>
          </form>

          {/* City Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-[#6B645B] font-medium shrink-0">Filter by City:</span>
            {cities.map((c) => {
              const active = (!city && c === 'All') || city === c;
              return (
                <Link
                  key={c}
                  href={`/shops?city=${c}${query ? `&query=${encodeURIComponent(query)}` : ''}`}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium shrink-0 transition-colors ${
                    active
                      ? 'bg-[#E8590C] text-white border-[#E8590C]'
                      : 'bg-[#FAF7F2] text-[#6B645B] border-[#E7E0D5] hover:text-[#1C1917] hover:border-[#6B645B]'
                  }`}
                >
                  {c}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Workshops Grid */}
        {shops.length === 0 ? (
          <div className="card-bayflow p-12 text-center bg-[#FFFFFF] space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FAF7F2] flex items-center justify-center mx-auto text-[#6B645B]">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-lg text-[#1C1917]">
              No workshops found
            </h3>
            <p className="text-xs text-[#6B645B] max-w-sm mx-auto">
              We couldn&apos;t find any repair shops matching your search criteria. Try removing filters or searching for another city.
            </p>
            <Link
              href="/shops"
              className="inline-block px-4 py-2 rounded-lg bg-[#FAF7F2] border border-[#E7E0D5] text-xs font-semibold text-[#1C1917] hover:bg-[#E7E0D5]/50"
            >
              Reset Filters
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shops.map((shop) => (
              <div
                key={shop.id}
                className="card-bayflow p-6 bg-[#FFFFFF] flex flex-col justify-between hover:shadow-md hover:border-[#E8590C]/40 transition-all"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-heading font-bold text-lg text-[#1C1917]">
                        {shop.name}
                      </h2>
                      <div className="flex items-center gap-1.5 text-xs text-[#6B645B] mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-[#E8590C] shrink-0" />
                        <span>{shop.city}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#0F5C4D]/10 text-[#0F5C4D] border border-[#0F5C4D]/20 shrink-0">
                      Active Partner
                    </span>
                  </div>

                  <p className="text-xs text-[#6B645B] line-clamp-2 leading-relaxed">
                    {shop.description}
                  </p>

                  {/* Metadata Specs */}
                  <div className="space-y-2 text-xs text-[#6B645B] pt-2 border-t border-[#E7E0D5]">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#6B645B] shrink-0" />
                      <span className="truncate">{shop.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#6B645B] shrink-0" />
                      <span>{shop.openTime} – {shop.closeTime} • {shop.workingDays}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-[#6B645B] shrink-0" />
                      <span>{shop.maxParallelSlots} Simultaneous Service Bays</span>
                    </div>
                  </div>

                  {/* Sample Service Offerings */}
                  {shop.services.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-semibold text-[#6B645B] uppercase tracking-wider block mb-1.5">
                        Popular Services
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {shop.services.map((svc) => (
                          <span
                            key={svc.id}
                            className="px-2 py-0.5 rounded-md bg-[#FAF7F2] border border-[#E7E0D5] text-[11px] text-[#1C1917]"
                          >
                            {svc.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="pt-6 mt-6 border-t border-[#E7E0D5] flex items-center justify-between gap-3">
                  <a
                    href={`tel:${shop.phone}`}
                    className="px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] text-[#1C1917] text-xs font-semibold hover:bg-[#E7E0D5]/50 flex items-center gap-1.5 border border-[#E7E0D5]"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>
                  <Link
                    href={`/book?shopId=${shop.id}`}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#E8590C] hover:bg-[#D04F0A] text-white text-xs font-semibold text-center transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Book Appointment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
