import React, { useState, useMemo, useEffect } from 'react';
import {
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  ShieldCheck,
  Building2,
  Users,
  BarChart3,
  Bell,
  Search,
  Plus,
  Filter,
  ArrowRight,
  ChevronRight,
  Navigation,
  Camera,
  X,
  Check,
  AlertCircle,
  SlidersHorizontal,
  Layers,
  Activity,
  Compass,
  Menu,
  LogOut,
  UserCheck,
  Sparkles,
  Eye,
  Send,
  Star,
  Crosshair,
  UploadCloud,
  RefreshCw,
  Calendar,
  ExternalLink,
  Sun,
  Moon
} from 'lucide-react';

// ============================================================================
// TYPOGRAPHY & EDITORIAL CIVIC THEME INJECTION
// ============================================================================
const THEME_FONT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

  .civic-theme-root {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  .font-display {
    font-family: 'Fraunces', Georgia, serif;
    letter-spacing: -0.02em;
  }
  .font-mono-code {
    font-family: 'JetBrains Mono', monospace;
  }
`;

// ============================================================================
// MOCK DATA & INITIAL STATE (Strictly adhering to CivicTrack domain models)
// ============================================================================

const CATEGORIES = [
  { id: 'ROADS', label: 'Roads & Potholes', slaHours: 48 },
  { id: 'WATER', label: 'Water Supply & Leakage', slaHours: 24 },
  { id: 'GARBAGE', label: 'Garbage & Sanitation', slaHours: 24 },
  { id: 'DRAINAGE', label: 'Drainage & Sewage', slaHours: 36 },
  { id: 'STREETLIGHTS', label: 'Streetlights', slaHours: 48 },
  { id: 'ELECTRICITY', label: 'Public Electricity', slaHours: 12 },
  { id: 'OTHER', label: 'Other Civic Issues', slaHours: 72 },
];

const STATUS_META = {
  SUBMITTED: { label: 'Submitted', badge: 'bg-stone-500/15 text-stone-400 border-stone-500/30', dot: 'bg-stone-400' },
  UNDER_REVIEW: { label: 'Under Review', badge: 'bg-amber-500/15 text-amber-500 border-amber-500/30', dot: 'bg-amber-500' },
  VERIFIED: { label: 'Verified', badge: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30', dot: 'bg-emerald-500' },
  ASSIGNED: { label: 'Assigned', badge: 'bg-sky-500/15 text-sky-500 border-sky-500/30', dot: 'bg-sky-500' },
  IN_PROGRESS: { label: 'In Progress', badge: 'bg-orange-500/15 text-orange-500 border-orange-500/30', dot: 'bg-orange-500' },
  RESOLVED: { label: 'Resolved', badge: 'bg-teal-500/15 text-teal-500 border-teal-500/30', dot: 'bg-teal-500' },
  CLOSED: { label: 'Closed', badge: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30', dot: 'bg-neutral-400' },
  REJECTED: { label: 'Rejected', badge: 'bg-rose-500/15 text-rose-500 border-rose-500/30', dot: 'bg-rose-500' },
};

const PRIORITY_META = {
  CRITICAL: { label: 'Critical', badge: 'bg-rose-500/15 text-rose-500 border-rose-500/30' },
  HIGH: { label: 'High', badge: 'bg-orange-500/15 text-orange-500 border-orange-500/30' },
  MEDIUM: { label: 'Medium', badge: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  LOW: { label: 'Low', badge: 'bg-stone-500/15 text-stone-400 border-stone-500/30' },
};

const DEPARTMENTS = [
  { id: 'dept-roads', name: 'Roads & Civil Infrastructure', code: 'RCI-01', activeOfficers: 8, openCount: 14 },
  { id: 'dept-water', name: 'Water & Sewerage Board', code: 'WSB-02', activeOfficers: 6, openCount: 9 },
  { id: 'dept-sanitation', name: 'Solid Waste & Sanitation', code: 'SWS-03', activeOfficers: 11, openCount: 7 },
  { id: 'dept-elec', name: 'Street Lighting & Electrical', code: 'SLE-04', activeOfficers: 5, openCount: 6 },
];

const OFFICERS = [
  { id: 'off-1', name: 'Arjun Nair', email: 'a.nair@civictrack.demo', departmentId: 'dept-roads', activeTasks: 4, resolvedCount: 42 },
  { id: 'off-2', name: 'Meera Krishnan', email: 'm.krishnan@civictrack.demo', departmentId: 'dept-water', activeTasks: 3, resolvedCount: 38 },
  { id: 'off-3', name: 'Vikram Deshmukh', email: 'v.deshmukh@civictrack.demo', departmentId: 'dept-sanitation', activeTasks: 2, resolvedCount: 51 },
  { id: 'off-4', name: 'Sneha Rao', email: 's.rao@civictrack.demo', departmentId: 'dept-elec', activeTasks: 3, resolvedCount: 29 },
];

const INITIAL_COMPLAINTS = [
  {
    id: 'cmp-101',
    referenceNumber: 'CT-2026-000142',
    citizenId: 'cit-1',
    citizenName: 'Rohan Sharma',
    title: 'Deep crater pothole near Indiranagar 100ft Rd Junction',
    description: 'Large water-filled pothole on the left lane causing severe traffic bottleneck and two-wheeler skids during evening peak hours.',
    category: 'ROADS',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    coordinates: [77.6412, 12.9784], // [lng, lat] GeoJSON standard
    mapPos: { x: 46, y: 42 },
    address: '100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru',
    landmark: 'Opposite Metro Pillar 64',
    departmentId: 'dept-roads',
    assignedOfficerId: 'off-1',
    dueAt: '2026-11-23T14:00:00Z',
    isOverdue: false,
    duplicateCandidateOf: null,
    evidence: [
      { id: 'ev-1', name: 'pothole_junction_north.jpg', size: '2.4 MB', type: 'CITIZEN_UPLOAD', color: 'from-slate-800 to-teal-950' }
    ],
    history: [
      { status: 'SUBMITTED', timestamp: '2026-11-20 09:15', actor: 'Rohan Sharma (Citizen)', remarks: 'Initial report submitted with geo-tagged photo evidence.' },
      { status: 'UNDER_REVIEW', timestamp: '2026-11-20 10:05', actor: 'Priya Menon (Admin)', remarks: 'Verified coordinates and street segment.' },
      { status: 'VERIFIED', timestamp: '2026-11-20 10:12', actor: 'Priya Menon (Admin)', remarks: 'Confirmed road hazard; marked HIGH priority.' },
      { status: 'ASSIGNED', timestamp: '2026-11-20 10:15', actor: 'Priya Menon (Admin)', remarks: 'Assigned to Roads & Civil Infrastructure (Officer Arjun Nair).' },
      { status: 'IN_PROGRESS', timestamp: '2026-11-21 11:30', actor: 'Arjun Nair (Officer)', remarks: 'Site inspected; cold-mix asphalt crew scheduled for patching.' },
    ],
    createdAt: '2026-11-20T09:15:00Z',
  },
  {
    id: 'cmp-102',
    referenceNumber: 'CT-2026-000145',
    citizenId: 'cit-1',
    citizenName: 'Rohan Sharma',
    title: 'Main distribution pipe leakage flooding sidewalk',
    description: 'Clean drinking water continuously gushing out from an underground valve chamber since morning.',
    category: 'WATER',
    status: 'UNDER_REVIEW',
    priority: 'CRITICAL',
    coordinates: [77.6385, 12.9719],
    mapPos: { x: 34, y: 62 },
    address: '12th Main Rd, Doopanahalli, Indiranagar, Bengaluru',
    landmark: 'Near ESI Hospital Gate 2',
    departmentId: null,
    assignedOfficerId: null,
    dueAt: '2026-11-22T20:00:00Z',
    isOverdue: false,
    duplicateCandidateOf: 'CT-2026-000139',
    duplicateScore: 84,
    evidence: [
      { id: 'ev-2', name: 'valve_leak_stream.jpg', size: '3.1 MB', type: 'CITIZEN_UPLOAD', color: 'from-cyan-950 to-slate-900' }
    ],
    history: [
      { status: 'SUBMITTED', timestamp: '2026-11-22 07:40', actor: 'Rohan Sharma (Citizen)', remarks: 'Reported urgent water main leak.' },
      { status: 'UNDER_REVIEW', timestamp: '2026-11-22 08:15', actor: 'Priya Menon (Admin)', remarks: 'Flagged potential duplicate within 140m radius; reviewing.' },
    ],
    createdAt: '2026-11-22T07:40:00Z',
  },
  {
    id: 'cmp-103',
    referenceNumber: 'CT-2026-000138',
    citizenId: 'cit-1',
    citizenName: 'Rohan Sharma',
    title: 'Three consecutive LED streetlights out on 8th Cross',
    description: 'Complete darkness along the residential stretch after 7 PM, raising pedestrian safety concerns.',
    category: 'STREETLIGHTS',
    status: 'RESOLVED',
    priority: 'MEDIUM',
    coordinates: [77.6455, 12.9810],
    mapPos: { x: 68, y: 31 },
    address: '8th Cross, Defence Colony, Indiranagar, Bengaluru',
    landmark: 'Next to Community Park',
    departmentId: 'dept-elec',
    assignedOfficerId: 'off-4',
    dueAt: '2026-11-21T18:00:00Z',
    isOverdue: false,
    duplicateCandidateOf: null,
    feedback: null,
    evidence: [
      { id: 'ev-3', name: 'dark_street_8th_cross.jpg', size: '1.8 MB', type: 'CITIZEN_UPLOAD', color: 'from-zinc-900 to-slate-800' },
      { id: 'ev-4', name: 'repaired_led_luminaires.jpg', size: '2.1 MB', type: 'RESOLUTION_PROOF', color: 'from-emerald-950 to-teal-900' }
    ],
    history: [
      { status: 'SUBMITTED', timestamp: '2026-11-18 19:20', actor: 'Rohan Sharma (Citizen)', remarks: 'Reported non-functional streetlights.' },
      { status: 'VERIFIED', timestamp: '2026-11-19 09:00', actor: 'Priya Menon (Admin)', remarks: 'Verified feeder line zone.' },
      { status: 'ASSIGNED', timestamp: '2026-11-19 09:05', actor: 'Priya Menon (Admin)', remarks: 'Assigned to Street Lighting & Electrical (Officer Sneha Rao).' },
      { status: 'IN_PROGRESS', timestamp: '2026-11-19 14:10', actor: 'Sneha Rao (Officer)', remarks: 'Faulty driver units identified on poles #14, #15, #16.' },
      { status: 'RESOLVED', timestamp: '2026-11-20 17:45', actor: 'Sneha Rao (Officer)', remarks: 'Replaced LED driver modules and restored illumination.' },
    ],
    createdAt: '2026-11-18T19:20:00Z',
  },
  {
    id: 'cmp-104',
    referenceNumber: 'CT-2026-000129',
    citizenId: 'cit-2',
    citizenName: 'Ananya Verma',
    title: 'Overflowing garbage collection point & unsegregated dump',
    description: 'Secondary transfer bin has not been cleared for 3 days; spilling onto the carriageway.',
    category: 'GARBAGE',
    status: 'ASSIGNED',
    priority: 'HIGH',
    coordinates: [77.6320, 12.9690],
    mapPos: { x: 24, y: 74 },
    address: 'CMH Road, Lakshmipuram, Bengaluru',
    landmark: 'Behind Bus Shelter',
    departmentId: 'dept-sanitation',
    assignedOfficerId: 'off-3',
    dueAt: '2026-11-21T12:00:00Z',
    isOverdue: true,
    duplicateCandidateOf: null,
    evidence: [
      { id: 'ev-5', name: 'cmh_bin_overflow.jpg', size: '2.9 MB', type: 'CITIZEN_UPLOAD', color: 'from-amber-950 to-zinc-900' }
    ],
    history: [
      { status: 'SUBMITTED', timestamp: '2026-11-19 08:30', actor: 'Ananya Verma (Citizen)', remarks: 'Reported missed garbage clearance.' },
      { status: 'VERIFIED', timestamp: '2026-11-19 10:00', actor: 'Priya Menon (Admin)', remarks: 'Confirmed sanitation hotspot.' },
      { status: 'ASSIGNED', timestamp: '2026-11-19 10:05', actor: 'Priya Menon (Admin)', remarks: 'Assigned to Solid Waste & Sanitation (Officer Vikram Deshmukh).' },
    ],
    createdAt: '2026-11-19T08:30:00Z',
  },
  {
    id: 'cmp-105',
    referenceNumber: 'CT-2026-000148',
    citizenId: 'cit-3',
    citizenName: 'Karthik Subramanian',
    title: 'Blocked stormwater drain grate before rain forecast',
    description: 'Silt and plastic debris completely sealing the roadside storm drain inlet.',
    category: 'DRAINAGE',
    status: 'SUBMITTED',
    priority: 'MEDIUM',
    coordinates: [77.6510, 12.9750],
    mapPos: { x: 76, y: 54 },
    address: 'Old Airport Rd Service Lane, Domlur, Bengaluru',
    landmark: 'Near Flyover Ramp',
    departmentId: null,
    assignedOfficerId: null,
    dueAt: '2026-11-24T12:00:00Z',
    isOverdue: false,
    duplicateCandidateOf: null,
    evidence: [],
    history: [
      { status: 'SUBMITTED', timestamp: '2026-11-22 08:50', actor: 'Karthik Subramanian (Citizen)', remarks: 'Submitted drainage siltation report.' },
    ],
    createdAt: '2026-11-22T08:50:00Z',
  }
];

const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: 'SLA Warning: Overdue Assignment',
    message: 'CT-2026-000129 (CMH Road Garbage Overflow) has exceeded its 24h resolution target.',
    time: '14 mins ago',
    read: false,
    roleTarget: 'ADMIN',
  },
  {
    id: 'notif-2',
    title: 'Complaint Resolved — Feedback Requested',
    message: 'Officer Sneha Rao marked CT-2026-000138 as Resolved with photo evidence.',
    time: '2 hours ago',
    read: false,
    roleTarget: 'CITIZEN',
  },
  {
    id: 'notif-3',
    title: 'Field Progress Logged',
    message: 'Officer Arjun Nair updated CT-2026-000142 to In Progress.',
    time: 'Yesterday',
    read: true,
    roleTarget: 'CITIZEN',
  },
];

// ============================================================================
// REUSABLE UI PRIMITIVES (Graphite + Teal/Cyan Civic-Tech Design System)
// ============================================================================

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.SUBMITTED;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border ${meta.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.MEDIUM;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase border ${meta.badge}`}>
      {meta.label}
    </span>
  );
}

function CategoryLabel({ categoryId }) {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  return <span className="font-semibold text-xs opacity-85">{cat ? cat.label : categoryId}</span>;
}

// ============================================================================
// INTERACTIVE OLA MAPS VECTOR SIMULATION COMPONENT
// ============================================================================

function OlaMapCanvas({
  complaints = [],
  selectedId = null,
  onSelectComplaint = () => {},
  pickerMode = false,
  pickedLocation = null,
  onPickLocation = () => {},
  userGps = { x: 50, y: 50, lng: 77.6410, lat: 12.9765 },
  heightClass = 'h-[360px]',
  isDark = false,
}) {
  const [mapStyle, setMapStyle] = useState('EDITORIAL_ATLAS'); // EDITORIAL_ATLAS | SATELLITE | TERRAIN
  const [zoom, setZoom] = useState(14);

  const handleCanvasClick = (e) => {
    if (!pickerMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(8, Math.min(92, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(8, Math.min(92, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
    const lng = Number((77.625 + (x / 100) * 0.035).toFixed(4));
    const lat = Number((12.990 - (y / 100) * 0.025).toFixed(4));
    onPickLocation({
      x,
      y,
      coordinates: [lng, lat],
      address: `${Math.floor(10 + x)}th Main, Sector ${Math.ceil(y / 15)}, Indiranagar, Bengaluru`,
    });
  };

  return (
    <div
      onClick={handleCanvasClick}
      className={`relative w-full ${heightClass} rounded-2xl border overflow-hidden select-none transition-colors ${
        pickerMode ? 'cursor-crosshair' : 'cursor-default'
      } ${
        mapStyle === 'SATELLITE'
          ? 'bg-[#0e1714] border-[#26352e]'
          : mapStyle === 'TERRAIN'
          ? isDark
            ? 'bg-[#171c18] border-[#2d352e]'
            : 'bg-[#ebe6dc] border-[#d6cfc2]'
          : isDark
          ? 'bg-[#141716] border-[#292d2b]'
          : 'bg-[#f4f0e8] border-[#dcd5c7]'
      }`}
    >
      {/* Vector Street Grid SVG */}
      <svg className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" viewBox="0 0 800 500" preserveAspectRatio="none">
        <defs>
          <pattern id="civicGrid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke={isDark || mapStyle === 'SATELLITE' ? '#26302b' : '#dfd8ca'}
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="800" height="500" fill="url(#civicGrid)" />
        {/* Arterial Roads */}
        <path
          d="M -20 140 Q 260 170 430 240 T 830 310"
          fill="none"
          stroke={isDark || mapStyle === 'SATELLITE' ? '#283d34' : '#e2cab8'}
          strokeWidth="13"
        />
        <path
          d="M -20 140 Q 260 170 430 240 T 830 310"
          fill="none"
          stroke="#d95d39"
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
        <path
          d="M 220 -20 L 290 520"
          fill="none"
          stroke={isDark || mapStyle === 'SATELLITE' ? '#242b28' : '#e5dfd3'}
          strokeWidth="10"
        />
        <path
          d="M 560 -20 Q 520 240 610 520"
          fill="none"
          stroke={isDark || mapStyle === 'SATELLITE' ? '#242b28' : '#e5dfd3'}
          strokeWidth="9"
        />
        <path
          d="M 50 410 L 760 95"
          fill="none"
          stroke={isDark || mapStyle === 'SATELLITE' ? '#1f2623' : '#e8e2d7'}
          strokeWidth="7"
        />
        {/* Park / Water Zones */}
        <polygon
          points="510,70 630,65 650,145 525,155"
          fill={isDark || mapStyle === 'SATELLITE' ? '#132a21' : '#d6e6dc'}
          stroke="#2d6a4f"
          strokeOpacity="0.4"
          strokeWidth="1"
        />
        <ellipse
          cx="140"
          cy="310"
          rx="58"
          ry="34"
          fill={isDark || mapStyle === 'SATELLITE' ? '#13252c' : '#d5e4ec'}
          stroke="#3b7a9e"
          strokeOpacity="0.4"
          strokeWidth="1"
        />
      </svg>

      {/* Top Left Ola Maps SDK Attribution & Mode Controls */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs shadow-sm border ${
            isDark
              ? 'bg-[#191d1b]/95 border-[#2d3330] text-stone-100'
              : 'bg-[#fcfaf6]/95 border-[#dcd5c7] text-stone-800'
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-[#d95d39]" />
          <span className="font-bold tracking-tight">Ola Maps</span>
          <span className="opacity-30">|</span>
          <span className="text-[11px] opacity-70 font-mono-code">2dsphere</span>
        </div>

        <div
          className={`hidden sm:flex rounded-xl p-0.5 text-[11px] border ${
            isDark ? 'bg-[#191d1b]/95 border-[#2d3330]' : 'bg-[#fcfaf6]/95 border-[#dcd5c7]'
          }`}
        >
          {[
            { id: 'EDITORIAL_ATLAS', label: 'Atlas' },
            { id: 'SATELLITE', label: 'Satellite' },
            { id: 'TERRAIN', label: 'Relief' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMapStyle(mode.id);
              }}
              className={`px-2.5 py-1 rounded-lg transition ${
                mapStyle === mode.id
                  ? 'bg-[#d95d39] text-white font-semibold'
                  : isDark
                  ? 'text-stone-400 hover:text-stone-100'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Right Zoom Controls */}
      <div
        className={`absolute top-3 right-3 z-10 flex flex-col rounded-xl overflow-hidden border ${
          isDark ? 'bg-[#191d1b]/95 border-[#2d3330] text-stone-200' : 'bg-[#fcfaf6]/95 border-[#dcd5c7] text-stone-800'
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => Math.min(18, z + 1));
          }}
          className={`px-2.5 py-1 text-sm font-bold border-b ${
            isDark ? 'border-[#2d3330] hover:bg-stone-800' : 'border-[#dcd5c7] hover:bg-stone-200/60'
          }`}
          aria-label="Zoom in"
        >
          +
        </button>
        <span className="px-2 py-0.5 text-[10px] text-center opacity-60 font-mono-code">{zoom}x</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => Math.max(11, z - 1));
          }}
          className={`px-2.5 py-1 text-sm font-bold border-t ${
            isDark ? 'border-[#2d3330] hover:bg-stone-800' : 'border-[#dcd5c7] hover:bg-stone-200/60'
          }`}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {/* Live Citizen/Device GPS Radar Beacon */}
      <div
        style={{ left: `${userGps.x}%`, top: `${userGps.y}%` }}
        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
        title="Device GPS Location"
      >
        <div className="relative flex items-center justify-center">
          <span className="w-8 h-8 rounded-full bg-emerald-500/25 border border-emerald-500/50 animate-ping absolute" />
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white shadow-md" />
        </div>
      </div>

      {/* Complaint Pins */}
      {!pickerMode &&
        complaints.map((c) => {
          const isSelected = c.id === selectedId;
          const pinColor =
            c.status === 'RESOLVED' || c.status === 'CLOSED'
              ? 'bg-emerald-600 border-white text-white'
              : c.isOverdue || c.priority === 'CRITICAL'
              ? 'bg-rose-600 border-white text-white'
              : 'bg-[#d95d39] border-white text-white';

          return (
            <button
              key={c.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectComplaint(c);
              }}
              style={{ left: `${c.mapPos.x}%`, top: `${c.mapPos.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 group z-20 transition-transform ${
                isSelected ? 'scale-125 z-30' : 'hover:scale-110'
              }`}
            >
              <div className="relative flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shadow-lg ${pinColor} ${
                    isSelected ? 'ring-4 ring-[#d95d39]/35' : ''
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                {isSelected && (
                  <div
                    className={`mt-1.5 w-56 rounded-xl p-3 text-left shadow-xl border ${
                      isDark
                        ? 'bg-[#191d1b]/95 border-[#2d3330] text-stone-100'
                        : 'bg-[#fcfaf6]/95 border-[#dcd5c7] text-stone-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-mono-code text-[#d95d39] font-semibold">
                        {c.referenceNumber}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-xs font-semibold line-clamp-1">{c.title}</p>
                    <p className="text-[11px] opacity-70 truncate mt-0.5">{c.address}</p>
                  </div>
                )}
              </div>
            </button>
          );
        })}

      {/* Picker Pin when Reporting Issue */}
      {pickerMode && pickedLocation && (
        <div
          style={{ left: `${pickedLocation.x}%`, top: `${pickedLocation.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-full z-20 pointer-events-none"
        >
          <div className="flex flex-col items-center">
            <div
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-code mb-1 shadow-lg whitespace-nowrap border ${
                isDark
                  ? 'bg-[#191d1b] border-[#d95d39] text-[#f08c6e]'
                  : 'bg-[#fcfaf6] border-[#d95d39] text-[#b84423]'
              }`}
            >
              [{pickedLocation.coordinates[0]}, {pickedLocation.coordinates[1]}]
            </div>
            <div className="w-8 h-8 rounded-full bg-[#d95d39] border-2 border-white flex items-center justify-center shadow-xl">
              <MapPin className="w-4 h-4 text-white stroke-[2.5]" />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Legend Bar */}
      <div
        className={`absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-[11px] border ${
          isDark
            ? 'bg-[#191d1b]/90 border-[#2d3330] text-stone-300'
            : 'bg-[#fcfaf6]/90 border-[#dcd5c7] text-stone-700'
        }`}
      >
        {pickerMode ? (
          <span className="text-[#d95d39] font-medium flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5" />
            Click anywhere on the atlas to place the complaint pin (GeoJSON [lng, lat])
          </span>
        ) : (
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600" /> Your GPS
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#d95d39]" /> Active Issue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-600" /> Critical / Overdue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-600" /> Resolved
            </span>
          </div>
        )}
        <span className="font-mono-code text-[10px] opacity-60">EPSG:4326 • 2dsphere</span>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN CIVICTRACK APPLICATION
// ============================================================================

export default function App() {
  // Active Surface Mode (Default: Warm Nordic Sandstone Light; Toggleable to Forest Charcoal Dark)
  const [isDark, setIsDark] = useState(false);

  // Active Persona / Portal Role ('PUBLIC' | 'CITIZEN' | 'ADMIN' | 'OFFICER')
  const [role, setRole] = useState('PUBLIC');
  const [activeTab, setActiveTab] = useState('HOME');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Domain State
  const [complaints, setComplaints] = useState(INITIAL_COMPLAINTS);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Shared Selection & Modal State
  const [selectedComplaintId, setSelectedComplaintId] = useState('cmp-101');
  const [detailModalComplaint, setDetailModalComplaint] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Citizen Report Wizard State
  const [reportStep, setReportStep] = useState(1);
  const [reportForm, setReportForm] = useState({
    title: '',
    category: 'ROADS',
    description: '',
    landmark: '',
    address: '100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru',
    coordinates: [77.6418, 12.9772],
    mapPos: { x: 48, y: 46 },
    files: [],
  });
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Admin Action Modals State
  const [adminActionModal, setAdminActionModal] = useState(null); // { type: 'VERIFY_ASSIGN' | 'REJECT', complaint }
  const [assignDeptId, setAssignDeptId] = useState('dept-roads');
  const [assignOfficerId, setAssignOfficerId] = useState('off-1');
  const [assignPriority, setAssignPriority] = useState('HIGH');
  const [actionRemarks, setActionRemarks] = useState('');

  // Officer Resolution Modal State
  const [officerResolveModal, setOfficerResolveModal] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionPhotoName, setResolutionPhotoName] = useState('site_restored_evidence.jpg');

  // Citizen Feedback State
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');

  const triggerToast = (title, subtitle) => {
    setToastMessage({ title, subtitle });
    setTimeout(() => {
      setToastMessage(null);
    }, 4200);
  };

  // Switch role cleanly and set default route
  const switchPersona = (nextRole, defaultTab) => {
    setRole(nextRole);
    setActiveTab(defaultTab);
    setMobileMenuOpen(false);
    setShowNotifPanel(false);
  };

  // Filtered complaints list
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (role === 'CITIZEN' && activeTab === 'MY_COMPLAINTS' && c.citizenId !== 'cit-1') return false;
      if (role === 'OFFICER' && c.assignedOfficerId !== 'off-1' && activeTab === 'MY_WORK') return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = c.referenceNumber.toLowerCase().includes(q);
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchAddr = c.address.toLowerCase().includes(q);
        if (!matchRef && !matchTitle && !matchAddr) return false;
      }
      return true;
    });
  }, [complaints, role, activeTab, statusFilter, categoryFilter, searchQuery]);

  // Analytics Aggregations
  const analytics = useMemo(() => {
    const total = complaints.length;
    const open = complaints.filter((c) => !['RESOLVED', 'CLOSED', 'REJECTED'].includes(c.status)).length;
    const resolved = complaints.filter((c) => ['RESOLVED', 'CLOSED'].includes(c.status)).length;
    const overdue = complaints.filter((c) => c.isOverdue).length;
    const byCategory = CATEGORIES.map((cat) => ({
      ...cat,
      count: complaints.filter((c) => c.category === cat.id).length,
    }));
    return { total, open, resolved, overdue, byCategory };
  }, [complaints]);

  // ==========================================================================
  // DOMAIN WORKFLOW MUTATIONS (Enforcing Canonical State Machine)
  // ==========================================================================

  const handleCitizenSubmitComplaint = (e) => {
    e.preventDefault();
    if (!reportForm.title.trim() || !reportForm.description.trim()) return;
    setIsSubmittingReport(true);

    setTimeout(() => {
      const nextNum = 149 + complaints.length;
      const newRef = `CT-2026-000${nextNum}`;
      const newComplaint = {
        id: `cmp-${Date.now()}`,
        referenceNumber: newRef,
        citizenId: 'cit-1',
        citizenName: 'Rohan Sharma',
        title: reportForm.title.trim(),
        description: reportForm.description.trim(),
        category: reportForm.category,
        status: 'SUBMITTED',
        priority: 'MEDIUM',
        coordinates: reportForm.coordinates,
        mapPos: reportForm.mapPos,
        address: reportForm.address,
        landmark: reportForm.landmark || 'Near Main Junction',
        departmentId: null,
        assignedOfficerId: null,
        dueAt: '2026-11-24T10:00:00Z',
        isOverdue: false,
        duplicateCandidateOf: null,
        evidence: reportForm.files.map((f, idx) => ({
          id: `ev-new-${idx}`,
          name: f,
          size: '2.2 MB',
          type: 'CITIZEN_UPLOAD',
          color: 'from-teal-950 to-zinc-900',
        })),
        history: [
          {
            status: 'SUBMITTED',
            timestamp: '2026-11-22 09:48',
            actor: 'Rohan Sharma (Citizen)',
            remarks: 'Complaint created with GeoJSON location & pre-signed S3 evidence.',
          },
        ],
        createdAt: new Date().toISOString(),
      };

      setComplaints((prev) => [newComplaint, ...prev]);
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: `Complaint Registered: ${newRef}`,
          message: `Your issue "${newComplaint.title}" is queued for municipal verification.`,
          time: 'Just now',
          read: false,
          roleTarget: 'CITIZEN',
        },
        ...prev,
      ]);
      setIsSubmittingReport(false);
      setReportStep(1);
      setReportForm({
        title: '',
        category: 'ROADS',
        description: '',
        landmark: '',
        address: '100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru',
        coordinates: [77.6418, 12.9772],
        mapPos: { x: 48, y: 46 },
        files: [],
      });
      setActiveTab('MY_COMPLAINTS');
      triggerToast('Complaint Submitted', `Reference ${newRef} created and persisted.`);
    }, 550);
  };

  const handleAdminVerifyAndAssign = () => {
    if (!adminActionModal?.complaint) return;
    const target = adminActionModal.complaint;
    const dept = DEPARTMENTS.find((d) => d.id === assignDeptId);
    const off = OFFICERS.find((o) => o.id === assignOfficerId);

    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id !== target.id) return c;
        return {
          ...c,
          status: 'ASSIGNED',
          priority: assignPriority,
          departmentId: assignDeptId,
          assignedOfficerId: assignOfficerId,
          history: [
            ...c.history,
            {
              status: 'VERIFIED',
              timestamp: '2026-11-22 09:50',
              actor: 'Priya Menon (Admin)',
              remarks: actionRemarks.trim() || 'Verified field coordinates and severity.',
            },
            {
              status: 'ASSIGNED',
              timestamp: '2026-11-22 09:50',
              actor: 'Priya Menon (Admin)',
              remarks: `Assigned to ${dept?.name || 'Department'} (${off?.name || 'Officer'}).`,
            },
          ],
        };
      })
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: `Assigned: ${target.referenceNumber}`,
        message: `Assigned to ${off?.name} (${dept?.name}) with ${assignPriority} priority.`,
        time: 'Just now',
        read: false,
        roleTarget: 'OFFICER',
      },
      ...prev,
    ]);

    triggerToast('Verified & Assigned', `${target.referenceNumber} dispatched to ${off?.name}.`);
    setAdminActionModal(null);
    setActionRemarks('');
  };

  const handleAdminReject = () => {
    if (!adminActionModal?.complaint || !actionRemarks.trim()) return;
    const target = adminActionModal.complaint;

    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id !== target.id) return c;
        return {
          ...c,
          status: 'REJECTED',
          history: [
            ...c.history,
            {
              status: 'REJECTED',
              timestamp: '2026-11-22 09:51',
              actor: 'Priya Menon (Admin)',
              remarks: `Rejected: ${actionRemarks.trim()}`,
            },
          ],
        };
      })
    );

    triggerToast('Complaint Rejected', `${target.referenceNumber} closed with audit reason.`);
    setAdminActionModal(null);
    setActionRemarks('');
  };

  const handleOfficerStartWork = (complaint) => {
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id !== complaint.id) return c;
        return {
          ...c,
          status: 'IN_PROGRESS',
          history: [
            ...c.history,
            {
              status: 'IN_PROGRESS',
              timestamp: '2026-11-22 09:52',
              actor: 'Arjun Nair (Officer)',
              remarks: 'Field inspection started on site.',
            },
          ],
        };
      })
    );
    triggerToast('Work Started', `${complaint.referenceNumber} transitioned to IN_PROGRESS.`);
  };

  const handleOfficerResolve = () => {
    if (!officerResolveModal || !resolutionNotes.trim()) return;
    const target = officerResolveModal;

    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id !== target.id) return c;
        return {
          ...c,
          status: 'RESOLVED',
          isOverdue: false,
          evidence: [
            ...c.evidence,
            {
              id: `ev-res-${Date.now()}`,
              name: resolutionPhotoName || 'resolution_proof.jpg',
              size: '2.6 MB',
              type: 'RESOLUTION_PROOF',
              color: 'from-emerald-950 to-teal-900',
            },
          ],
          history: [
            ...c.history,
            {
              status: 'RESOLVED',
              timestamp: '2026-11-22 09:55',
              actor: 'Arjun Nair (Officer)',
              remarks: resolutionNotes.trim(),
            },
          ],
        };
      })
    );

    triggerToast('Resolution Submitted', `${target.referenceNumber} marked RESOLVED with S3 evidence.`);
    setOfficerResolveModal(null);
    setResolutionNotes('');
  };

  const handleCitizenCloseWithFeedback = (complaint) => {
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id !== complaint.id) return c;
        return {
          ...c,
          status: 'CLOSED',
          feedback: { rating: feedbackRating, comment: feedbackComment.trim() || 'Resolved satisfactorily.' },
          history: [
            ...c.history,
            {
              status: 'CLOSED',
              timestamp: '2026-11-22 09:58',
              actor: 'Rohan Sharma (Citizen)',
              remarks: `Citizen confirmed resolution (${feedbackRating}/5 stars).`,
            },
          ],
        };
      })
    );
    setDetailModalComplaint(null);
    setFeedbackComment('');
    triggerToast('Complaint Closed', `Thank you! Feedback recorded for ${complaint.referenceNumber}.`);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ==========================================================================
  // ROLE-SPECIFIC NAVIGATION ITEMS
  // ==========================================================================
  const navItemsByRole = {
    PUBLIC: [
      { id: 'HOME', label: 'Platform Overview', icon: ShieldCheck },
      { id: 'PUBLIC_MAP', label: 'Live Civic Map', icon: MapPin },
      { id: 'TRACK', label: 'Track Reference', icon: Search },
    ],
    CITIZEN: [
      { id: 'OVERVIEW', label: 'Overview', icon: Activity },
      { id: 'REPORT', label: 'Report an Issue', icon: Plus },
      { id: 'MY_COMPLAINTS', label: 'My Complaints', icon: FileText },
      { id: 'NEARBY', label: 'Nearby Map', icon: MapPin },
    ],
    ADMIN: [
      { id: 'ADMIN_OVERVIEW', label: 'Operations Hub', icon: SlidersHorizontal },
      { id: 'TRIAGE', label: 'Complaint Triage', icon: Layers },
      { id: 'ANALYTICS', label: 'SLA & Analytics', icon: BarChart3 },
      { id: 'DEPARTMENTS', label: 'Departments & Officers', icon: Building2 },
    ],
    OFFICER: [
      { id: 'MY_WORK', label: 'Assigned Queue', icon: CheckCircle2 },
      { id: 'FIELD_MAP', label: 'Field Navigation Map', icon: Navigation },
    ],
  };

  const currentNav = navItemsByRole[role] || [];

  // ==========================================================================
  // RENDER
  // ==========================================================================
  // THEME PALETTE TOKENS (Warm Sandstone & Terracotta / Deep Emerald)
  // ==========================================================================
  const t = {
    pageBg: isDark ? 'bg-[#121514] text-[#f2efe9]' : 'bg-[#f6f3ec] text-[#1c1b18]',
    headerBg: isDark
      ? 'bg-[#171b19]/95 border-[#2a302d]'
      : 'bg-[#fcfaf6]/95 border-[#e2dbd0]',
    subNavBg: isDark
      ? 'bg-[#141816] border-[#2a302d]'
      : 'bg-[#f1ede4] border-[#e2dbd0]',
    card: isDark
      ? 'bg-[#181c1a] border-[#2a302d]'
      : 'bg-[#fcfaf6] border-[#e2dbd0] shadow-[0_2px_10px_rgba(28,27,24,0.03)]',
    cardHover: isDark
      ? 'hover:border-[#d95d39]/60 hover:bg-[#1d2220]'
      : 'hover:border-[#d95d39]/60 hover:bg-white',
    subtleSurface: isDark
      ? 'bg-[#111413] border-[#262c29]'
      : 'bg-[#f2eee6] border-[#dfd8cc]',
    input: isDark
      ? 'bg-[#111413] border-[#2d3431] text-stone-100 focus:border-[#d95d39]'
      : 'bg-white border-[#d6cfc2] text-stone-900 focus:border-[#d95d39]',
    textMuted: isDark ? 'text-stone-400' : 'text-stone-600',
    textFaint: isDark ? 'text-stone-500' : 'text-stone-500',
    primaryBtn: 'bg-[#d95d39] hover:bg-[#c34e2c] text-white font-semibold shadow-sm',
    secondaryBtn: isDark
      ? 'bg-[#212724] hover:bg-[#29302d] text-stone-200 border border-[#323a36]'
      : 'bg-white hover:bg-stone-100 text-stone-800 border border-[#d6cfc2]',
    accentText: isDark ? 'text-[#f08c6e]' : 'text-[#c34e2c]',
    emeraldText: isDark ? 'text-emerald-400' : 'text-emerald-700',
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className={`civic-theme-root min-h-screen flex flex-col transition-colors duration-200 ${t.pageBg}`}>
      <style>{THEME_FONT_STYLES}</style>

      {/* Top Role Switcher & System Header */}
      <header className={`sticky top-0 z-40 backdrop-blur border-b ${t.headerBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`lg:hidden p-2 rounded-xl ${t.textMuted} hover:opacity-100`}
              aria-label="Toggle Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => switchPersona('PUBLIC', 'HOME')}
              className="flex items-center gap-3 text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#d95d39] flex items-center justify-center shadow-sm group-hover:scale-105 transition">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-lg tracking-tight">CivicTrack</span>
                  <span
                    className={`hidden sm:inline-block text-[10px] font-mono-code uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      isDark
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    Civic Ledger
                  </span>
                </div>
                <p className={`text-[11px] hidden sm:block ${t.textMuted}`}>
                  Municipal Infrastructure & Resolution Portal
                </p>
              </div>
            </button>
          </div>

          {/* Interactive Role Switcher Pills */}
          <div className={`flex items-center rounded-xl p-1 gap-1 overflow-x-auto max-w-full border ${t.subtleSurface}`}>
            {[
              { id: 'PUBLIC', label: 'Public', defaultTab: 'HOME' },
              { id: 'CITIZEN', label: 'Citizen Portal', defaultTab: 'OVERVIEW' },
              { id: 'ADMIN', label: 'Admin Console', defaultTab: 'ADMIN_OVERVIEW' },
              { id: 'OFFICER', label: 'Officer Field', defaultTab: 'MY_WORK' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => switchPersona(item.id, item.defaultTab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  role === item.id
                    ? 'bg-[#d95d39] text-white shadow-sm'
                    : `${t.textMuted} hover:opacity-100`
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Right Utility Controls: Surface Theme Toggle + Notifications + Active User */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              title={isDark ? 'Switch to Warm Sandstone Light Mode' : 'Switch to Forest Charcoal Dark Mode'}
              className={`p-2 rounded-xl transition ${t.secondaryBtn}`}
              aria-label="Toggle color theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-700" />}
            </button>

            {role !== 'PUBLIC' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifPanel(!showNotifPanel)}
                  className={`relative p-2 rounded-xl transition ${t.secondaryBtn}`}
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#d95d39] text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifPanel && (
                  <div
                    className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl p-3.5 z-50 border ${t.card}`}
                  >
                    <div className={`flex items-center justify-between pb-2.5 mb-2.5 border-b ${isDark ? 'border-stone-800' : 'border-stone-200'}`}>
                      <span className="text-xs font-bold">Real-Time Socket Notifications</span>
                      <button
                        type="button"
                        onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                        className={`text-[11px] font-semibold hover:underline ${t.accentText}`}
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() =>
                            setNotifications((prev) =>
                              prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
                            )
                          }
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                            n.read
                              ? t.subtleSurface
                              : isDark
                              ? 'bg-[#d95d39]/15 border-[#d95d39]/40'
                              : 'bg-orange-50/80 border-[#d95d39]/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold">{n.title}</span>
                            <span className={`text-[10px] font-mono-code ${t.textFaint}`}>{n.time}</span>
                          </div>
                          <p className={`text-[11px] leading-relaxed ${t.textMuted}`}>{n.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={`hidden md:flex items-center gap-2.5 pl-2.5 border-l ${isDark ? 'border-stone-800' : 'border-stone-300'}`}>
              <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
                {role === 'CITIZEN' ? 'RS' : role === 'ADMIN' ? 'PM' : role === 'OFFICER' ? 'AN' : 'GU'}
              </div>
              <div className="text-xs">
                <div className="font-semibold">
                  {role === 'CITIZEN'
                    ? 'Rohan Sharma'
                    : role === 'ADMIN'
                    ? 'Priya Menon'
                    : role === 'OFFICER'
                    ? 'Arjun Nair'
                    : 'Guest Citizen'}
                </div>
                <div className={`text-[10px] font-mono-code ${t.textFaint}`}>
                  {role === 'CITIZEN'
                    ? 'ROLE: CITIZEN'
                    : role === 'ADMIN'
                    ? 'ROLE: ADMIN'
                    : role === 'OFFICER'
                    ? 'RCI-01 • OFFICER'
                    : 'CLERK AUTH READY'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-navigation Bar for Active Role */}
        <div className={`border-t ${t.subNavBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1.5 overflow-x-auto py-2">
            {currentNav.map((nav) => {
              const Icon = nav.icon;
              const isActive = activeTab === nav.id;
              return (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => setActiveTab(nav.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    isActive
                      ? isDark
                        ? 'bg-[#232926] text-[#f08c6e] border border-[#363f3b] shadow-sm'
                        : 'bg-white text-[#c34e2c] border border-[#dcd5c7] shadow-sm'
                      : `${t.textMuted} hover:opacity-100`
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#d95d39]' : 'opacity-60'}`} />
                  {nav.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Real-time Toast Banner */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl p-4 shadow-2xl flex items-start gap-3 border ${
            isDark ? 'bg-[#191e1c] border-[#d95d39]/60' : 'bg-white border-[#d95d39]/60'
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-[#d95d39]/15 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-4 h-4 text-[#d95d39]" />
          </div>
          <div className="text-xs">
            <p className="font-bold">{toastMessage.title}</p>
            <p className={`mt-0.5 ${t.textMuted}`}>{toastMessage.subtitle}</p>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MAIN CONTENT CANVAS                                                  */}
      {/* ==================================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ------------------------------------------------------------------ */}
        {/* 1. PUBLIC PORTAL                                                   */}
        {/* ------------------------------------------------------------------ */}
        {role === 'PUBLIC' && activeTab === 'HOME' && (
          <div className="space-y-10">
            {/* Hero Section */}
            <section
              className={`rounded-3xl border p-6 sm:p-10 lg:p-12 ${
                isDark
                  ? 'bg-gradient-to-br from-[#191f1c] via-[#151917] to-[#1b1815] border-[#2b332f]'
                  : 'bg-gradient-to-br from-[#fcfaf6] via-[#f7f2e7] to-[#f1e8dc] border-[#dfd7c8]'
              }`}
            >
              <div className="max-w-3xl space-y-5">
                <div
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold ${
                    isDark
                      ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Transparent Civic Issue Reporting & Resolution Tracking
                </div>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.12]">
                  Report local infrastructure issues with precision and full audit visibility.
                </h1>
                <p className={`text-sm sm:text-base leading-relaxed max-w-2xl ${t.textMuted}`}>
                  CivicTrack connects residents with municipal review teams and field department officers. Pin exact locations on Ola Maps, attach private S3 photo evidence, and follow every state transition from submission to verified closure.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => switchPersona('CITIZEN', 'REPORT')}
                    className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm transition ${t.primaryBtn}`}
                  >
                    <Plus className="w-4 h-4" />
                    Report an Issue
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('TRACK')}
                    className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition ${t.secondaryBtn}`}
                  >
                    <Search className="w-4 h-4 text-[#d95d39]" />
                    Track a Complaint
                  </button>
                  <button
                    type="button"
                    onClick={() => switchPersona('ADMIN', 'ADMIN_OVERVIEW')}
                    className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold transition ${t.accentText} hover:underline`}
                  >
                    Explore Admin & Officer Consoles
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Demo Metrics Strip */}
              <div
                className={`grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10 pt-8 border-t ${
                  isDark ? 'border-stone-800' : 'border-[#dfd7c8]'
                }`}
              >
                {[
                  { label: 'Total Tracked Reports (Demo)', value: analytics.total, sub: 'GeoJSON 2dsphere indexed' },
                  { label: 'Active Field Queue', value: analytics.open, sub: 'Verified & assigned' },
                  { label: 'Resolved & Verified', value: analytics.resolved, sub: 'With photo proof' },
                  { label: 'Canonical Lifecycle States', value: '8 States', sub: 'Immutable audit trail' },
                ].map((stat, idx) => (
                  <div key={idx} className={`rounded-2xl p-4 border ${t.card}`}>
                    <div className={`text-xs font-medium ${t.textMuted}`}>{stat.label}</div>
                    <div className="font-display text-2xl sm:text-3xl font-bold mt-1 tabular-nums">{stat.value}</div>
                    <div className={`text-[11px] font-semibold mt-1 ${t.emeraldText}`}>{stat.sub}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* How It Works */}
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold">How CivicTrack Works</h2>
                <p className={`text-xs ${t.textMuted}`}>
                  End-to-end accountability across citizens, administrators, and field officers
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  {
                    step: '01',
                    title: 'Geo-Tagged Submission',
                    desc: 'Citizens pin the issue on Ola Maps, upload photo evidence via private S3 URLs, and receive a CT-YYYY reference.',
                  },
                  {
                    step: '02',
                    title: 'Admin Review & Deduplication',
                    desc: 'Administrators inspect duplicate candidates within 250m, verify legitimacy, set priority, and assign a department.',
                  },
                  {
                    step: '03',
                    title: 'Officer Field Execution',
                    desc: 'Assigned department officers navigate to the site, log progress notes, and upload post-repair resolution evidence.',
                  },
                  {
                    step: '04',
                    title: 'Citizen Confirmation',
                    desc: 'Citizens receive real-time notifications, inspect resolution proof, and submit ratings to close the ticket.',
                  },
                ].map((item) => (
                  <div key={item.step} className={`rounded-2xl border p-5 space-y-2.5 ${t.card}`}>
                    <span
                      className={`inline-block font-mono-code text-xs font-semibold px-2.5 py-0.5 rounded-lg border ${
                        isDark
                          ? 'bg-[#d95d39]/15 text-[#f08c6e] border-[#d95d39]/40'
                          : 'bg-orange-50 text-[#c34e2c] border-orange-200'
                      }`}
                    >
                      STEP {item.step}
                    </span>
                    <h3 className="text-sm font-bold">{item.title}</h3>
                    <p className={`text-xs leading-relaxed ${t.textMuted}`}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Supported Issue Categories */}
            <section className="space-y-4">
              <h2 className="font-display text-xl font-bold">Supported Civic Categories & SLA Targets</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {CATEGORIES.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setReportForm((f) => ({ ...f, category: cat.id }));
                      switchPersona('CITIZEN', 'REPORT');
                    }}
                    className={`rounded-2xl border p-4 cursor-pointer transition flex items-center justify-between ${t.card} ${t.cardHover}`}
                  >
                    <div>
                      <div className="text-sm font-semibold">{cat.label}</div>
                      <div className={`text-[11px] font-mono-code mt-0.5 ${t.textFaint}`}>Target SLA: {cat.slaHours}h</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#d95d39]" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {role === 'PUBLIC' && activeTab === 'PUBLIC_MAP' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-bold">Public Municipal Issues Map</h1>
                <p className={`text-xs ${t.textMuted}`}>
                  Privacy-safe neighborhood atlas (exact citizen home details omitted) • Powered by Ola Maps
                </p>
              </div>
              <button
                type="button"
                onClick={() => switchPersona('CITIZEN', 'REPORT')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs ${t.primaryBtn}`}
              >
                <Plus className="w-3.5 h-3.5" /> Report Issue Here
              </button>
            </div>
            <OlaMapCanvas
              complaints={complaints}
              selectedId={selectedComplaintId}
              onSelectComplaint={(c) => setSelectedComplaintId(c.id)}
              heightClass="h-[460px]"
              isDark={isDark}
            />
          </div>
        )}

        {role === 'PUBLIC' && activeTab === 'TRACK' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className={`rounded-2xl border p-6 space-y-4 ${t.card}`}>
              <h1 className="font-display text-2xl font-bold">Track Complaint Reference</h1>
              <p className={`text-xs ${t.textMuted}`}>
                Enter a CivicTrack reference number (e.g.,{' '}
                <span className={`font-mono-code font-semibold ${t.accentText}`}>CT-2026-000142</span>) to inspect its public lifecycle timeline.
              </p>
              <div className="relative">
                <Search className="w-4 h-4 opacity-50 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by reference number or street name..."
                  className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none ${t.input}`}
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredComplaints.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setDetailModalComplaint(c)}
                  className={`rounded-2xl border p-4 cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${t.card} ${t.cardHover}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono-code text-xs font-semibold ${t.accentText}`}>{c.referenceNumber}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <h3 className="text-sm font-bold">{c.title}</h3>
                    <p className={`text-xs ${t.textMuted}`}>{c.address}</p>
                  </div>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 ${t.accentText}`}
                  >
                    View Timeline <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 2. CITIZEN PORTAL                                                  */}
        {/* ------------------------------------------------------------------ */}
        {role === 'CITIZEN' && activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold">Welcome back, Rohan</h1>
                <p className={`text-xs mt-0.5 ${t.textMuted}`}>
                  Track your reported civic issues and nearby neighborhood resolutions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('REPORT')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs transition ${t.primaryBtn}`}
              >
                <Plus className="w-4 h-4" />
                Report New Issue
              </button>
            </div>

            {/* Citizen KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: 'My Total Reports',
                  value: complaints.filter((c) => c.citizenId === 'cit-1').length,
                  icon: FileText,
                  accent: 'text-[#d95d39]',
                },
                {
                  label: 'Active / In Progress',
                  value: complaints.filter((c) => c.citizenId === 'cit-1' && !['RESOLVED', 'CLOSED', 'REJECTED'].includes(c.status)).length,
                  icon: Clock,
                  accent: 'text-amber-500',
                },
                {
                  label: 'Resolved Issues',
                  value: complaints.filter((c) => c.citizenId === 'cit-1' && ['RESOLVED', 'CLOSED'].includes(c.status)).length,
                  icon: CheckCircle2,
                  accent: 'text-emerald-600',
                },
              ].map((kpi, idx) => {
                const Icon = kpi.icon;
                return (
                  <div key={idx} className={`rounded-2xl border p-5 flex items-center justify-between ${t.card}`}>
                    <div>
                      <p className={`text-xs font-medium ${t.textMuted}`}>{kpi.label}</p>
                      <p className="font-display text-3xl font-bold mt-1 tabular-nums">{kpi.value}</p>
                    </div>
                    <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${t.subtleSurface}`}>
                      <Icon className={`w-5 h-5 ${kpi.accent}`} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Split Grid: Recent Complaints + Nearby Spatial Map */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold">My Recent Complaints</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('MY_COMPLAINTS')}
                    className={`text-xs font-semibold hover:underline ${t.accentText}`}
                  >
                    View all
                  </button>
                </div>
                <div className="space-y-3">
                  {complaints
                    .filter((c) => c.citizenId === 'cit-1')
                    .map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedComplaintId(c.id);
                          setDetailModalComplaint(c);
                        }}
                        className={`rounded-2xl border p-4 cursor-pointer transition space-y-2 ${t.card} ${t.cardHover}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-mono-code text-xs font-semibold ${t.accentText}`}>
                            {c.referenceNumber}
                          </span>
                          <StatusBadge status={c.status} />
                        </div>
                        <h3 className="text-sm font-bold">{c.title}</h3>
                        <div className={`flex items-center justify-between text-xs pt-1 ${t.textMuted}`}>
                          <CategoryLabel categoryId={c.category} />
                          <span className="font-medium">
                            {c.status === 'RESOLVED' ? 'Action needed: Confirm & Rate' : 'View timeline →'}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold">Nearby Civic Issues (Ola Maps)</h2>
                  <span className={`text-[11px] font-mono-code ${t.textFaint}`}>10 km radius</span>
                </div>
                <OlaMapCanvas
                  complaints={complaints}
                  selectedId={selectedComplaintId}
                  onSelectComplaint={(c) => setSelectedComplaintId(c.id)}
                  heightClass="h-[340px]"
                  isDark={isDark}
                />
              </div>
            </div>
          </div>
        )}

        {/* Citizen Multi-Step Complaint Wizard */}
        {role === 'CITIZEN' && activeTab === 'REPORT' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Report a Civic Issue</h1>
              <p className={`text-xs mt-1 ${t.textMuted}`}>
                Provide accurate details, map coordinates, and photo evidence for rapid municipal routing.
              </p>
            </div>

            {/* Stepper Progress */}
            <div className={`grid grid-cols-4 gap-2 border p-2 rounded-2xl ${t.card}`}>
              {[
                { step: 1, label: '1. Issue Details' },
                { step: 2, label: '2. Pin Location' },
                { step: 3, label: '3. S3 Evidence' },
                { step: 4, label: '4. Review & Submit' },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setReportStep(s.step)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold text-center transition ${
                    reportStep === s.step
                      ? 'bg-[#d95d39] text-white shadow-sm'
                      : reportStep > s.step
                      ? t.subtleSurface
                      : t.textFaint
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleCitizenSubmitComplaint} className={`rounded-2xl border p-6 space-y-5 ${t.card}`}>
              {reportStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Issue Category *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setReportForm({ ...reportForm, category: cat.id })}
                          className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                            reportForm.category === cat.id
                              ? isDark
                                ? 'bg-[#d95d39]/20 border-[#d95d39] text-stone-100'
                                : 'bg-orange-50 border-[#d95d39] text-stone-900'
                              : `${t.subtleSurface} hover:border-[#d95d39]/50`
                          }`}
                        >
                          <span className="text-xs font-semibold">{cat.label}</span>
                          <span className={`text-[10px] font-mono-code ${t.textFaint}`}>SLA {cat.slaHours}h</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Complaint Title *</label>
                    <input
                      type="text"
                      required
                      value={reportForm.title}
                      onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                      placeholder="e.g., Broken storm drain cover near 4th Cross junction"
                      className={`w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none ${t.input}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Detailed Description *</label>
                    <textarea
                      rows={4}
                      required
                      value={reportForm.description}
                      onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                      placeholder="Describe severity, safety impact, and duration..."
                      className={`w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none ${t.input}`}
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      disabled={!reportForm.title.trim() || !reportForm.description.trim()}
                      onClick={() => setReportStep(2)}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs disabled:opacity-40 ${t.primaryBtn}`}
                    >
                      Next: Location Pin <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {reportStep === 2 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold">Pin Exact Coordinates on Ola Maps</span>
                    <button
                      type="button"
                      onClick={() => {
                        setReportForm((f) => ({
                          ...f,
                          mapPos: { x: 50, y: 50 },
                          coordinates: [77.6410, 12.9765],
                          address: 'Detected GPS: 100 Feet Rd, Indiranagar, Bengaluru',
                        }));
                        triggerToast('GPS Coordinates Locked', 'Centered pin on browser geolocation.');
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${t.secondaryBtn}`}
                    >
                      <Crosshair className="w-3.5 h-3.5 text-[#d95d39]" /> Use My Current GPS
                    </button>
                  </div>

                  <OlaMapCanvas
                    pickerMode
                    pickedLocation={{
                      x: reportForm.mapPos.x,
                      y: reportForm.mapPos.y,
                      coordinates: reportForm.coordinates,
                    }}
                    onPickLocation={(loc) =>
                      setReportForm((f) => ({
                        ...f,
                        mapPos: { x: loc.x, y: loc.y },
                        coordinates: loc.coordinates,
                        address: loc.address,
                      }))
                    }
                    heightClass="h-[300px]"
                    isDark={isDark}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${t.textMuted}`}>Reverse-Geocoded Address</label>
                      <input
                        type="text"
                        value={reportForm.address}
                        onChange={(e) => setReportForm({ ...reportForm, address: e.target.value })}
                        className={`w-full border rounded-xl px-3 py-2 text-xs ${t.input}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${t.textMuted}`}>Nearby Landmark (Optional)</label>
                      <input
                        type="text"
                        value={reportForm.landmark}
                        onChange={(e) => setReportForm({ ...reportForm, landmark: e.target.value })}
                        placeholder="e.g., Opposite Metro Pillar 42"
                        className={`w-full border rounded-xl px-3 py-2 text-xs ${t.input}`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setReportStep(1)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold ${t.secondaryBtn}`}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportStep(3)}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs ${t.primaryBtn}`}
                    >
                      Next: Upload Evidence <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {reportStep === 3 && (
                <div className="space-y-4">
                  <div
                    className={`border-2 border-dashed rounded-2xl p-6 text-center space-y-2 transition ${
                      isDark
                        ? 'border-stone-700 hover:border-[#d95d39]/60 bg-[#111413]'
                        : 'border-[#d6cfc2] hover:border-[#d95d39]/60 bg-[#f6f3ec]'
                    }`}
                  >
                    <UploadCloud className="w-8 h-8 text-[#d95d39] mx-auto" />
                    <p className="text-sm font-bold">Attach Photo Evidence (Private AWS S3 Bucket)</p>
                    <p className={`text-xs ${t.textFaint}`}>
                      JPEG, PNG, or WebP up to 10MB • Uploaded via short-lived SigV4 pre-signed PUT URLs
                    </p>
                    <div className="pt-2 flex flex-wrap justify-center gap-2">
                      {['road_damage_view1.jpg', 'close_up_hazard.webp'].map((sampleFile) => (
                        <button
                          key={sampleFile}
                          type="button"
                          onClick={() => {
                            if (!reportForm.files.includes(sampleFile)) {
                              setReportForm((f) => ({ ...f, files: [...f.files, sampleFile] }));
                              triggerToast('S3 Pre-Signed Upload Complete', `Attached ${sampleFile}`);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${t.secondaryBtn}`}
                        >
                          + Simulate Upload: {sampleFile}
                        </button>
                      ))}
                    </div>
                  </div>

                  {reportForm.files.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold">Attached Evidence Keys ({reportForm.files.length}/5)</p>
                      {reportForm.files.map((file) => (
                        <div
                          key={file}
                          className={`flex items-center justify-between border px-3.5 py-2.5 rounded-xl text-xs ${t.subtleSurface}`}
                        >
                          <span className="flex items-center gap-2 font-medium">
                            <Camera className="w-3.5 h-3.5 text-[#d95d39]" />
                            {file}
                            <span className={`text-[10px] font-mono-code font-semibold ${t.emeraldText}`}>
                              [S3 VERIFIED]
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setReportForm((f) => ({ ...f, files: f.files.filter((x) => x !== file) }))}
                            className="opacity-60 hover:text-rose-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setReportStep(2)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold ${t.secondaryBtn}`}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportStep(4)}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs ${t.primaryBtn}`}
                    >
                      Review Submission <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {reportStep === 4 && (
                <div className="space-y-4">
                  <div className={`border rounded-2xl p-4 space-y-3 text-xs ${t.subtleSurface}`}>
                    <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-stone-800' : 'border-stone-200'}`}>
                      <span className={t.textMuted}>Category</span>
                      <CategoryLabel categoryId={reportForm.category} />
                    </div>
                    <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-stone-800' : 'border-stone-200'}`}>
                      <span className={t.textMuted}>Title</span>
                      <span className="font-semibold">{reportForm.title}</span>
                    </div>
                    <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-stone-800' : 'border-stone-200'}`}>
                      <span className={t.textMuted}>GeoJSON Coordinates</span>
                      <span className={`font-mono-code font-semibold ${t.accentText}`}>
                        [{reportForm.coordinates[0]}, {reportForm.coordinates[1]}]
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={t.textMuted}>S3 Evidence Attachments</span>
                      <span className="font-semibold">{reportForm.files.length} file(s)</span>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setReportStep(3)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold ${t.secondaryBtn}`}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingReport}
                      className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs transition ${t.primaryBtn}`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isSubmittingReport ? 'Submitting...' : 'Submit Official Complaint'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}

        {role === 'CITIZEN' && (activeTab === 'MY_COMPLAINTS' || activeTab === 'NEARBY') && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-bold">
                  {activeTab === 'MY_COMPLAINTS' ? 'My Submitted Complaints' : 'Nearby Neighborhood Issues'}
                </h1>
                <p className={`text-xs ${t.textMuted}`}>
                  Click any complaint to inspect status history, S3 evidence, or submit resolution feedback.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`border rounded-xl px-3 py-2 text-xs outline-none ${t.input}`}
                >
                  <option value="ALL">All Statuses</option>
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeTab === 'NEARBY' && (
              <OlaMapCanvas
                complaints={complaints}
                selectedId={selectedComplaintId}
                onSelectComplaint={(c) => setSelectedComplaintId(c.id)}
                heightClass="h-[340px]"
                isDark={isDark}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredComplaints.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setDetailModalComplaint(c)}
                  className={`rounded-2xl border p-5 cursor-pointer transition flex flex-col justify-between gap-3 ${t.card} ${t.cardHover}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-mono-code text-xs font-semibold ${t.accentText}`}>
                        {c.referenceNumber}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                    <h3 className="text-sm font-bold">{c.title}</h3>
                    <p className={`text-xs line-clamp-2 ${t.textMuted}`}>{c.description}</p>
                  </div>
                  <div
                    className={`pt-3 border-t flex items-center justify-between text-xs ${
                      isDark ? 'border-stone-800 text-stone-400' : 'border-stone-200 text-stone-600'
                    }`}
                  >
                    <span className="truncate max-w-[65%]">{c.address}</span>
                    <span className={`font-semibold ${t.accentText}`}>Inspect →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 3. ADMIN CONSOLE                                                   */}
        {/* ------------------------------------------------------------------ */}
        {role === 'ADMIN' && (activeTab === 'ADMIN_OVERVIEW' || activeTab === 'TRIAGE') && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold">Municipal Operations & Triage Console</h1>
                <p className={`text-xs mt-0.5 ${t.textMuted}`}>
                  Verify citizen submissions, inspect duplicate candidates, set priorities, and dispatch department officers.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 opacity-50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter ref / street..."
                    className={`border rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none ${t.input}`}
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`border rounded-xl px-2.5 py-1.5 text-xs ${t.input}`}
                >
                  <option value="ALL">All Statuses</option>
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Admin Operational KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`border rounded-2xl p-4 ${t.card}`}>
                <span className={`text-xs font-medium ${t.textMuted}`}>Total Complaints</span>
                <div className="font-display text-2xl sm:text-3xl font-bold mt-1 tabular-nums">{analytics.total}</div>
              </div>
              <div className={`border rounded-2xl p-4 ${t.card}`}>
                <span className={`text-xs font-medium ${t.textMuted}`}>Pending Review / Triage</span>
                <div className="font-display text-2xl sm:text-3xl font-bold text-amber-500 mt-1 tabular-nums">
                  {complaints.filter((c) => ['SUBMITTED', 'UNDER_REVIEW'].includes(c.status)).length}
                </div>
              </div>
              <div className={`border rounded-2xl p-4 ${t.card}`}>
                <span className={`text-xs font-medium ${t.textMuted}`}>SLA Overdue Escalations</span>
                <div className="font-display text-2xl sm:text-3xl font-bold text-rose-500 mt-1 tabular-nums">{analytics.overdue}</div>
              </div>
              <div className={`border rounded-2xl p-4 ${t.card}`}>
                <span className={`text-xs font-medium ${t.textMuted}`}>Resolution Rate</span>
                <div className={`font-display text-2xl sm:text-3xl font-bold mt-1 tabular-nums ${t.emeraldText}`}>
                  {Math.round((analytics.resolved / Math.max(1, analytics.total)) * 100)}%
                </div>
              </div>
            </div>

            {/* Spatial Cluster Map + Queue Table */}
            {activeTab === 'ADMIN_OVERVIEW' && (
              <OlaMapCanvas
                complaints={filteredComplaints}
                selectedId={selectedComplaintId}
                onSelectComplaint={(c) => setSelectedComplaintId(c.id)}
                heightClass="h-[300px]"
                isDark={isDark}
              />
            )}

            {/* Admin Complaint Management Table */}
            <div className={`border rounded-2xl overflow-hidden ${t.card}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr
                      className={`border-b text-[11px] font-mono-code uppercase tracking-wider ${
                        isDark
                          ? 'border-stone-800 bg-[#121614] text-stone-400'
                          : 'border-[#e2dbd0] bg-[#f2eee6] text-stone-600'
                      }`}
                    >
                      <th className="py-3 px-4">Reference & Issue</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Status & SLA</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Assignment</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y text-xs ${isDark ? 'divide-stone-800/80' : 'divide-[#e2dbd0]'}`}>
                    {filteredComplaints.map((c) => {
                      const assignedOfficer = OFFICERS.find((o) => o.id === c.assignedOfficerId);
                      return (
                        <tr
                          key={c.id}
                          className={`transition ${
                            selectedComplaintId === c.id
                              ? isDark
                                ? 'bg-[#d95d39]/10'
                                : 'bg-orange-50/70'
                              : isDark
                              ? 'hover:bg-stone-900/50'
                              : 'hover:bg-stone-100/70'
                          }`}
                        >
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono-code font-semibold ${t.accentText}`}>
                                {c.referenceNumber}
                              </span>
                              {c.duplicateCandidateOf && (
                                <span
                                  title={`Possible duplicate of ${c.duplicateCandidateOf} (${c.duplicateScore}% match)`}
                                  className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-300 text-[10px] font-semibold"
                                >
                                  Duplicate? {c.duplicateScore}%
                                </span>
                              )}
                            </div>
                            <div className="font-semibold mt-0.5 line-clamp-1">{c.title}</div>
                            <div className={`text-[11px] truncate ${t.textFaint}`}>{c.address}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <CategoryLabel categoryId={c.category} />
                          </td>
                          <td className="py-3.5 px-4 space-y-1">
                            <StatusBadge status={c.status} />
                            {c.isOverdue && (
                              <div className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> SLA OVERDUE
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <PriorityBadge priority={c.priority} />
                          </td>
                          <td className="py-3.5 px-4">
                            {assignedOfficer ? (
                              <div>
                                <div className="font-semibold">{assignedOfficer.name}</div>
                                <div className={`text-[10px] font-mono-code ${t.textFaint}`}>
                                  {DEPARTMENTS.find((d) => d.id === c.departmentId)?.code}
                                </div>
                              </div>
                            ) : (
                              <span className={`italic ${t.textFaint}`}>Unassigned</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDetailModalComplaint(c)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${t.secondaryBtn}`}
                              >
                                Details
                              </button>
                              {['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED'].includes(c.status) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAdminActionModal({ type: 'VERIFY_ASSIGN', complaint: c });
                                      setAssignPriority(c.priority);
                                    }}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] ${t.primaryBtn}`}
                                  >
                                    Verify & Assign
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAdminActionModal({ type: 'REJECT', complaint: c })}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-500 font-semibold text-[11px]"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {role === 'ADMIN' && activeTab === 'ANALYTICS' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold">Operational Analytics & SLA Performance</h1>
                <p className={`text-xs ${t.textMuted}`}>
                  Server-side MongoDB aggregation pipelines • Real-time department workload
                </p>
              </div>
              <button
                type="button"
                onClick={() => triggerToast('SLA Escalation Scan Executed', 'Idempotent check completed; 1 overdue complaint flagged.')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold ${t.secondaryBtn}`}
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#d95d39]" /> Run SLA Escalation Scan
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Distribution Bar Chart */}
              <div className={`border rounded-2xl p-5 space-y-4 ${t.card}`}>
                <h2 className="font-display text-base font-bold">Complaints by Civic Category</h2>
                <div className="space-y-3">
                  {analytics.byCategory.map((cat) => {
                    const pct = Math.round((cat.count / Math.max(1, analytics.total)) * 100);
                    return (
                      <div key={cat.id} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">{cat.label}</span>
                          <span className={`font-mono-code ${t.textMuted}`}>
                            {cat.count} ({pct}%)
                          </span>
                        </div>
                        <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-stone-800' : 'bg-[#e6dfd3]'}`}>
                          <div
                            style={{ width: `${Math.max(pct, 6)}%` }}
                            className="h-full bg-[#d95d39] rounded-full transition-all"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Department Resolution Matrix */}
              <div className={`border rounded-2xl p-5 space-y-4 ${t.card}`}>
                <h2 className="font-display text-base font-bold">Department Workload & SLA Adherence</h2>
                <div className="space-y-3">
                  {DEPARTMENTS.map((dept) => (
                    <div key={dept.id} className={`p-3.5 rounded-xl border flex items-center justify-between ${t.subtleSurface}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono-code text-[11px] font-semibold ${t.accentText}`}>{dept.code}</span>
                          <span className="text-xs font-bold">{dept.name}</span>
                        </div>
                        <p className={`text-[11px] mt-1 ${t.textFaint}`}>{dept.activeOfficers} active field officers</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold tabular-nums">{dept.openCount} Open</div>
                        <div className={`text-[11px] font-semibold ${t.emeraldText}`}>91% within SLA</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {role === 'ADMIN' && activeTab === 'DEPARTMENTS' && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Municipal Departments & Field Officers</h1>
              <p className={`text-xs ${t.textMuted}`}>Manage department routing codes and active officer assignments.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {OFFICERS.map((off) => {
                const dept = DEPARTMENTS.find((d) => d.id === off.departmentId);
                return (
                  <div key={off.id} className={`border rounded-2xl p-5 flex items-center justify-between ${t.card}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{off.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-mono-code font-semibold ${
                            isDark
                              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          }`}
                        >
                          OFFICER
                        </span>
                      </div>
                      <p className={`text-xs ${t.textMuted}`}>{dept?.name}</p>
                      <p className={`text-[11px] font-mono-code ${t.textFaint}`}>{off.email}</p>
                    </div>
                    <div className="text-right text-xs space-y-1">
                      <div className="font-bold">{off.activeTasks} Active</div>
                      <div className={`font-semibold ${t.emeraldText}`}>{off.resolvedCount} Resolved</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 4. OFFICER WORKSPACE                                               */}
        {/* ------------------------------------------------------------------ */}
        {role === 'OFFICER' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold">Officer Field Workspace</h1>
                <p className={`text-xs ${t.textMuted}`}>
                  Officer Arjun Nair • Roads & Civil Infrastructure (RCI-01)
                </p>
              </div>
              <div className={`flex items-center gap-2 text-xs border px-3.5 py-2 rounded-xl ${t.card}`}>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-semibold">GPS Telemetry Active</span>
              </div>
            </div>

            {activeTab === 'FIELD_MAP' && (
              <OlaMapCanvas
                complaints={complaints.filter((c) => !['RESOLVED', 'CLOSED', 'REJECTED'].includes(c.status))}
                selectedId={selectedComplaintId}
                onSelectComplaint={(c) => setSelectedComplaintId(c.id)}
                heightClass="h-[360px]"
                isDark={isDark}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {complaints
                .filter((c) => ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED'].includes(c.status))
                .map((c) => (
                  <div key={c.id} className={`border rounded-2xl p-5 space-y-4 ${t.card}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono-code text-xs font-semibold ${t.accentText}`}>
                            {c.referenceNumber}
                          </span>
                          <PriorityBadge priority={c.priority} />
                          {c.isOverdue && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500 border border-rose-500/40 font-bold">
                              OVERDUE
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold mt-1">{c.title}</h3>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>

                    <p className={`text-xs leading-relaxed ${t.textMuted}`}>{c.description}</p>

                    <div className={`border rounded-xl p-3 text-xs space-y-1 ${t.subtleSurface}`}>
                      <div className="flex items-center gap-1.5 font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-[#d95d39] shrink-0" />
                        {c.address}
                      </div>
                      <div className={`text-[11px] pl-5 font-mono-code ${t.textFaint}`}>
                        Landmark: {c.landmark} • GeoJSON: [{c.coordinates[0]}, {c.coordinates[1]}]
                      </div>
                    </div>

                    <div
                      className={`flex flex-wrap items-center justify-between gap-2 pt-3 border-t ${
                        isDark ? 'border-stone-800' : 'border-stone-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setDetailModalComplaint(c)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${t.secondaryBtn}`}
                      >
                        View Evidence & History
                      </button>

                      <div className="flex items-center gap-2">
                        {c.status === 'ASSIGNED' && (
                          <button
                            type="button"
                            onClick={() => handleOfficerStartWork(c)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs"
                          >
                            <Navigation className="w-3.5 h-3.5" /> Start Field Work
                          </button>
                        )}
                        {c.status === 'IN_PROGRESS' && (
                          <button
                            type="button"
                            onClick={() => setOfficerResolveModal(c)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Submit Resolution
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* COMPLAINT DETAIL & AUDIT TIMELINE DRAWER / MODAL                     */}
      {/* ==================================================================== */}
      {detailModalComplaint && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl ${t.card}`}>
            <div className={`flex items-start justify-between gap-4 border-b pb-4 ${isDark ? 'border-stone-800' : 'border-stone-200'}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono-code text-xs font-semibold ${t.accentText}`}>
                    {detailModalComplaint.referenceNumber}
                  </span>
                  <StatusBadge status={detailModalComplaint.status} />
                  <PriorityBadge priority={detailModalComplaint.priority} />
                </div>
                <h2 className="font-display text-xl font-bold mt-1.5">{detailModalComplaint.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalComplaint(null)}
                className={`p-1.5 rounded-xl ${t.secondaryBtn}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-xs leading-relaxed ${t.textMuted}`}>{detailModalComplaint.description}</p>

            {/* Location Info */}
            <div className={`border rounded-2xl p-3.5 text-xs space-y-1 ${t.subtleSurface}`}>
              <div className={t.textFaint}>Location & Coordinates</div>
              <div className="font-semibold">{detailModalComplaint.address}</div>
              <div className={`font-mono-code text-[11px] font-semibold ${t.accentText}`}>
                GeoJSON Point: [{detailModalComplaint.coordinates[0]}, {detailModalComplaint.coordinates[1]}]
              </div>
            </div>

            {/* S3 Evidence Gallery */}
            <div className="space-y-2">
              <h3 className={`text-xs font-mono-code font-semibold uppercase tracking-wider ${t.textFaint}`}>
                Private AWS S3 Evidence ({detailModalComplaint.evidence.length})
              </h3>
              {detailModalComplaint.evidence.length === 0 ? (
                <p className={`text-xs italic ${t.textFaint}`}>No photographic evidence uploaded.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {detailModalComplaint.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className={`rounded-2xl border p-3.5 flex flex-col justify-between h-28 ${t.subtleSurface}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono-code px-2 py-0.5 rounded-md border font-semibold ${t.card}`}>
                          {ev.type === 'RESOLUTION_PROOF' ? 'RESOLUTION PROOF' : 'CITIZEN EVIDENCE'}
                        </span>
                        <span className={`text-[10px] font-mono-code ${t.textFaint}`}>{ev.size}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="truncate">{ev.name}</span>
                        <Eye className="w-3.5 h-3.5 text-[#d95d39] shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Citizen Feedback Action when RESOLVED */}
            {detailModalComplaint.status === 'RESOLVED' && role === 'CITIZEN' && (
              <div
                className={`border rounded-2xl p-4 space-y-3 ${
                  isDark ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-emerald-50/80 border-emerald-200'
                }`}
              >
                <h3 className={`text-xs font-bold ${t.emeraldText}`}>
                  Confirm Resolution & Close Complaint
                </h3>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      className={`p-1 rounded ${feedbackRating >= star ? 'text-amber-500' : 'opacity-30'}`}
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                  ))}
                  <span className={`text-xs ml-2 font-mono-code ${t.textMuted}`}>{feedbackRating} / 5 Rating</span>
                </div>
                <input
                  type="text"
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Optional feedback on repair quality..."
                  className={`w-full border rounded-xl px-3 py-2 text-xs ${t.input}`}
                />
                <button
                  type="button"
                  onClick={() => handleCitizenCloseWithFeedback(detailModalComplaint)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                >
                  Confirm & Close Ticket
                </button>
              </div>
            )}

            {/* Vertical Audit Status History Timeline */}
            <div className="space-y-3">
              <h3 className={`text-xs font-mono-code font-semibold uppercase tracking-wider ${t.textFaint}`}>
                Immutable Status Audit Trail
              </h3>
              <div className={`space-y-3 pl-3 border-l-2 ${isDark ? 'border-stone-800' : 'border-stone-300'}`}>
                {detailModalComplaint.history.map((item, idx) => (
                  <div key={idx} className="relative pl-4 space-y-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#d95d39] border-2 border-white absolute -left-[21px] top-1" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={item.status} />
                      <span className={`font-mono-code text-[11px] ${t.textFaint}`}>{item.timestamp}</span>
                    </div>
                    <p className="text-xs font-medium">{item.remarks}</p>
                    <p className={`text-[11px] ${t.textFaint}`}>Actor: {item.actor}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ADMIN VERIFY & ASSIGN / REJECT MODAL                                 */}
      {/* ==================================================================== */}
      {adminActionModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl ${t.card}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">
                {adminActionModal.type === 'VERIFY_ASSIGN' ? 'Verify & Assign Complaint' : 'Reject Complaint'}
              </h3>
              <button
                type="button"
                onClick={() => setAdminActionModal(null)}
                className={t.textMuted}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`text-xs border rounded-xl p-3 ${t.subtleSurface}`}>
              <span className={`font-mono-code font-semibold ${t.accentText}`}>
                {adminActionModal.complaint.referenceNumber}
              </span>
              <p className="font-semibold mt-1">{adminActionModal.complaint.title}</p>
            </div>

            {adminActionModal.type === 'VERIFY_ASSIGN' ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className={`block font-semibold mb-1 ${t.textMuted}`}>Priority Level</label>
                  <select
                    value={assignPriority}
                    onChange={(e) => setAssignPriority(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 ${t.input}`}
                  >
                    <option value="CRITICAL">CRITICAL (12h SLA)</option>
                    <option value="HIGH">HIGH (24h SLA)</option>
                    <option value="MEDIUM">MEDIUM (48h SLA)</option>
                    <option value="LOW">LOW (72h SLA)</option>
                  </select>
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${t.textMuted}`}>Municipal Department</label>
                  <select
                    value={assignDeptId}
                    onChange={(e) => {
                      const dId = e.target.value;
                      setAssignDeptId(dId);
                      const matchingOff = OFFICERS.find((o) => o.departmentId === dId);
                      if (matchingOff) setAssignOfficerId(matchingOff.id);
                    }}
                    className={`w-full border rounded-xl px-3 py-2 ${t.input}`}
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${t.textMuted}`}>Assign Field Officer</label>
                  <select
                    value={assignOfficerId}
                    onChange={(e) => setAssignOfficerId(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 ${t.input}`}
                  >
                    {OFFICERS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.activeTasks} active tasks)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${t.textMuted}`}>Verification Remarks</label>
                  <input
                    type="text"
                    value={actionRemarks}
                    onChange={(e) => setActionRemarks(e.target.value)}
                    placeholder="Instructions for field crew..."
                    className={`w-full border rounded-xl px-3 py-2 ${t.input}`}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAdminActionModal(null)}
                    className={`px-4 py-2 rounded-xl font-semibold ${t.secondaryBtn}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAdminVerifyAndAssign}
                    className={`px-4 py-2 rounded-xl ${t.primaryBtn}`}
                  >
                    Confirm & Dispatch
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className={`block font-semibold mb-1 ${t.textMuted}`}>Mandatory Rejection Reason *</label>
                  <textarea
                    rows={3}
                    required
                    value={actionRemarks}
                    onChange={(e) => setActionRemarks(e.target.value)}
                    placeholder="e.g., Duplicate of CT-2026-000139 or outside municipal jurisdiction..."
                    className={`w-full border rounded-xl px-3 py-2 ${t.input}`}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAdminActionModal(null)}
                    className={`px-4 py-2 rounded-xl font-semibold ${t.secondaryBtn}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!actionRemarks.trim()}
                    onClick={handleAdminReject}
                    className="px-4 py-2 rounded-xl bg-rose-600 disabled:opacity-40 text-white font-semibold"
                  >
                    Reject Complaint
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* OFFICER RESOLUTION SUBMISSION MODAL                                  */}
      {/* ==================================================================== */}
      {officerResolveModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs ${t.card}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Submit Field Resolution</h3>
              <button
                type="button"
                onClick={() => setOfficerResolveModal(null)}
                className={t.textMuted}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className={t.textMuted}>
              Resolving <span className={`font-mono-code font-semibold ${t.accentText}`}>{officerResolveModal.referenceNumber}</span> requires field notes and S3 resolution proof.
            </p>
            <div>
              <label className="block font-semibold mb-1">Resolution Notes *</label>
              <textarea
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Describe repair work completed on site..."
                className={`w-full border rounded-xl px-3 py-2 ${t.input}`}
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Resolution Evidence Attachment (S3)</label>
              <input
                type="text"
                value={resolutionPhotoName}
                onChange={(e) => setResolutionPhotoName(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 font-mono-code font-semibold ${t.input}`}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOfficerResolveModal(null)}
                className={`px-4 py-2 rounded-xl font-semibold ${t.secondaryBtn}`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!resolutionNotes.trim()}
                onClick={handleOfficerResolve}
                className="px-4 py-2 rounded-xl bg-emerald-600 disabled:opacity-40 text-white font-semibold"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer
        className={`border-t py-4 px-4 sm:px-6 text-xs ${
          isDark ? 'border-stone-800 bg-[#101312] text-stone-400' : 'border-[#e2dbd0] bg-[#efeae0] text-stone-600'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>CivicTrack v1.0 • Smart Civic Complaint Management System (Academic / Portfolio Demonstration)</span>
          <span className="font-mono-code text-[11px]">Sandstone & Terracotta Civic UI • GeoJSON 2dsphere • S3 Pre-Signed</span>
        </div>
      </footer>
    </div>
  );
}