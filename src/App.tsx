/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Heart,
  Calendar,
  Users,
  Music,
  Store,
  Flag,
  ChevronRight,
  MapPin,
  Clock,
  Mail,
  Globe,
  ExternalLink,
  Menu,
  X,
  Camera,
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  HandHeart,
  Megaphone,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Image as ImageIcon,
  Upload,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowDownWideNarrow,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
export type SitePhase = 'PLANNING' | 'ACTIVE_PLANNING' | 'LIVE_EVENT';

export interface EventData {
  id: string;
  title: string;
  date?: string;        // display string e.g. "August 15, 2026"
  eventDate?: string;   // same field, camelCase from PHP API
  eventDateSort?: string; // real ISO date (YYYY-MM-DD), used for automatic chronological ordering — event_date/date above stay freeform for display
  time?: string;
  eventTime?: string;
  location?: string;
  locationDetails?: string;
  description?: string;
  iconKey: string;
  color: string;
  status: 'TBD' | 'TEASER' | 'CONFIRMED';
  teaserText?: string;
  ticketLink?: string;
  ticketPrice?: string;
  // Venue contact
  venueContactName?: string;
  venueContactEmail?: string;
  venueContactPhone?: string;
  venueContractUrl?: string;
  // Insurance
  insuranceRequired?: boolean;
  insuranceCarrier?: string;
  insurancePolicyNum?: string;
  insuranceExpiry?: string;
  insuranceAmount?: string;
  insuranceNotes?: string;
  estimatedAttendance?: number;
  sortOrder?: number;
  heroImage?: string;
  flyerImage?: string;
  extraImage?: string;
  extraImageLabel?: string;
}

interface Performer {
  id: number;
  eventId?: number;
  name: string;
  type: string;
  bio?: string;
  contactEmail?: string;
  contactPhone?: string;
  fee?: number;
  confirmed: boolean;
  performanceTime?: string;
  setLengthMins?: number;
  techRider?: string;
  notes?: string;
  sortOrder?: number;
}

interface EventCost {
  id: number;
  eventId?: number;
  category: string;
  description: string;
  estimatedCost?: number;
  actualCost?: number;
  vendor?: string;
  approved: boolean;
  paid: boolean;
  notes?: string;
}

interface EventMaterial {
  id: number;
  eventId?: number;
  item: string;
  quantity: number;
  unit?: string;
  obtained: boolean;
  source?: string;
  cost?: number;
  notes?: string;
}

interface StaffRole {
  id: number;
  eventId?: number;
  roleName: string;
  description?: string;
  slotsNeeded: number;
  slotsFilled: number;
  isPaid: boolean;
  payRate?: string;
  shiftTime?: string;
  notes?: string;
}

interface AgendaItem {
  id: number;
  meetingId?: number;
  itemOrder: number;
  title: string;
  description?: string;
  presenter?: string;
  timeAllocated?: number;
  status: 'pending' | 'discussed' | 'decided' | 'tabled';
  outcome?: string;
}

interface Decision {
  id: number;
  meetingId?: number;
  agendaItemId?: number;
  decision: string;
  decidedBy?: string;
  affectsEventId?: number;
  implementationStatus: 'pending' | 'in_progress' | 'complete';
  createdAt?: string;
}

interface Suggestion {
  id: number;
  message: string;
  submitterName?: string;
  submitterEmail?: string;
  status: 'new' | 'reviewed' | 'archived';
  reviewedMeetingId?: number;
  createdAt: string;
  reviewedAt?: string;
}

interface Application {
  id: number;
  type: 'volunteer' | 'vendor' | 'performer' | 'parade';
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  notes?: string;
  status: 'new' | 'reviewed' | 'accepted' | 'declined' | 'waitlisted';
  assignedTo?: string;
  internalNotes?: string;
  submittedAt: string;
}

interface DashboardStats {
  eventsTotal: number;
  eventsConfirmed: number;
  meetingsUpcoming: number;
  meetingsPast: number;
  applicationsNew: number;
  applicationsTotal: number;
  byApplicationType: Record<string, number>;
}

export interface Meeting {
  id: string;
  date: string;
  time: string;
  location: string;
  agendaUrl?: string;
  whoIsInvited: string;
  isPast?: boolean;
  notes?: string;
}

export interface PhotoAlbum {
  id?: string;
  title: string;
  year: number;
  eventId?: string;
  coverImage?: string;   // data URL or absolute URL
  externalUrl?: string;  // Google Photos, Flickr, etc.
  photoCount: number;
  description?: string;
  visible?: boolean;
}

export interface Sponsor {
  id?: string;
  name: string;
  logo?: string;
  logoInitials?: string;
  logoUrl?: string;
  level: 'Platinum' | 'Gold' | 'Silver' | 'Community' | 'In-Kind';
  website?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  amount?: number;
  paymentReceived?: boolean;
  notes?: string;
}

// --- API helpers ---
const checkOk = async (r: Response) => {
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try { const b = await r.json(); msg = b.error ?? msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
};

const api = {
  get:  (path: string)              => fetch(path).then(checkOk),
  post: (path: string, body: any)   => fetch(path, { method: 'POST',   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(checkOk),
  put:  (path: string, body: any)   => fetch(path, { method: 'PUT',    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(checkOk),
  del:  (path: string)              => fetch(path, { method: 'DELETE' }).then(checkOk),
};

// Resize + recompress an image file client-side before base64 encoding.
// Keeps uploads well within GoDaddy's post_max_size and MySQL max_allowed_packet.
const compressImage = (
  file: File,
  maxDimension = 1920,
  quality = 0.82,
): Promise<string> =>
  new Promise(resolve => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Fallback: read as-is if canvas fails (e.g. SVG)
      const reader = new FileReader();
      reader.onload = ev => resolve(ev.target?.result as string);
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  });

const useEscapeKey = (onClose: () => void) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
};

const ICON_MAP: Record<string, React.ReactElement> = {
  Heart: <Heart size={32} />,
  Calendar: <Calendar size={32} />,
  Users: <Users size={32} />,
  Music: <Music size={32} />,
  Store: <Store size={32} />,
  Flag: <Flag size={32} />,
  Camera: <Camera size={32} />
};

// ── Sponsorship & Contribution data ──────────────────────────────────────────

const SPONSOR_TIERS: {
  level: Sponsor['level'];
  minAmount: number | null;
  tagline: string;
  highlight?: boolean;
  benefits: string[];
}[] = [
  {
    level: 'Platinum',
    minAmount: 2500,
    tagline: 'Premier Community Champion',
    highlight: true,
    benefits: [
      'Logo featured on website — all pages',
      'Logo on main stage banner & all printed materials',
      'Dedicated social media spotlight — 3 posts',
      'Full newsletter feature (2,000+ subscribers)',
      '4 VIP passes to all Pride events',
      'Branded activation space at Pride on the Plaza',
      'Speaking opportunity at opening ceremony',
      'Official community partnership certificate',
    ],
  },
  {
    level: 'Gold',
    minAmount: 1000,
    tagline: 'Community Partner',
    benefits: [
      'Logo on event website',
      'Logo on select printed materials',
      '2 social media mentions',
      'Newsletter mention',
      '2 VIP passes to Pride events',
      'Vendor table at Pride on the Plaza',
      'Community partnership certificate',
    ],
  },
  {
    level: 'Silver',
    minAmount: 500,
    tagline: 'Community Supporter',
    benefits: [
      'Logo/name on event website',
      '1 social media mention',
      'Newsletter mention',
      'Community supporter certificate',
    ],
  },
  {
    level: 'Community',
    minAmount: 250,
    tagline: 'Friend of Pride',
    benefits: [
      'Name listed on website',
      'Social media thank-you',
      'Community friend certificate',
    ],
  },
  {
    level: 'In-Kind',
    minAmount: null,
    tagline: 'Goods & Services Donor',
    benefits: [
      'Listed as in-kind supporter on website',
      'Social media thank-you post',
      'Community recognition at events',
    ],
  },
];

const TIER_COLORS: Record<string, string> = {
  Platinum: '#9C27B0',
  Gold: '#F59E0B',
  Silver: '#6B7280',
  Community: '#10B981',
  'In-Kind': '#00BCD4',
};

const CONTRIBUTION_IMPACTS = [
  { amount: 25,  label: '$25',  blurb: 'Covers supplies for one volunteer shift' },
  { amount: 50,  label: '$50',  blurb: 'Funds a volunteer t-shirt' },
  { amount: 100, label: '$100', blurb: 'Pays the sound permit fee' },
  { amount: 250, label: '$250', blurb: "Sponsors a performer's fee" },
  { amount: 500, label: '$500', blurb: 'Covers venue permit & insurance' },
];

// --- Components ---

// ── Admin: Dashboard ─────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon, accent }: {
  label: string; value: number | string; sub?: string;
  icon: React.ReactNode; accent: string;
}) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
    <div className={`absolute top-0 left-0 w-1 h-full ${accent}`} />
    <div className="flex justify-between items-start gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{label}</p>
        <p className="text-4xl font-black text-gray-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1 font-medium">{sub}</p>}
      </div>
      <div className="text-gray-300">{icon}</div>
    </div>
  </div>
);

export const AdminDashboard = ({ events, meetings, sponsors }: { events: EventData[]; meetings: Meeting[]; sponsors: Sponsor[] }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.get('/api/dashboard').then(setStats).catch(() => {});
  }, []);

  const confirmed = events.filter(e => e.status === 'CONFIRMED').length;
  const teaser    = events.filter(e => e.status === 'TEASER').length;
  const tbd       = events.filter(e => e.status === 'TBD').length;
  const upcoming  = meetings.filter(m => !m.isPast).length;

  return (
    <div className="space-y-10">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Events"
          value={events.length}
          sub={`${confirmed} confirmed · ${teaser} teaser · ${tbd} TBD`}
          icon={<Calendar size={28} />}
          accent="bg-pink-500"
        />
        <StatCard
          label="Upcoming Meetings"
          value={upcoming}
          sub={`${meetings.filter(m => m.isPast).length} past sessions`}
          icon={<CalendarDays size={28} />}
          accent="bg-blue-500"
        />
        <StatCard
          label="New Applications"
          value={stats?.applicationsNew ?? '—'}
          sub={stats ? `${stats.applicationsTotal} total submitted` : 'loading…'}
          icon={<HandHeart size={28} />}
          accent="bg-yellow-500"
        />
        <StatCard
          label="Sponsors"
          value={sponsors.length}
          sub={`${sponsors.filter(s => s.level === 'Platinum' || s.level === 'Gold').length} Platinum/Gold`}
          icon={<Megaphone size={28} />}
          accent="bg-purple-500"
        />
      </div>

      {/* Event status breakdown */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-widest mb-6 text-gray-500">Event Pipeline</h3>
        <div className="space-y-3">
          {events.map(ev => (
            <div key={ev.id} className="flex items-center gap-4">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
              <span className="font-bold text-gray-900 flex-1 text-sm">{ev.title}</span>
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                ev.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                ev.status === 'TEASER'    ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-500'
              }`}>
                {ev.status === 'CONFIRMED' ? <span className="flex items-center gap-1"><CheckCircle2 size={10} /> Confirmed</span> :
                 ev.status === 'TEASER'    ? <span className="flex items-center gap-1"><TrendingUp size={10} /> Teaser</span> :
                                             <span className="flex items-center gap-1"><HelpCircle size={10} /> TBD</span>}
              </span>
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-gray-400 text-sm italic">No events yet. Add some in the Events tab.</p>
          )}
        </div>
      </div>

      {/* Applications by type */}
      {stats && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-widest mb-6 text-gray-500">Applications by Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['volunteer','vendor','performer','parade'] as const).map(type => (
              <div key={type} className="text-center">
                <p className="text-3xl font-black text-gray-900">{stats.byApplicationType[type] ?? 0}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">{type}</p>
              </div>
            ))}
          </div>
          {stats.applicationsNew > 0 && (
            <div className="mt-6 flex items-center gap-3 bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
              <AlertCircle size={16} className="text-yellow-600 shrink-0" />
              <p className="text-sm font-bold text-yellow-800">
                {stats.applicationsNew} application{stats.applicationsNew !== 1 ? 's' : ''} need review — check the Applications tab.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Upcoming meetings list */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-widest mb-6 text-gray-500">Upcoming Meetings</h3>
        {meetings.filter(m => !m.isPast).length === 0 ? (
          <p className="text-gray-400 text-sm italic">No upcoming meetings scheduled.</p>
        ) : (
          <div className="space-y-3">
            {meetings.filter(m => !m.isPast).map(m => (
              <div key={m.id} className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-bold text-gray-900 text-sm">{m.date}</p>
                  <p className="text-xs text-gray-500">{m.time} · {m.location}</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-pink-100 text-pink-700 px-3 py-1 rounded-full">
                  Upcoming
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Admin: Tab bar ────────────────────────────────────────────────────────────
type AdminTab = 'overview' | 'events' | 'meetings' | 'applications' | 'sponsors' | 'photos' | 'comms' | 'hero' | 'participation';

// Per-phase hero configuration stored in site_settings
interface HeroPhaseConfig {
  image: string;
  line1: string;
  line2: string;
  sub: string;
  ctaLabel: string;
  ctaHref: string;
}
export interface HeroSettings {
  planning: HeroPhaseConfig;
  activePlanning: HeroPhaseConfig;
  liveEvent: HeroPhaseConfig;
}
export const HERO_DEFAULTS: HeroSettings = {
  planning: {
    image: '', line1: 'REST', line2: 'RECHARGE',
    sub: 'Thank you for an incredible Pride season. We are currently in our early planning stages for next year.',
    ctaLabel: 'Volunteer with Us', ctaHref: '#volunteer',
  },
  activePlanning: {
    image: '', line1: 'FIND YOUR', line2: 'VOICE',
    sub: '',
    ctaLabel: 'Planning Progress', ctaHref: '#events',
  },
  liveEvent: {
    image: '', line1: 'LOVE IS', line2: 'RESISTANT',
    sub: '',
    ctaLabel: 'See the Schedule', ctaHref: '#events',
  },
};

// ── Participation config ──────────────────────────────────────────────────────
export type ParticipationTypeKey = 'volunteer' | 'vendor' | 'performer' | 'parade';

export interface ParticipationConfig {
  visible: boolean;
  title: string;
  description: string;   // may contain <a href="..."> HTML
  showPhone: boolean;
  showOrganization: boolean;
  showUpload: boolean;
  externalUrl: string;   // if non-empty, card opens this URL instead of the inline form
  ctaLabel: string;
  successMessage: string;
}

export const PARTICIPATION_KEYS: ParticipationTypeKey[] = ['volunteer', 'vendor', 'performer', 'parade'];

const PARTICIPATION_META: Record<ParticipationTypeKey, { icon: React.ReactElement; colorClass: string }> = {
  volunteer: { icon: <Users size={32} />,  colorClass: 'border-pink-500/20 hover:bg-pink-50 shadow-pink-100/20' },
  vendor:    { icon: <Store size={32} />,  colorClass: 'border-orange-500/20 hover:bg-orange-50 shadow-orange-100/20' },
  performer: { icon: <Music size={32} />,  colorClass: 'border-yellow-500/20 hover:bg-yellow-50 shadow-yellow-100/20' },
  parade:    { icon: <Flag size={32} />,   colorClass: 'border-blue-500/20 hover:bg-blue-50 shadow-blue-100/20' },
};

export const PARTICIPATION_DEFAULTS: Record<ParticipationTypeKey, ParticipationConfig> = {
  volunteer: {
    visible: true, title: 'Volunteer',
    description: 'Be the magic behind the scenes. We need helpers for hospitality, setup, security, and more.',
    showPhone: false, showOrganization: false, showUpload: false,
    externalUrl: '', ctaLabel: 'Apply Now',
    successMessage: 'Thank you for being part of Taos Pride. We will reach out soon.',
  },
  vendor: {
    visible: true, title: 'Vendors',
    description: 'Showcase your queer-owned business or ally organization at Pride on the Plaza.',
    showPhone: true, showOrganization: true, showUpload: false,
    externalUrl: '', ctaLabel: 'Apply Now',
    successMessage: 'Thank you for your interest in vending! We will be in touch with next steps.',
  },
  performer: {
    visible: true, title: 'Performers',
    description: 'Dancers, musicians, drag artists, and speakers—we want your talent on our main stage!',
    showPhone: true, showOrganization: false, showUpload: false,
    externalUrl: '', ctaLabel: 'Apply Now',
    successMessage: 'Thank you for your interest in performing! We will review your submission and follow up.',
  },
  parade: {
    visible: true, title: 'Parade',
    description: 'Sign up your group, float, or car to march through Taos in the most colorful parade of the year.',
    showPhone: true, showOrganization: true, showUpload: false,
    externalUrl: '', ctaLabel: 'Apply Now',
    successMessage: 'Thank you for signing up for the parade! Details on lineup and staging coming soon.',
  },
};

const AdminTabBar = ({ active, onChange }: { active: AdminTab; onChange: (t: AdminTab) => void }) => {
  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',     label: 'Overview',     icon: <LayoutDashboard size={15} /> },
    { id: 'events',       label: 'Events',       icon: <Calendar size={15} /> },
    { id: 'meetings',     label: 'Meetings',     icon: <CalendarDays size={15} /> },
    { id: 'applications', label: 'Applications', icon: <ClipboardList size={15} /> },
    { id: 'sponsors',     label: 'Sponsors',     icon: <Megaphone size={15} /> },
    { id: 'photos',       label: 'Photos',       icon: <Camera size={15} /> },
    { id: 'comms',        label: 'Communications', icon: <Mail size={15} /> },
    { id: 'hero',         label: 'Hero Banner',  icon: <ImageIcon size={15} /> },
    { id: 'participation', label: 'Get Involved', icon: <Users size={15} /> },
  ];
  return (
    <div className="flex flex-wrap gap-1 bg-white border border-gray-200 rounded-2xl p-1.5 w-fit mb-8 shadow-sm">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            active === t.id
              ? 'bg-gray-900 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
};

const AdminSpreadsheet = ({ 
  data, 
  onSave, 
  title, 
  columns 
}: { 
  data: any[], 
  onSave: (newData: any[]) => void, 
  title: string,
  columns: { key: string, label: string, type: 'text' | 'select' | 'checkbox', options?: string[] }[]
}) => {
  const [localData, setLocalData] = useState(data);

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  const handleChange = (id: string, key: string, value: any) => {
    const updated = localData.map(item => item.id === id ? { ...item, [key]: value } : item);
    setLocalData(updated);
  };

  const addRow = () => {
    const newId = Date.now().toString();
    const newRow: any = { id: newId };
    columns.forEach(col => newRow[col.key] = col.type === 'checkbox' ? false : (col.options?.[0] || ""));
    setLocalData([...localData, newRow]);
  };

  const deleteRow = (id: string) => {
    setLocalData(localData.filter(item => item.id !== id));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm text-xs overflow-x-auto my-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-5 border-b border-gray-100">
        <h3 className="text-base font-bold text-gray-900">{title.replace(/_/g, ' ')}</h3>
        <div className="flex gap-2">
          <button
            onClick={addRow}
            className="bg-gray-100 px-4 py-2 rounded-lg font-bold text-gray-600 hover:bg-gray-200 transition-colors text-xs"
          >
            Add Row
          </button>
          <button
            onClick={() => onSave(localData)}
            className="bg-pink-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-pink-600 transition-colors text-xs"
          >
            Save
          </button>
        </div>
      </div>

      <table className="w-full border-collapse min-w-[800px]">
        <thead>
          <tr className="text-left border-b border-gray-100">
            <th className="p-3 text-gray-400 text-[9px] font-bold uppercase tracking-widest">ID</th>
            {columns.map(col => (
              <th key={col.key} className="p-3 text-gray-500 text-[9px] font-bold uppercase tracking-widest">{col.label}</th>
            ))}
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {localData.map((item) => (
            <tr key={item.id} className="border-b border-gray-300 hover:bg-white/40 transition-colors">
              <td className="p-3 opacity-30 text-[9px] font-bold">{item.id.slice(-4)}</td>
              {columns.map(col => (
                <td key={col.key} className="p-3">
                  {col.type === 'text' && (
                    <input 
                      type="text" 
                      value={item[col.key] || ""} 
                      onChange={(e) => handleChange(item.id, col.key, e.target.value)}
                      className="bg-transparent border-b border-dashed border-gray-400 focus:border-solid focus:border-pink-500 outline-none w-full py-1 text-[11px]"
                    />
                  )}
                  {col.type === 'select' && (
                    <select 
                      value={item[col.key]} 
                      onChange={(e) => handleChange(item.id, col.key, e.target.value)}
                      className="bg-transparent border-b border-dashed border-gray-400 outline-none w-full cursor-pointer py-1 text-[11px]"
                    >
                      {col.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  )}
                  {col.type === 'checkbox' && (
                    <div className="flex justify-center">
                      <input 
                        type="checkbox" 
                        checked={item[col.key] || false} 
                        onChange={(e) => handleChange(item.id, col.key, e.target.checked)}
                        className="w-4 h-4 accent-pink-500"
                      />
                    </div>
                  )}
                </td>
              ))}
              <td className="p-3 text-right">
                <button onClick={() => deleteRow(item.id)} className="text-gray-400 hover:text-red-500 transition-colors"><X size={14} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Shared admin form helpers ─────────────────────────────────────────────────
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full bg-white border-2 border-gray-200 focus:border-pink-500 px-3 py-2 text-sm outline-none transition-colors font-mono";
const selectCls = "w-full bg-white border-2 border-gray-200 focus:border-pink-500 px-3 py-2 text-sm outline-none transition-colors font-mono cursor-pointer";

// ── Batch 3: EventEditor ──────────────────────────────────────────────────────
type EventEditorTab = 'info' | 'images' | 'performers' | 'budget' | 'materials' | 'staffing' | 'marketing';

const EventEditor = ({ event, onSave, onDelete }: {
  event: EventData;
  onSave: () => void;
  onDelete: () => void | Promise<void>;
  key?: React.Key;
}) => {
  const [tab, setTab]           = useState<EventEditorTab>('info');
  const [form, setForm]         = useState<EventData>(event);
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [costs, setCosts]           = useState<EventCost[]>([]);
  const [materials, setMaterials]   = useState<EventMaterial[]>([]);
  const [staff, setStaff]           = useState<StaffRole[]>([]);
  const [saving, setSaving]         = useState(false);

  // sync form when parent switches selected event
  useEffect(() => { setForm(event); setTab('info'); }, [event.id]);

  useEffect(() => {
    if (!event.id) return;
    api.get(`/api/events/${event.id}/performers`).then(setPerformers).catch(() => {});
    api.get(`/api/events/${event.id}/costs`).then(setCosts).catch(() => {});
    api.get(`/api/events/${event.id}/materials`).then(setMaterials).catch(() => {});
    api.get(`/api/events/${event.id}/staff`).then(setStaff).catch(() => {});
  }, [event.id]);

  const set = (key: keyof EventData, val: any) => setForm(f => ({ ...f, [key]: val }));

  const saveInfo = async () => {
    setSaving(true);
    try {
      // Normalize: form uses `date`/`time` but the PHP API column names
      // come back as `eventDate`/`eventTime` via camelCase conversion.
      // Send both so Node.js dev server and PHP both work.
      const payload = {
        ...form,
        eventDate: form.date || form.eventDate || null,
        eventTime: form.time || form.eventTime || null,
      };
      await api.put(`/api/events/${event.id}`, payload);
      onSave();
    } finally { setSaving(false); }
  };

  const editorTabs: { id: EventEditorTab; label: string }[] = [
    { id: 'info',       label: 'Info' },
    { id: 'images',     label: 'Images' },
    { id: 'performers', label: 'Performers' },
    { id: 'budget',     label: 'Budget' },
    { id: 'materials',  label: 'Materials' },
    { id: 'staffing',   label: 'Staffing' },
    { id: 'marketing',  label: 'Marketing' },
  ];

  const totalEstimated = costs.reduce((s, c) => s + (Number(c.estimatedCost) || 0), 0);
  const totalActual    = costs.reduce((s, c) => s + (Number(c.actualCost)    || 0), 0);

  return (
    <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Event editor header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="w-4 h-4 rounded-full shrink-0 border border-gray-300" style={{ backgroundColor: form.color }} />
        <span className="font-black text-lg tracking-tight flex-1 truncate">{form.title || 'Untitled Event'}</span>
        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${
          form.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
          form.status === 'TEASER'    ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
        }`}>{form.status}</span>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors text-xs font-bold uppercase">Delete</button>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {editorTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-r border-gray-200 transition-colors ${
              tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6 overflow-y-auto max-h-[60vh]">

        {/* ── INFO ── */}
        {tab === 'info' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Event Title">
                  <input className={inputCls} value={form.title || ''} onChange={e => set('title', e.target.value)} />
                </Field>
              </div>
              <Field label="Status">
                <select className={selectCls} value={form.status} onChange={e => set('status', e.target.value as any)}>
                  {['TBD','TEASER','CONFIRMED'].map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Icon">
                <select className={selectCls} value={form.iconKey} onChange={e => set('iconKey', e.target.value)}>
                  {Object.keys(ICON_MAP).map(k => <option key={k}>{k}</option>)}
                </select>
              </Field>
              <Field label="Date (display)">
                <input className={inputCls} placeholder="e.g. August 15, 2026" value={form.date || form.eventDate || ''} onChange={e => set('date', e.target.value)} />
              </Field>
              <Field label="Time">
                <input className={inputCls} placeholder="e.g. 6:00 PM – 10:00 PM" value={form.time || form.eventTime || ''} onChange={e => set('time', e.target.value)} />
              </Field>
              <div className="col-span-2">
                <Field label="Date (for sorting)">
                  <input className={inputCls} type="date" value={form.eventDateSort || ''} onChange={e => set('eventDateSort', e.target.value)} />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Used by "Sort by Date" in the events list. Doesn't change what visitors see — that's the display date above. Leave blank for TBD events; they'll sort last.
                  </p>
                </Field>
              </div>
              <Field label="Color (hex)">
                <div className="flex gap-2">
                  <input type="color" value={form.color || '#E91E63'} onChange={e => set('color', e.target.value)} className="h-9 w-12 border-2 border-gray-200 cursor-pointer bg-white p-0.5" />
                  <input className={inputCls} value={form.color || ''} onChange={e => set('color', e.target.value)} />
                </div>
              </Field>
              <Field label="Ticket Price">
                <input className={inputCls} placeholder="e.g. Free / $15 / $20–$35" value={form.ticketPrice || ''} onChange={e => set('ticketPrice', e.target.value)} />
              </Field>
              <div className="col-span-2">
                <Field label="Location / Venue Name">
                  <input className={inputCls} value={form.location || ''} onChange={e => set('location', e.target.value)} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Location Details (address, notes)">
                  <input className={inputCls} value={form.locationDetails || ''} onChange={e => set('locationDetails', e.target.value)} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Ticket Link (URL)">
                  <input className={inputCls} placeholder="https://…" value={form.ticketLink || ''} onChange={e => set('ticketLink', e.target.value)} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Public Description">
                  <textarea className={inputCls + ' h-24 resize-none'} value={form.description || ''} onChange={e => set('description', e.target.value)} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Teaser Text (shown when status = TEASER)">
                  <textarea className={inputCls + ' h-20 resize-none'} value={form.teaserText || ''} onChange={e => set('teaserText', e.target.value)} />
                </Field>
              </div>
              <Field label="Estimated Attendance">
                <input className={inputCls} type="number" value={form.estimatedAttendance || ''} onChange={e => set('estimatedAttendance', Number(e.target.value))} />
              </Field>
            </div>

            {/* Venue contact */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 border-t border-gray-100 pt-4">Venue Contact</p>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Name"><input className={inputCls} value={form.venueContactName || ''} onChange={e => set('venueContactName', e.target.value)} /></Field>
                <Field label="Email"><input className={inputCls} value={form.venueContactEmail || ''} onChange={e => set('venueContactEmail', e.target.value)} /></Field>
                <Field label="Phone"><input className={inputCls} value={form.venueContactPhone || ''} onChange={e => set('venueContactPhone', e.target.value)} /></Field>
                <div className="col-span-3">
                  <Field label="Venue Contract URL"><input className={inputCls} placeholder="https://…" value={form.venueContractUrl || ''} onChange={e => set('venueContractUrl', e.target.value)} /></Field>
                </div>
              </div>
            </div>

            {/* Insurance */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 border-t border-gray-100 pt-4">Insurance</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex items-center gap-3">
                  <input type="checkbox" id="insReq" checked={!!form.insuranceRequired} onChange={e => set('insuranceRequired', e.target.checked)} className="w-4 h-4 accent-pink-500" />
                  <label htmlFor="insReq" className="text-sm font-bold text-gray-700">Insurance Required</label>
                </div>
                <Field label="Carrier"><input className={inputCls} value={form.insuranceCarrier || ''} onChange={e => set('insuranceCarrier', e.target.value)} /></Field>
                <Field label="Policy #"><input className={inputCls} value={form.insurancePolicyNum || ''} onChange={e => set('insurancePolicyNum', e.target.value)} /></Field>
                <Field label="Expiry Date"><input className={inputCls} type="date" value={form.insuranceExpiry || ''} onChange={e => set('insuranceExpiry', e.target.value)} /></Field>
                <Field label="Coverage Amount ($)"><input className={inputCls} type="number" value={form.insuranceAmount || ''} onChange={e => set('insuranceAmount', e.target.value as any)} /></Field>
                <div className="col-span-2">
                  <Field label="Insurance Notes"><textarea className={inputCls + ' h-16 resize-none'} value={form.insuranceNotes || ''} onChange={e => set('insuranceNotes', e.target.value)} /></Field>
                </div>
              </div>
            </div>

            <button onClick={saveInfo} disabled={saving}
              className="w-full py-3 bg-pink-500 text-white rounded-xl font-bold text-sm hover:bg-pink-600 transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Event Info'}
            </button>
          </div>
        )}

        {/* ── IMAGES ── */}
        {tab === 'images' && (
          <div className="space-y-8">
            {[
              { key: 'heroImage' as const,   label: 'Hero Image',      hint: 'Replaces the icon header on the event card and modal. Use a wide landscape photo.' },
              { key: 'flyerImage' as const,  label: 'Event Flyer',     hint: 'Shown as a clickable thumbnail in the event detail modal. Opens fullscreen.' },
              { key: 'extraImage' as const,  label: 'Additional Image',hint: 'Optional — venue photo, map, or any other visual. Opens fullscreen.' },
            ].map(({ key, label, hint }) => (
              <div key={key} className="border border-gray-200 rounded-2xl p-5">
                <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">{label}</p>
                <p className="text-[11px] text-gray-400 mb-4">{hint}</p>

                {key === 'extraImage' && (
                  <div className="mb-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Image Label (e.g. "Venue", "Map")</label>
                    <input
                      className={inputCls}
                      placeholder="Venue Map"
                      value={form.extraImageLabel || ''}
                      onChange={e => set('extraImageLabel', e.target.value)}
                    />
                  </div>
                )}

                {form[key] ? (
                  <div className="relative group w-full">
                    <img src={form[key]} alt={label} className="w-full max-h-64 object-cover rounded-xl border border-gray-200" />
                    <button
                      onClick={() => set(key, '')}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-pink-400 hover:bg-pink-50/30 transition-colors">
                    <Camera size={28} className="text-gray-300 mb-2" />
                    <span className="text-xs font-bold text-gray-400">Click to upload image</span>
                    <span className="text-[10px] text-gray-300 mt-1">PNG, JPG, WebP</span>
                    <input type="file" accept="image/*" className="sr-only"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        compressImage(file, 1400, 0.82).then(data => set(key, data));
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            ))}

            <button onClick={saveInfo} disabled={saving}
              className="w-full py-3 bg-pink-500 text-white rounded-xl font-bold text-sm hover:bg-pink-600 transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Images'}
            </button>
          </div>
        )}

        {/* ── PERFORMERS ── */}
        {tab === 'performers' && (
          <PerformersPanel eventId={String(event.id)} performers={performers} onChange={setPerformers} />
        )}

        {/* ── BUDGET ── */}
        {tab === 'budget' && (
          <BudgetPanel eventId={String(event.id)} costs={costs} onChange={setCosts} totalEstimated={totalEstimated} totalActual={totalActual} />
        )}

        {/* ── MATERIALS ── */}
        {tab === 'materials' && (
          <MaterialsPanel eventId={String(event.id)} materials={materials} onChange={setMaterials} />
        )}

        {/* ── STAFFING ── */}
        {tab === 'staffing' && (
          <StaffingPanel eventId={String(event.id)} staff={staff} onChange={setStaff} />
        )}

        {tab === 'marketing' && (
          <MarketingPanel eventId={String(event.id)} />
        )}

      </div>
    </div>
  );
};

// ── Performers sub-panel ─────────────────────────────────────────────────────
const PerformersPanel = ({ eventId, performers, onChange }: {
  eventId: string; performers: Performer[]; onChange: (p: Performer[]) => void;
}) => {
  const blank = (): Omit<Performer,'id'> => ({ name:'', type:'Other', confirmed:false });
  const [draft, setDraft] = useState<Omit<Performer,'id'> | null>(null);

  const add = async () => {
    if (!draft?.name) return;
    const res = await api.post(`/api/events/${eventId}/performers`, draft);
    onChange([...performers, { ...draft, id: res.id }]);
    setDraft(null);
  };

  const toggle = async (p: Performer) => {
    const updated = { ...p, confirmed: !p.confirmed };
    await api.put(`/api/events/${eventId}/performers/${p.id}`, updated);
    onChange(performers.map(x => x.id === p.id ? updated : x));
  };

  const remove = async (id: number) => {
    await api.del(`/api/events/${eventId}/performers/${id}`);
    onChange(performers.filter(p => p.id !== id));
  };

  return (
    <div className="space-y-4">
      {performers.length === 0 && !draft && (
        <p className="text-gray-400 italic text-sm">No performers added yet.</p>
      )}
      {performers.map(p => (
        <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200">
          <input type="checkbox" checked={p.confirmed} onChange={() => toggle(p)} className="w-4 h-4 accent-pink-500 shrink-0" title="Confirmed" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-gray-900 truncate">{p.name}</p>
            <p className="text-xs text-gray-500">{p.type}{p.performanceTime ? ` · ${p.performanceTime}` : ''}{p.fee ? ` · $${p.fee}` : ''}</p>
          </div>
          {p.confirmed && <span className="text-[9px] font-black uppercase text-green-600 bg-green-100 px-2 py-0.5">Confirmed</span>}
          <button onClick={() => remove(p.id)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={14} /></button>
        </div>
      ))}

      {draft ? (
        <div className="border-2 border-dashed border-pink-300 p-4 space-y-3 bg-pink-50">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input autoFocus className={inputCls} value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} /></Field>
            <Field label="Type">
              <select className={selectCls} value={draft.type} onChange={e => setDraft({...draft, type: e.target.value})}>
                {['Musician','DJ','Drag','Dancer','Speaker','Emcee','Band','Other'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Performance Time"><input className={inputCls} placeholder="e.g. 7:00 PM" value={draft.performanceTime || ''} onChange={e => setDraft({...draft, performanceTime: e.target.value})} /></Field>
            <Field label="Fee ($)"><input className={inputCls} type="number" value={draft.fee || ''} onChange={e => setDraft({...draft, fee: Number(e.target.value)})} /></Field>
            <Field label="Contact Email"><input className={inputCls} value={draft.contactEmail || ''} onChange={e => setDraft({...draft, contactEmail: e.target.value})} /></Field>
            <Field label="Contact Phone"><input className={inputCls} value={draft.contactPhone || ''} onChange={e => setDraft({...draft, contactPhone: e.target.value})} /></Field>
            <div className="col-span-2"><Field label="Bio / Notes"><textarea className={inputCls + ' h-16 resize-none'} value={draft.bio || ''} onChange={e => setDraft({...draft, bio: e.target.value})} /></Field></div>
          </div>
          <div className="flex gap-3">
            <button onClick={add} className="px-5 py-2 bg-pink-500 text-white text-xs font-bold rounded-lg hover:bg-pink-600 transition-colors">Add Performer</button>
            <button onClick={() => setDraft(null)} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft(blank())} className="w-full py-2.5 border-2 border-dashed border-gray-300 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-pink-500 hover:border-pink-400 transition-colors">
          + Add Performer
        </button>
      )}
    </div>
  );
};

// ── Budget sub-panel ─────────────────────────────────────────────────────────
const COST_CATS = ['Venue','Performers','Marketing','Equipment','Staffing','Insurance','Permits','Food_Beverage','Printing','Audio_Visual','Other'];

const BudgetPanel = ({ eventId, costs, onChange, totalEstimated, totalActual }: {
  eventId: string; costs: EventCost[]; onChange: (c: EventCost[]) => void;
  totalEstimated: number; totalActual: number;
}) => {
  const blank = (): Omit<EventCost,'id'> => ({ category:'Other', description:'', approved:false, paid:false });
  const [draft, setDraft] = useState<Omit<EventCost,'id'> | null>(null);

  const add = async () => {
    if (!draft?.description) return;
    const res = await api.post(`/api/events/${eventId}/costs`, draft);
    onChange([...costs, { ...draft, id: res.id }]);
    setDraft(null);
  };

  const toggle = async (c: EventCost, field: 'approved' | 'paid') => {
    const updated = { ...c, [field]: !c[field] };
    await api.put(`/api/events/${eventId}/costs/${c.id}`, updated);
    onChange(costs.map(x => x.id === c.id ? updated : x));
  };

  const remove = async (id: number) => {
    await api.del(`/api/events/${eventId}/costs/${id}`);
    onChange(costs.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 border border-gray-200 p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Estimated Total</p>
          <p className="text-2xl font-black text-gray-900">${totalEstimated.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Actual Total</p>
          <p className={`text-2xl font-black ${totalActual > totalEstimated && totalEstimated > 0 ? 'text-red-600' : 'text-gray-900'}`}>${totalActual.toLocaleString()}</p>
        </div>
      </div>

      {/* Line items */}
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-900">
            {['Category','Description','Estimated','Actual','Vendor','OK','Paid',''].map(h => (
              <th key={h} className="text-left p-2 font-black uppercase tracking-widest text-[9px] text-gray-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {costs.map(c => (
            <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="p-2 font-medium text-gray-500">{c.category}</td>
              <td className="p-2 font-bold text-gray-900">{c.description}</td>
              <td className="p-2 text-right font-mono">{c.estimatedCost ? `$${Number(c.estimatedCost).toLocaleString()}` : '—'}</td>
              <td className="p-2 text-right font-mono">{c.actualCost ? `$${Number(c.actualCost).toLocaleString()}` : '—'}</td>
              <td className="p-2 text-gray-500">{c.vendor}</td>
              <td className="p-2 text-center"><input type="checkbox" checked={c.approved} onChange={() => toggle(c,'approved')} className="w-3.5 h-3.5 accent-green-500" /></td>
              <td className="p-2 text-center"><input type="checkbox" checked={c.paid}     onChange={() => toggle(c,'paid')}     className="w-3.5 h-3.5 accent-blue-500" /></td>
              <td className="p-2"><button onClick={() => remove(c.id)} className="text-gray-300 hover:text-red-500"><X size={12} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {draft ? (
        <div className="border-2 border-dashed border-pink-300 p-4 space-y-3 bg-pink-50">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select className={selectCls} value={draft.category} onChange={e => setDraft({...draft, category: e.target.value})}>
                {COST_CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Description"><input autoFocus className={inputCls} value={draft.description} onChange={e => setDraft({...draft, description: e.target.value})} /></Field>
            <Field label="Estimated Cost ($)"><input className={inputCls} type="number" value={draft.estimatedCost || ''} onChange={e => setDraft({...draft, estimatedCost: Number(e.target.value)})} /></Field>
            <Field label="Actual Cost ($)"><input className={inputCls} type="number" value={draft.actualCost || ''} onChange={e => setDraft({...draft, actualCost: Number(e.target.value)})} /></Field>
            <div className="col-span-2"><Field label="Vendor / Payee"><input className={inputCls} value={draft.vendor || ''} onChange={e => setDraft({...draft, vendor: e.target.value})} /></Field></div>
          </div>
          <div className="flex gap-3">
            <button onClick={add} className="px-5 py-2 bg-pink-500 text-white text-xs font-bold rounded-lg hover:bg-pink-600 transition-colors">Add Line Item</button>
            <button onClick={() => setDraft(null)} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft(blank())} className="w-full py-2.5 border-2 border-dashed border-gray-300 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-pink-500 hover:border-pink-400 transition-colors">
          + Add Line Item
        </button>
      )}
    </div>
  );
};

// ── Materials sub-panel ──────────────────────────────────────────────────────
const MaterialsPanel = ({ eventId, materials, onChange }: {
  eventId: string; materials: EventMaterial[]; onChange: (m: EventMaterial[]) => void;
}) => {
  const [draft, setDraft] = useState<Partial<EventMaterial> | null>(null);

  const add = async () => {
    if (!draft?.item) return;
    const payload = { item: draft.item, quantity: draft.quantity || 1, unit: draft.unit || '', source: draft.source || '', obtained: false };
    const res = await api.post(`/api/events/${eventId}/materials`, payload);
    onChange([...materials, { ...payload, id: res.id, obtained: false }]);
    setDraft(null);
  };

  const toggleObtained = async (m: EventMaterial) => {
    const updated = { ...m, obtained: !m.obtained };
    await api.put(`/api/events/${eventId}/materials/${m.id}`, updated);
    onChange(materials.map(x => x.id === m.id ? updated : x));
  };

  const remove = async (id: number) => {
    await api.del(`/api/events/${eventId}/materials/${id}`);
    onChange(materials.filter(m => m.id !== id));
  };

  const obtained = materials.filter(m => m.obtained).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-gray-500 font-bold">
        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
          <div className="bg-green-500 h-full transition-all" style={{ width: materials.length ? `${(obtained/materials.length)*100}%` : '0%' }} />
        </div>
        {obtained} / {materials.length} obtained
      </div>

      {materials.map(m => (
        <div key={m.id} className={`flex items-center gap-3 p-3 border transition-colors ${m.obtained ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <input type="checkbox" checked={m.obtained} onChange={() => toggleObtained(m)} className="w-4 h-4 accent-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm ${m.obtained ? 'line-through text-gray-400' : 'text-gray-900'}`}>{m.item}</p>
            <p className="text-xs text-gray-500">{m.quantity} {m.unit}{m.source ? ` · ${m.source}` : ''}</p>
          </div>
          <button onClick={() => remove(m.id)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0"><X size={14} /></button>
        </div>
      ))}

      {draft ? (
        <div className="border-2 border-dashed border-pink-300 p-4 space-y-3 bg-pink-50">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Field label="Item"><input autoFocus className={inputCls} value={draft.item || ''} onChange={e => setDraft({...draft, item: e.target.value})} /></Field></div>
            <Field label="Qty"><input className={inputCls} type="number" min="1" value={draft.quantity || 1} onChange={e => setDraft({...draft, quantity: Number(e.target.value)})} /></Field>
            <Field label="Unit (optional)"><input className={inputCls} placeholder="e.g. rolls, boxes" value={draft.unit || ''} onChange={e => setDraft({...draft, unit: e.target.value})} /></Field>
            <div className="col-span-2"><Field label="Source / Vendor"><input className={inputCls} value={draft.source || ''} onChange={e => setDraft({...draft, source: e.target.value})} /></Field></div>
          </div>
          <div className="flex gap-3">
            <button onClick={add} className="px-5 py-2 bg-pink-500 text-white text-xs font-bold rounded-lg hover:bg-pink-600 transition-colors">Add Item</button>
            <button onClick={() => setDraft(null)} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({})} className="w-full py-2.5 border-2 border-dashed border-gray-300 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-pink-500 hover:border-pink-400 transition-colors">
          + Add Item
        </button>
      )}
    </div>
  );
};

// ── Staffing sub-panel ───────────────────────────────────────────────────────
const StaffingPanel = ({ eventId, staff, onChange }: {
  eventId: string; staff: StaffRole[]; onChange: (s: StaffRole[]) => void;
}) => {
  const [draft, setDraft] = useState<Partial<StaffRole> | null>(null);

  const add = async () => {
    if (!draft?.roleName) return;
    const payload = { roleName: draft.roleName, description: draft.description || '', slotsNeeded: draft.slotsNeeded || 1, slotsFilled: 0, isPaid: draft.isPaid || false, payRate: draft.payRate || '', shiftTime: draft.shiftTime || '' };
    const res = await api.post(`/api/events/${eventId}/staff`, payload);
    onChange([...staff, { ...payload, id: res.id, slotsFilled: 0 }]);
    setDraft(null);
  };

  const updateFilled = async (s: StaffRole, delta: number) => {
    const updated = { ...s, slotsFilled: Math.max(0, Math.min(s.slotsNeeded, s.slotsFilled + delta)) };
    await api.put(`/api/events/${eventId}/staff/${s.id}`, updated);
    onChange(staff.map(x => x.id === s.id ? updated : x));
  };

  const remove = async (id: number) => {
    await api.del(`/api/events/${eventId}/staff/${id}`);
    onChange(staff.filter(s => s.id !== id));
  };

  const totalNeeded = staff.reduce((s, r) => s + (r.slotsNeeded || 0), 0);
  const totalFilled = staff.reduce((s, r) => s + (r.slotsFilled || 0), 0);

  return (
    <div className="space-y-4">
      {staff.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-gray-500 font-bold">
          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-500 h-full transition-all" style={{ width: totalNeeded ? `${(totalFilled/totalNeeded)*100}%` : '0%' }} />
          </div>
          {totalFilled} / {totalNeeded} positions filled
        </div>
      )}

      {staff.map(s => (
        <div key={s.id} className="p-4 bg-gray-50 border border-gray-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="font-bold text-sm text-gray-900">{s.roleName}</p>
              {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
              {s.shiftTime && <p className="text-xs text-gray-400 mt-0.5">⏱ {s.shiftTime}</p>}
              {s.isPaid && <p className="text-xs text-blue-600 mt-0.5 font-bold">Paid{s.payRate ? `: ${s.payRate}` : ''}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => updateFilled(s, -1)} className="w-7 h-7 border border-gray-300 text-gray-600 hover:border-gray-900 font-bold text-base flex items-center justify-center">−</button>
              <span className="font-black text-sm w-12 text-center">{s.slotsFilled}/{s.slotsNeeded}</span>
              <button onClick={() => updateFilled(s, +1)} className="w-7 h-7 border border-gray-300 text-gray-600 hover:border-gray-900 font-bold text-base flex items-center justify-center">+</button>
              <button onClick={() => remove(s.id)} className="text-gray-300 hover:text-red-500 transition-colors ml-1"><X size={14} /></button>
            </div>
          </div>
        </div>
      ))}

      {draft ? (
        <div className="border-2 border-dashed border-pink-300 p-4 space-y-3 bg-pink-50">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role Name"><input autoFocus className={inputCls} value={draft.roleName || ''} onChange={e => setDraft({...draft, roleName: e.target.value})} /></Field>
            <Field label="Slots Needed"><input className={inputCls} type="number" min="1" value={draft.slotsNeeded || 1} onChange={e => setDraft({...draft, slotsNeeded: Number(e.target.value)})} /></Field>
            <div className="col-span-2"><Field label="Description"><input className={inputCls} value={draft.description || ''} onChange={e => setDraft({...draft, description: e.target.value})} /></Field></div>
            <Field label="Shift Time"><input className={inputCls} placeholder="e.g. 4:00 PM – 8:00 PM" value={draft.shiftTime || ''} onChange={e => setDraft({...draft, shiftTime: e.target.value})} /></Field>
            <Field label="Pay Rate (if paid)"><input className={inputCls} placeholder="e.g. $15/hr or volunteer" value={draft.payRate || ''} onChange={e => setDraft({...draft, payRate: e.target.value, isPaid: !!e.target.value})} /></Field>
          </div>
          <div className="flex gap-3">
            <button onClick={add} className="px-5 py-2 bg-pink-500 text-white text-xs font-bold rounded-lg hover:bg-pink-600 transition-colors">Add Role</button>
            <button onClick={() => setDraft(null)} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({})} className="w-full py-2.5 border-2 border-dashed border-gray-300 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-pink-500 hover:border-pink-400 transition-colors">
          + Add Role
        </button>
      )}
    </div>
  );
};

// ── Marketing sub-panel ──────────────────────────────────────────────────────
interface MarketingItem {
  id: number;
  materialType: string;
  title: string;
  description?: string;
  fileUrl?: string;
  channel?: string;
  publishDate?: string;
  status: 'draft' | 'approved' | 'published';
  notes?: string;
}

const MKT_TYPES = ['Flyer','Poster','Social_Post','Press_Release','Banner','Ad','Email','Other'];
const MKT_STATUS_COLORS: Record<string,string> = {
  draft:     'bg-gray-100 text-gray-500',
  approved:  'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
};

const MarketingPanel = ({ eventId }: { eventId: string }) => {
  const [items, setItems]   = useState<MarketingItem[]>([]);
  const [draft, setDraft]   = useState<Partial<MarketingItem> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/events/${eventId}/marketing`)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId]);

  const add = async () => {
    if (!draft?.title) return;
    const payload = {
      materialType: draft.materialType || 'Other',
      title: draft.title,
      description: draft.description || '',
      channel: draft.channel || '',
      publishDate: draft.publishDate || null,
      fileUrl: draft.fileUrl || null,
      status: 'draft' as const,
      notes: draft.notes || '',
    };
    const res = await api.post(`/api/events/${eventId}/marketing`, payload);
    setItems([...items, { ...payload, id: res.id }]);
    setDraft(null);
  };

  const cycleStatus = async (item: MarketingItem) => {
    const cycle: MarketingItem['status'][] = ['draft','approved','published'];
    const next = cycle[(cycle.indexOf(item.status) + 1) % cycle.length];
    const updated = { ...item, status: next };
    await api.put(`/api/events/${eventId}/marketing/${item.id}`, updated);
    setItems(items.map(x => x.id === item.id ? updated : x));
  };

  const remove = async (id: number) => {
    await api.del(`/api/events/${eventId}/marketing/${id}`);
    setItems(items.filter(i => i.id !== id));
  };

  if (loading) return <p className="text-gray-400 text-sm italic">Loading…</p>;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-2">
          {(['draft','approved','published'] as const).map(s => (
            <div key={s} className={`p-3 text-center border ${MKT_STATUS_COLORS[s]}`}>
              <p className="text-2xl font-black">{items.filter(i => i.status === s).length}</p>
              <p className="text-[9px] font-black uppercase tracking-widest mt-0.5">{s}</p>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && !draft && (
        <p className="text-gray-400 italic text-sm">No marketing materials yet.</p>
      )}

      {/* Item list */}
      {items.map(item => (
        <div key={item.id} className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-black uppercase tracking-widest bg-gray-200 text-gray-600 px-2 py-0.5">{item.materialType}</span>
              <p className="font-bold text-sm text-gray-900">{item.title}</p>
            </div>
            {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
            <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
              {item.channel     && <span>📢 {item.channel}</span>}
              {item.publishDate && <span>📅 {item.publishDate}</span>}
              {item.fileUrl     && <a href={item.fileUrl} target="_blank" rel="noreferrer" className="text-pink-500 hover:underline">🔗 File</a>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => cycleStatus(item)}
              className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 cursor-pointer hover:opacity-80 transition-opacity ${MKT_STATUS_COLORS[item.status]}`}>
              {item.status}
            </button>
            <button onClick={() => remove(item.id)} className="text-gray-300 hover:text-red-500 transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>
      ))}

      {/* Add form */}
      {draft ? (
        <div className="border-2 border-dashed border-pink-300 p-4 space-y-3 bg-pink-50">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className={selectCls} value={draft.materialType || 'Other'} onChange={e => setDraft({...draft, materialType: e.target.value})}>
                {MKT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Title">
              <input autoFocus className={inputCls} value={draft.title || ''} onChange={e => setDraft({...draft, title: e.target.value})} />
            </Field>
            <Field label="Channel / Platform">
              <input className={inputCls} placeholder="e.g. Instagram, Print, Press" value={draft.channel || ''} onChange={e => setDraft({...draft, channel: e.target.value})} />
            </Field>
            <Field label="Publish / Drop Date">
              <input className={inputCls} type="date" value={draft.publishDate || ''} onChange={e => setDraft({...draft, publishDate: e.target.value})} />
            </Field>
            <div className="col-span-2">
              <Field label="Description">
                <textarea className={inputCls + ' h-16 resize-none'} value={draft.description || ''} onChange={e => setDraft({...draft, description: e.target.value})} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="File URL (Google Drive, Dropbox, etc.)">
                <input className={inputCls} placeholder="https://…" value={draft.fileUrl || ''} onChange={e => setDraft({...draft, fileUrl: e.target.value})} />
              </Field>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={add} className="px-5 py-2 bg-pink-500 text-white text-xs font-bold rounded-lg hover:bg-pink-600 transition-colors">
              Add Material
            </button>
            <button onClick={() => setDraft(null)} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({ materialType: 'Flyer' })}
          className="w-full py-2.5 border-2 border-dashed border-gray-300 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-pink-500 hover:border-pink-400 transition-colors">
          + Add Marketing Material
        </button>
      )}
    </div>
  );
};

// ── EventsTab (list + editor layout) ────────────────────────────────────────
export const EventsTab = ({ events, onRefresh }: { events: EventData[]; onRefresh: () => void }) => {
  const [selectedId, setSelectedId] = useState<string | null>(events[0] ? String(events[0].id) : null);
  const [reordering, setReordering] = useState(false);

  const selected = events.find(e => String(e.id) === selectedId) ?? null;

  const createEvent = async () => {
    const ev = await api.post('/api/events', { title: 'New Event', status: 'TBD', iconKey: 'Heart', color: '#E91E63' });
    await onRefresh();
    setSelectedId(String(ev.id));
  };

  const deleteEvent = async () => {
    if (!selectedId || !window.confirm('Delete this event?')) return;
    await api.del(`/api/events/${selectedId}`);
    setSelectedId(null);
    onRefresh();
  };

  // Persists a full reordering — used by both the up/down nudge buttons and
  // "Sort by Date". The server just assigns sort_order = array index for
  // each id, so both actions share the one bulk endpoint.
  const persistOrder = async (ordered: EventData[]) => {
    setReordering(true);
    try {
      await api.post('/api/events/reorder', { ids: ordered.map(e => e.id) });
      await onRefresh();
    } finally {
      setReordering(false);
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= events.length || reordering) return;
    const next = [...events];
    [next[index], next[target]] = [next[target], next[index]];
    persistOrder(next);
  };

  // Events without a sort date sort last (in whatever order they were
  // already in relative to each other), so setting a date is what "claims"
  // an event's place in the chronological order — nothing jumps around
  // unexpectedly for events still marked TBD.
  const sortByDate = () => {
    const next = [...events].sort((a, b) => {
      if (!a.eventDateSort && !b.eventDateSort) return 0;
      if (!a.eventDateSort) return 1;
      if (!b.eventDateSort) return -1;
      return a.eventDateSort.localeCompare(b.eventDateSort);
    });
    persistOrder(next);
  };

  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* Left: event list */}
      <div className="w-64 shrink-0 space-y-2">
        <button onClick={createEvent}
          className="w-full py-2.5 bg-pink-500 text-white rounded-xl text-xs font-bold hover:bg-pink-600 transition-colors">
          + New Event
        </button>
        <button onClick={sortByDate} disabled={reordering || events.length < 2}
          title="Reorder all events chronologically by their sort date"
          className="w-full py-2 bg-white border-2 border-gray-200 text-gray-600 rounded-xl text-[11px] font-bold hover:border-gray-300 hover:text-gray-900 transition-colors mb-2 flex items-center justify-center gap-1.5 disabled:opacity-40">
          <ArrowDownWideNarrow size={13} /> Sort by Date
        </button>
        {events.map((ev, i) => (
          <div key={ev.id} className="flex items-stretch gap-1">
            <button onClick={() => setSelectedId(String(ev.id))}
              className={`flex-1 min-w-0 text-left p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                String(ev.id) === selectedId
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'
              }`}>
              <div className="w-3 h-3 rounded-full shrink-0 border border-white/30" style={{ backgroundColor: ev.color }} />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs truncate">{ev.title}</p>
                <p className={`text-[9px] uppercase font-black tracking-widest mt-0.5 ${String(ev.id) === selectedId ? 'text-gray-300' : 'text-gray-400'}`}>{ev.status}</p>
              </div>
            </button>
            <div className="flex flex-col shrink-0">
              <button onClick={() => move(i, -1)} disabled={i === 0 || reordering}
                title="Move up" aria-label="Move event up"
                className="flex-1 w-6 flex items-center justify-center rounded-t-lg border-2 border-b-0 border-gray-200 text-gray-400 hover:text-gray-900 hover:border-gray-300 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors">
                <ChevronUp size={13} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === events.length - 1 || reordering}
                title="Move down" aria-label="Move event down"
                className="flex-1 w-6 flex items-center justify-center rounded-b-lg border-2 border-gray-200 text-gray-400 hover:text-gray-900 hover:border-gray-300 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors">
                <ChevronDown size={13} />
              </button>
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="text-xs text-gray-400 italic">No events yet.</p>}
      </div>

      {/* Right: editor */}
      {selected ? (
        <EventEditor key={selected.id} event={selected} onSave={onRefresh} onDelete={deleteEvent} />
      ) : (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 text-gray-400 text-sm italic">
          Select an event to edit
        </div>
      )}
    </div>
  );
};

// ── Batch 4: AgendaManager ────────────────────────────────────────────────────
const AgendaManager = ({ meeting, onMeetingUpdate }: { meeting: Meeting; onMeetingUpdate: () => void; key?: React.Key }) => {
  const isNew = meeting.location === 'TBD';
  const [items, setItems]         = useState<AgendaItem[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [draft, setDraft]         = useState<Partial<AgendaItem> | null>(null);
  const [decDraft, setDecDraft]   = useState<string>('');
  const [loading, setLoading]     = useState(true);
  const [editingDetails, setEditingDetails] = useState(isNew);
  const [detailForm, setDetailForm] = useState({
    date: meeting.date ?? '',
    time: meeting.time ?? '',
    location: meeting.location ?? '',
    whoIsInvited: meeting.whoIsInvited ?? '',
    notes: meeting.notes ?? '',
    isPast: meeting.isPast ?? false,
  });
  const [savingDetails, setSavingDetails] = useState(false);
  // Suggestion box — grouped separately from the agenda itself, only
  // relevant for a meeting that hasn't happened yet.
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [promotingId, setPromotingId] = useState<number | null>(null);

  const loadAgenda = () => {
    setLoading(true);
    Promise.all([
      api.get(`/api/meetings/${meeting.id}/agenda`),
      api.get(`/api/meetings/${meeting.id}/decisions`),
    ]).then(([ag, dec]) => {
      setItems(ag);
      setDecisions(dec);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAgenda();
    if (!meeting.isPast) {
      api.get('/api/suggestions?status=new').then(setSuggestions).catch(() => {});
    }
  }, [meeting.id]);

  const promoteSuggestion = async (s: Suggestion) => {
    setPromotingId(s.id);
    try {
      await api.post(`/api/suggestions/${s.id}/promote`, { meetingId: meeting.id });
      setSuggestions(cur => cur.filter(x => x.id !== s.id));
      loadAgenda();
    } catch {
      alert('Could not add to agenda — please try again.');
    } finally {
      setPromotingId(null);
    }
  };

  const dismissSuggestion = async (s: Suggestion) => {
    if (!confirm('Dismiss this suggestion without adding it to the agenda?')) return;
    try {
      await api.put(`/api/suggestions/${s.id}`, { status: 'archived', reviewedMeetingId: meeting.id });
      setSuggestions(cur => cur.filter(x => x.id !== s.id));
    } catch {
      alert('Could not dismiss — please try again.');
    }
  };

  const addItem = async () => {
    if (!draft?.title) return;
    const payload = { title: draft.title, description: draft.description || '', presenter: draft.presenter || '', timeAllocated: draft.timeAllocated || null, itemOrder: items.length, status: 'pending' as const };
    const res = await api.post(`/api/meetings/${meeting.id}/agenda`, payload);
    setItems([...items, { ...payload, id: res.id }]);
    setDraft(null);
  };

  const cycleStatus = async (item: AgendaItem) => {
    const cycle: AgendaItem['status'][] = ['pending','discussed','decided','tabled'];
    const next = cycle[(cycle.indexOf(item.status) + 1) % cycle.length];
    const updated = { ...item, status: next };
    await api.put(`/api/meetings/${meeting.id}/agenda/${item.id}`, updated);
    setItems(items.map(x => x.id === item.id ? updated : x));
  };

  const updateOutcome = async (item: AgendaItem, outcome: string) => {
    const updated = { ...item, outcome };
    await api.put(`/api/meetings/${meeting.id}/agenda/${item.id}`, updated);
    setItems(items.map(x => x.id === item.id ? updated : x));
  };

  const removeItem = async (id: number) => {
    await api.del(`/api/meetings/${meeting.id}/agenda/${id}`);
    setItems(items.filter(i => i.id !== id));
  };

  const saveDetails = async () => {
    setSavingDetails(true);
    try {
      await api.put(`/api/meetings/${meeting.id}`, detailForm);
      await onMeetingUpdate();
      setEditingDetails(false);
    } catch {
      alert('Save failed.');
    }
    setSavingDetails(false);
  };

  const addDecision = async () => {
    if (!decDraft.trim()) return;
    const payload = { decision: decDraft, implementationStatus: 'pending' as const };
    const res = await api.post(`/api/meetings/${meeting.id}/decisions`, payload);
    setDecisions([...decisions, { ...payload, id: res.id }]);
    setDecDraft('');
  };

  const statusColors: Record<AgendaItem['status'], string> = {
    pending:   'bg-gray-100 text-gray-500',
    discussed: 'bg-blue-100 text-blue-700',
    decided:   'bg-green-100 text-green-700',
    tabled:    'bg-yellow-100 text-yellow-700',
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="flex-1 space-y-6">
      {/* Meeting details — view or edit */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        {editingDetails ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Meeting Details</p>
              {!isNew && (
                <button onClick={() => setEditingDetails(false)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Date</label>
                <input type="date" value={detailForm.date} onChange={e => setDetailForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Time</label>
                <input value={detailForm.time} onChange={e => setDetailForm(f => ({ ...f, time: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500"
                  placeholder="6:30 PM" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Location</label>
                <input value={detailForm.location} onChange={e => setDetailForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500"
                  placeholder="Taos Community Center, Room B" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Who's Invited</label>
                <input value={detailForm.whoIsInvited} onChange={e => setDetailForm(f => ({ ...f, whoIsInvited: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500"
                  placeholder="All committee members" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Notes</label>
                <textarea value={detailForm.notes} onChange={e => setDetailForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500 resize-none"
                  placeholder="Internal notes…" />
              </div>
              <div className="col-span-2 flex items-center justify-between">
                <button type="button" onClick={() => setDetailForm(f => ({ ...f, isPast: !f.isPast }))}
                  className="flex items-center gap-2.5">
                  <div className={`w-9 h-5 rounded-full transition-colors ${detailForm.isPast ? 'bg-gray-400' : 'bg-green-500'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow mt-0.5 transition-transform ${detailForm.isPast ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className={`text-xs font-bold ${detailForm.isPast ? 'text-gray-400' : 'text-green-600'}`}>
                    {detailForm.isPast ? 'Past session' : 'Upcoming session'}
                  </span>
                </button>
                <button onClick={saveDetails} disabled={savingDetails}
                  className="px-5 py-2 bg-pink-500 text-white rounded-lg text-xs font-bold hover:bg-pink-600 transition-colors disabled:opacity-50">
                  {savingDetails ? 'Saving…' : 'Save Details'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Meeting Details</p>
              <p className="text-lg font-black text-gray-900">{meeting.date} · {meeting.time}</p>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <MapPin size={12} className="shrink-0" />{meeting.location}
              </p>
              {meeting.whoIsInvited && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Users size={11} className="shrink-0" />{meeting.whoIsInvited}
                </p>
              )}
            </div>
            <button onClick={() => setEditingDetails(true)}
              className="text-xs font-bold text-gray-400 hover:text-pink-500 transition-colors px-3 py-1.5 border border-gray-200 rounded-lg hover:border-pink-300">
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Agenda items */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Agenda</h3>

        {items.length === 0 && !draft && (
          <p className="text-gray-400 italic text-sm mb-4">No agenda items yet.</p>
        )}

        <div className="space-y-3 mb-4">
          {items.map((item, idx) => (
            <div key={item.id} className={`border-l-4 pl-4 py-2 ${
              item.status === 'decided' ? 'border-green-500' :
              item.status === 'discussed' ? 'border-blue-400' :
              item.status === 'tabled' ? 'border-yellow-400' : 'border-gray-200'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-[10px] font-black text-gray-300 mt-1 w-5 shrink-0">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm text-gray-900">{item.title}</p>
                    {item.presenter && <span className="text-xs text-gray-400">— {item.presenter}</span>}
                    {item.timeAllocated && <span className="text-[9px] text-gray-400 font-bold">{item.timeAllocated}min</span>}
                  </div>
                  {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                  {(item.status === 'discussed' || item.status === 'decided') && (
                    <textarea
                      className="mt-2 w-full text-xs bg-gray-50 border border-gray-200 focus:border-pink-500 px-2 py-1.5 outline-none resize-none h-12"
                      placeholder="Outcome / notes…"
                      value={item.outcome || ''}
                      onChange={e => updateOutcome(item, e.target.value)}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => cycleStatus(item)}
                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded cursor-pointer hover:opacity-80 ${statusColors[item.status]}`}>
                    {item.status}
                  </button>
                  <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {draft ? (
          <div className="border-2 border-dashed border-pink-300 p-4 space-y-3 bg-pink-50">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Field label="Agenda Item Title"><input autoFocus className={inputCls} value={draft.title || ''} onChange={e => setDraft({...draft, title: e.target.value})} /></Field></div>
              <Field label="Presenter"><input className={inputCls} value={draft.presenter || ''} onChange={e => setDraft({...draft, presenter: e.target.value})} /></Field>
              <Field label="Time (min)"><input className={inputCls} type="number" min="1" value={draft.timeAllocated || ''} onChange={e => setDraft({...draft, timeAllocated: Number(e.target.value)})} /></Field>
              <div className="col-span-2"><Field label="Description"><textarea className={inputCls + ' h-16 resize-none'} value={draft.description || ''} onChange={e => setDraft({...draft, description: e.target.value})} /></Field></div>
            </div>
            <div className="flex gap-3">
              <button onClick={addItem} className="px-5 py-2 bg-pink-500 text-white text-xs font-bold rounded-lg hover:bg-pink-600 transition-colors">Add Item</button>
              <button onClick={() => setDraft(null)} className="px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setDraft({})} className="w-full py-2.5 border-2 border-dashed border-gray-300 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-pink-500 hover:border-pink-400 transition-colors">
            + Add Agenda Item
          </button>
        )}
      </div>

      {/* Suggestion box — grouped together, not individual agenda items,
          until the board decides one is worth promoting into a real item. */}
      {!meeting.isPast && suggestions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-1">Suggestions to Review</h3>
          <p className="text-xs text-gray-400 mb-4">Submitted through the public suggestion box — not yet on the agenda.</p>
          <div className="space-y-3">
            {suggestions.map(s => (
              <div key={s.id} className="border border-pink-100 bg-pink-50/50 rounded-xl p-4">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{s.message}</p>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-[11px] text-gray-400">
                    {s.submitterName || 'Anonymous'}
                    {s.submitterEmail && ` · ${s.submitterEmail}`}
                    {' · '}{new Date(s.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => dismissSuggestion(s)}
                      className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => promoteSuggestion(s)}
                      disabled={promotingId === s.id}
                      className="text-xs font-bold text-pink-600 hover:text-pink-700 transition-colors disabled:opacity-50"
                    >
                      {promotingId === s.id ? 'Adding…' : '+ Add to Agenda'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decisions log */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Decisions Made</h3>
        <div className="space-y-2 mb-4">
          {decisions.map(d => (
            <div key={d.id} className="flex items-start gap-3 p-3 bg-green-50 border border-green-200">
              <CheckCircle2 size={14} className="text-green-600 mt-0.5 shrink-0" />
              <p className="text-sm text-gray-900 flex-1">{d.decision}</p>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 shrink-0 ${
                d.implementationStatus === 'complete' ? 'bg-green-200 text-green-700' :
                d.implementationStatus === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}>{d.implementationStatus?.replace('_',' ')}</span>
            </div>
          ))}
          {decisions.length === 0 && <p className="text-gray-400 italic text-sm">No decisions logged yet.</p>}
        </div>
        <div className="flex gap-3">
          <input className={inputCls + ' flex-1'} placeholder="Log a decision from this meeting…" value={decDraft} onChange={e => setDecDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDecision()} />
          <button onClick={addDecision} className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-pink-500 transition-colors">Log</button>
        </div>
      </div>
    </div>
  );
};

// ── MeetingsTab (list + agenda manager) ──────────────────────────────────────
export const MeetingsTab = ({ meetings, onRefresh }: { meetings: Meeting[]; onRefresh: () => void }) => {
  const [selectedId, setSelectedId] = useState<string | null>(
    meetings.find(m => !m.isPast)?.id ?? meetings[0]?.id ?? null
  );
  // Independent of site phase on purpose — see the showMeetings comment in
  // App(). Self-contained here rather than threaded through props/fetchData
  // since it's a simple standalone setting.
  const [showMeetings, setShowMeetings] = useState(true);
  const [savingVisibility, setSavingVisibility] = useState(false);

  useEffect(() => {
    api.get('/api/settings').then(s => setShowMeetings(s?.show_meetings_section !== '0')).catch(() => {});
  }, []);

  const toggleShowMeetings = async () => {
    const next = !showMeetings;
    setShowMeetings(next);
    setSavingVisibility(true);
    try {
      await api.post('/api/settings', { show_meetings_section: next ? '1' : '0' });
    } catch {
      setShowMeetings(!next);
      alert('Could not save — please try again.');
    } finally {
      setSavingVisibility(false);
    }
  };

  const selected = meetings.find(m => String(m.id) === String(selectedId)) ?? null;

  const createMeeting = async () => {
    const m = await api.post('/api/meetings', { date: '', time: '6:30 PM', location: 'TBD', whoIsInvited: 'All committee members', isPast: false });
    await onRefresh();
    setSelectedId(String(m.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-5 py-4">
        <div>
          <p className="text-sm font-bold text-gray-800">Show Meetings section on public site</p>
          <p className="text-xs text-gray-400">
            Independent of site phase — leave this on any time you want meeting times public, even after going live.
          </p>
        </div>
        <button
          onClick={toggleShowMeetings}
          disabled={savingVisibility}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${showMeetings ? 'bg-pink-500' : 'bg-gray-200'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${showMeetings ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <div className="flex gap-6 min-h-[600px]">
      {/* Left: meeting list */}
      <div className="w-64 shrink-0 space-y-2">
        <button onClick={createMeeting}
          className="w-full py-2.5 bg-pink-500 text-white rounded-xl text-xs font-bold hover:bg-pink-600 transition-colors mb-4">
          + Schedule Meeting
        </button>
        {meetings.map(m => (
          <button key={m.id} onClick={() => setSelectedId(String(m.id))}
            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
              String(m.id) === String(selectedId)
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'
            }`}>
            <p className="font-black text-xs">{m.date}</p>
            <p className={`text-[9px] mt-0.5 font-bold ${String(m.id) === String(selectedId) ? 'text-gray-300' : 'text-gray-400'}`}>
              {m.time} · {m.isPast ? 'Past' : 'Upcoming'}
            </p>
          </button>
        ))}
        {meetings.length === 0 && <p className="text-xs text-gray-400 italic">No meetings yet.</p>}
      </div>

      {/* Right: agenda manager */}
      {selected ? (
        <AgendaManager key={selected.id} meeting={selected} onMeetingUpdate={onRefresh} />
      ) : (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 text-gray-400 text-sm italic">
          Select a meeting to manage its agenda
        </div>
      )}
      </div>
    </div>
  );
};

// ── Batch 5: ApplicationsViewer ───────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  new:        'bg-yellow-100 text-yellow-800',
  reviewed:   'bg-blue-100 text-blue-700',
  accepted:   'bg-green-100 text-green-700',
  declined:   'bg-red-100 text-red-600',
  waitlisted: 'bg-purple-100 text-purple-700',
};

export const ApplicationsViewer = () => {
  const [apps, setApps]       = useState<Application[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const qs = typeFilter !== 'all' ? `?type=${typeFilter}` : '';
    api.get(`/api/applications${qs}`).then(data => setApps(data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [typeFilter]);

  const updateStatus = async (app: Application, status: Application['status']) => {
    await api.put(`/api/applications/${app.id}`, { ...app, status });
    setApps(apps.map(a => a.id === app.id ? { ...a, status } : a));
  };

  const filterBtns = ['all','volunteer','vendor','performer','parade','sponsor'] as const;

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {filterBtns.map(f => (
          <button key={f} onClick={() => setTypeFilter(f)}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
              typeFilter === f ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-500 hover:border-gray-900'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm italic">Loading…</p>
      ) : apps.length === 0 ? (
        <p className="text-gray-400 text-sm italic">No applications found.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-gray-900 bg-gray-50">
                {['Type','Name','Email','Submitted','Status','Actions'].map(h => (
                  <th key={h} className="text-left p-3 font-black uppercase tracking-widest text-[9px] text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apps.map(app => (
                <React.Fragment key={app.id}>
                  <tr className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${expanded === app.id ? 'bg-pink-50' : ''}`}
                    onClick={() => setExpanded(expanded === app.id ? null : app.id)}>
                    <td className="p-3">
                      <span className="font-black uppercase text-[9px] px-2 py-0.5 bg-gray-100 text-gray-600 tracking-widest">{app.type}</span>
                    </td>
                    <td className="p-3 font-bold text-gray-900">{app.name}</td>
                    <td className="p-3 text-gray-500">{app.email}</td>
                    <td className="p-3 text-gray-400">{new Date(app.submittedAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 tracking-widest ${STATUS_COLORS[app.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {(['reviewed','accepted','declined','waitlisted'] as Application['status'][]).map(s => (
                          app.status !== s && (
                            <button key={s} onClick={e => { e.stopPropagation(); updateStatus(app, s); }}
                              className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 border border-gray-200 text-gray-400 hover:border-gray-900 hover:text-gray-900 transition-colors">
                              {s}
                            </button>
                          )
                        ))}
                      </div>
                    </td>
                  </tr>
                  {expanded === app.id && (
                    <tr className="border-b border-pink-100">
                      <td colSpan={6} className="p-4 bg-pink-50">
                        {app.notes && <p className="text-sm text-gray-700 mb-2"><span className="font-black text-gray-400 uppercase text-[9px] tracking-widest">Notes: </span>{app.notes}</p>}
                        {app.phone && <p className="text-xs text-gray-500"><span className="font-bold">Phone: </span>{app.phone}</p>}
                        {app.organization && <p className="text-xs text-gray-500"><span className="font-bold">Org: </span>{app.organization}</p>}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Lightbox ─────────────────────────────────────────────────────────────────
const Lightbox = ({ src, label, onClose }: { src: string; label?: string; onClose: () => void }) => {
  useEscapeKey(onClose);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.92 }}
        className="relative max-w-5xl w-full flex flex-col items-center"
        onClick={e => e.stopPropagation()}
      >
        <img src={src} alt={label ?? 'Event image'} className="max-h-[85vh] w-auto max-w-full rounded-2xl shadow-2xl object-contain" />
        {label && <p className="mt-4 text-white/60 text-sm font-bold uppercase tracking-widest">{label}</p>}
        <button onClick={onClose}
          className="absolute -top-4 -right-4 w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors">
          <X size={18} />
        </button>
      </motion.div>
    </motion.div>
  );
};

// ── Batch 5: EventDetailModal (public) ───────────────────────────────────────
const EventDetailModal = ({ event, onClose }: { event: EventData; onClose: () => void }) => {
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [lightbox, setLightbox] = useState<{ src: string; label?: string } | null>(null);

  useEffect(() => {
    api.get(`/api/events/${event.id}/performers`).then(setPerformers).catch(() => {});
  }, [event.id]);

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8 bg-gray-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Hero image or color banner */}
        <div className="relative h-52 flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: event.color }}>
          {event.heroImage ? (
            <img src={event.heroImage} alt={event.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <>
              <div className="absolute inset-0 opacity-10 blur-xl">{ICON_MAP[event.iconKey]}</div>
              <div className="z-10 text-white transform scale-[2.5] opacity-90">{ICON_MAP[event.iconKey]}</div>
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-colors z-10">
            <X size={18} />
          </button>
          {event.status !== 'CONFIRMED' && (
            <span className="absolute bottom-4 left-4 text-[10px] font-black uppercase tracking-widest bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white border border-white/20 z-10">
              {event.status === 'TEASER' ? 'Coming Soon' : 'In Planning'}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto flex-1">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">{event.title}</h2>

          <div className="flex flex-wrap gap-4 mb-6 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar size={15} className="text-pink-500" />
              {event.date || event.eventDate || 'Date TBD'}
            </div>
            {(event.time || event.eventTime) && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock size={15} className="text-pink-500" />
                {event.time || event.eventTime}
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={15} className="text-pink-500" />
                {event.location}
                {event.locationDetails && <span className="text-gray-400">· {event.locationDetails}</span>}
              </div>
            )}
            {event.ticketPrice && (
              <div className="flex items-center gap-2 font-bold text-gray-700">
                🎟 {event.ticketPrice}
              </div>
            )}
          </div>

          {event.description && (
            <p className="text-gray-600 leading-relaxed mb-6">{event.description}</p>
          )}
          {event.status === 'TEASER' && event.teaserText && (
            <div className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100">
              <p className="text-gray-600 italic leading-relaxed">"{event.teaserText}"</p>
            </div>
          )}
          {event.status === 'TBD' && (
            <div className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100">
              <p className="text-gray-500 italic text-sm">Details for this event are still being decided at our planning meetings. Check back soon!</p>
            </div>
          )}

          {/* Flyer + extra image thumbnails */}
          {(event.flyerImage || event.extraImage) && (
            <div className="flex gap-4 mb-6">
              {event.flyerImage && (
                <button
                  onClick={() => setLightbox({ src: event.flyerImage!, label: 'Event Flyer' })}
                  className="group relative flex-1 rounded-2xl overflow-hidden border-2 border-gray-100 hover:border-pink-400 transition-colors shadow-sm"
                >
                  <img src={event.flyerImage} alt="Event flyer" className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-900 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <ExternalLink size={12} /> View Flyer
                    </span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">Event Flyer</span>
                  </div>
                </button>
              )}
              {event.extraImage && (
                <button
                  onClick={() => setLightbox({ src: event.extraImage!, label: event.extraImageLabel || 'Additional Image' })}
                  className="group relative flex-1 rounded-2xl overflow-hidden border-2 border-gray-100 hover:border-pink-400 transition-colors shadow-sm"
                >
                  <img src={event.extraImage} alt={event.extraImageLabel || 'Additional image'} className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-900 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <ExternalLink size={12} /> View Image
                    </span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">{event.extraImageLabel || 'Additional Image'}</span>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Confirmed performers */}
          {performers.filter(p => p.confirmed).length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Performers</h3>
              <div className="space-y-2">
                {performers.filter(p => p.confirmed).map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-sm shrink-0" style={{ backgroundColor: event.color }}>
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.type}{p.performanceTime ? ` · ${p.performanceTime}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {event.ticketLink && (
            <a href={event.ticketLink} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-3 w-full py-4 bg-pink-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-pink-600 transition-colors shadow-lg shadow-pink-200/50">
              Get Tickets <ExternalLink size={16} />
            </a>
          )}
        </div>
      </motion.div>
    </motion.div>

    {/* Lightbox */}
    <AnimatePresence>
      {lightbox && <Lightbox src={lightbox.src} label={lightbox.label} onClose={() => setLightbox(null)} />}
    </AnimatePresence>
    </>
  );
};

const NewsletterForm = () => {
  const [email, setEmail] = useState('');
  const [done, setDone]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    await api.post('/api/newsletter', { email }).catch(() => {});
    setDone(true);
    setSubmitting(false);
  };
  return (
    <div className="mt-8 p-6 bg-pink-50 rounded-2xl border border-pink-100">
      <p className="text-xs font-bold uppercase tracking-widest text-pink-600 mb-2">Newsletter</p>
      {done ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="py-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 260 }}
              className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-pink-200"
            >
              <CheckCircle2 size={20} className="text-white" />
            </motion.div>
            <p className="text-base font-black text-pink-700">You're on the list!</p>
          </div>
          <p className="text-sm text-pink-600/80 leading-relaxed pl-[52px]">
            We'll keep you posted on all things Taos Pride — events, news, and how to get involved.
          </p>
        </motion.div>
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <input type="email" required placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)}
            className="bg-white border border-pink-200 rounded-lg px-4 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-pink-500/20" />
          <button type="submit" disabled={submitting} className="p-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors shrink-0 disabled:opacity-60">
            <ChevronRight size={20} />
          </button>
        </form>
      )}
    </div>
  );
};

// ── Suggestion box (public) ───────────────────────────────────────────────────
// Replaces a plain "email the secretary" mailto link — submissions land in
// the admin's Suggestions to Review panel, grouped together on whichever
// upcoming meeting the board is looking at, until promoted to a real
// agenda item or dismissed.
const SuggestionBoxForm = () => {
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — see the field below
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/api/suggestions', { message: message.trim(), submitterName: name.trim() || undefined, website });
      setDone(true);
    } catch (err: any) {
      alert(err?.message || 'Could not send your suggestion — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="p-6 bg-pink-50 rounded-3xl border border-pink-100">
        <div className="flex items-center gap-3 mb-1">
          <CheckCircle2 size={20} className="text-pink-500 shrink-0" />
          <p className="font-black text-pink-700 text-sm">Thanks — we got it!</p>
        </div>
        <p className="text-pink-900/60 text-sm">Your suggestion will be reviewed ahead of our next meeting.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="p-6 bg-pink-50 rounded-3xl border border-pink-100">
      <h5 className="font-black uppercase tracking-widest text-xs text-pink-600 mb-2">Have a suggestion?</h5>
      <p className="text-pink-900/60 text-sm mb-4">Send it our way and we'll review it ahead of the next meeting.</p>
      {/* Honeypot — invisible and unreachable to real visitors (off-screen,
          not tab-focusable, hidden from assistive tech), but a bot's
          autofill tends to populate any input it finds. If this has a
          value on submit, the server quietly no-ops instead of inserting. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={e => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute w-px h-px opacity-0 overflow-hidden -z-10"
        style={{ left: '-9999px' }}
      />
      <textarea
        required
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="What should we know or discuss?"
        rows={3}
        className="w-full bg-white border border-pink-200 rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-pink-500/20 resize-none"
      />
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Name (optional)"
        className="w-full bg-white border border-pink-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:ring-2 focus:ring-pink-500/20"
      />
      <button
        type="submit"
        disabled={submitting || !message.trim()}
        className="text-pink-600 font-bold flex items-center gap-2 hover:translate-x-1 transition-transform disabled:opacity-50 disabled:hover:translate-x-0"
      >
        {submitting ? 'Sending…' : 'Send Suggestion'} <ChevronRight size={16} />
      </button>
    </form>
  );
};

const Navbar = ({ phase }: { phase: SitePhase }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Events', href: '#events' },
    { name: 'Meetings', href: '#meetings', hiddenPhases: ['LIVE_EVENT'] as SitePhase[] },
    { name: 'Volunteer', href: '#volunteer' },
    { name: 'Photos', href: '/gallery' },
    { name: 'Sponsors', href: '#sponsors' },
  ];

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <a href="#" className="flex items-center gap-2 group">
          <img src="/TaosPrideLogo.png" alt="Taos Pride" className="h-14 w-14 object-contain group-hover:scale-110 transition-transform drop-shadow-lg" />
          <span className={`text-2xl font-black tracking-tighter ${scrolled ? 'text-gray-900' : 'text-white'}`}>
            TAOS <span className="text-pink-500">PRIDE</span>
          </span>
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.filter(l => !l.hiddenPhases?.includes(phase)).map((link) => (
            <a 
              key={link.name} 
              href={link.href} 
              className={`text-sm font-bold uppercase tracking-widest transition-colors hover:text-pink-500 ${scrolled ? 'text-gray-600' : 'text-white'}`}
            >
              {link.name}
            </a>
          ))}
          <a 
            href="#contribute" 
            className="px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-full text-sm font-bold uppercase tracking-widest transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            Donate
          </a>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-gray-900" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className={scrolled ? 'text-gray-900' : 'text-white'} /> : <Menu className={scrolled ? 'text-gray-900' : 'text-white'} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 w-full bg-white shadow-xl py-8 flex flex-col items-center gap-6 md:hidden"
          >
            {navLinks.filter(l => !l.hiddenPhases?.includes(phase)).map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="text-lg font-bold uppercase tracking-widest text-gray-800 hover:text-pink-500"
              >
                {link.name}
              </a>
            ))}
            <a 
              href="#contribute" 
              onClick={() => setIsOpen(false)}
              className="px-8 py-3 bg-pink-500 text-white rounded-full text-lg font-bold uppercase tracking-widest"
            >
              Donate
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const SectionHeading = ({ children, subtitle, light = false }: { children: React.ReactNode, subtitle?: string, light?: boolean }) => (
  <div className="mb-16 text-center">
    <motion.h2 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`text-5xl md:text-7xl font-display font-black uppercase tracking-tighter mb-4 ${light ? 'text-white' : 'text-gray-900'}`}
    >
      {children}
    </motion.h2>
    {subtitle && (
      <motion.p 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
        className={`text-xl font-medium ${light ? 'text-white/80' : 'text-gray-500'}`}
      >
        {subtitle}
      </motion.p>
    )}
    <motion.div 
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      className={`h-1.5 w-24 mx-auto mt-6 rounded-full bg-gradient-to-r from-pink-500 via-yellow-500 to-blue-500`}
    />
  </div>
);

const EventCard = ({ event, phase, onOpen }: { event: EventData; phase: SitePhase; onOpen: (e: EventData) => void }) => (
  <motion.div
    whileHover={{ y: -10 }}
    onClick={() => onOpen(event)}
    className="bg-white rounded-3xl overflow-hidden shadow-xl shadow-gray-200/50 border border-gray-100 h-full flex flex-col cursor-pointer group"
  >
    <div className="h-48 flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: event.heroImage ? undefined : event.color }}>
      {event.heroImage ? (
        <>
          <img src={event.heroImage} alt={event.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 opacity-10 blur-xl">{ICON_MAP[event.iconKey]}</div>
          <div className="z-10 text-white transform scale-[2] group-hover:scale-[2.2] transition-transform duration-300">
            {ICON_MAP[event.iconKey]}
          </div>
        </>
      )}
      {event.status !== 'CONFIRMED' && (
        <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/20 z-10">
          {event.status === 'TBD' ? 'Planning' : 'Teaser'}
        </div>
      )}
      <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <ChevronRight size={14} />
      </div>
    </div>

    <div className="p-8 flex-grow flex flex-col">
      {event.status === 'CONFIRMED' ? (
        <div className="flex items-center gap-3 mb-4 text-pink-500 font-bold uppercase text-sm tracking-widest">
          <Calendar size={16} />
          {event.date || event.eventDate}
        </div>
      ) : (
        <div className="flex items-center gap-3 mb-4 text-gray-400 font-bold uppercase text-sm tracking-widest italic">
          <Calendar size={16} />
          Date TBD
        </div>
      )}

      <h3 className="text-2xl font-black text-gray-900 mb-2 leading-tight">{event.title}</h3>

      <div className="flex-grow">
        {event.status === 'CONFIRMED' ? (
          <p className="text-gray-500 mb-6 leading-relaxed">{event.description}</p>
        ) : event.status === 'TEASER' ? (
          <div className="bg-gray-50 p-4 rounded-xl mb-6">
            <p className="text-gray-600 italic leading-relaxed text-sm">"{event.teaserText}"</p>
          </div>
        ) : (
          <p className="text-gray-400 mb-6 leading-relaxed italic text-sm">
            We are currently in meetings deciding the vision for this event. Check our meetings for the next planning session!
          </p>
        )}
      </div>

      <div className="space-y-3 pt-6 border-t border-gray-50">
        <div className="flex items-center gap-3 text-gray-600 text-sm">
          <Clock size={16} className={event.status === 'CONFIRMED' ? 'text-pink-500' : 'text-gray-300'} />
          {event.time || event.eventTime || 'TBD'}
        </div>
        <div className="flex items-start gap-3 text-gray-800 text-sm font-medium">
          <MapPin size={16} className={event.status === 'CONFIRMED' ? 'text-pink-500 shrink-0 mt-0.5' : 'text-gray-300 shrink-0 mt-0.5'} />
          <div>
            <div>{event.location || 'Location Pending'}</div>
            {event.locationDetails && <div className="text-gray-400 font-normal">{event.locationDetails}</div>}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center w-full py-2 border border-gray-100 rounded-lg text-xs font-black uppercase tracking-widest text-gray-400 group-hover:border-pink-500 group-hover:text-pink-500 transition-colors">
          {event.ticketLink ? 'Get Tickets' : 'View Details'} <ChevronRight size={12} className="ml-1" />
        </div>
      </div>
    </div>
  </motion.div>
);

// ── Past Events (grouped by year, click a year to expand) ────────────────────
const PastEventsSection = ({ events, onOpen }: { events: EventData[]; onOpen: (e: EventData) => void }) => {
  const [openYear, setOpenYear] = useState<number | null>(null);

  const byYear = new Map<number, EventData[]>();
  for (const ev of events) {
    if (!ev.eventDateSort) continue;
    const year = new Date(ev.eventDateSort + 'T00:00:00').getFullYear();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(ev);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  if (years.length === 0) return null;

  return (
    <div className="mt-20 pt-14 border-t border-gray-100">
      <p className="text-center text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Past Events</p>
      <div className="flex flex-wrap justify-center gap-2 mb-2">
        {years.map(year => (
          <button
            key={year}
            onClick={() => setOpenYear(openYear === year ? null : year)}
            className={`px-5 py-2 rounded-full text-sm font-bold border-2 transition-colors ${
              openYear === year
                ? 'bg-gray-900 border-gray-900 text-white'
                : 'border-gray-200 text-gray-600 hover:border-gray-400'
            }`}
          >
            {year}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {openYear !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="max-w-2xl mx-auto overflow-hidden"
          >
            <div className="space-y-2 pt-6 pb-2">
              {byYear.get(openYear)!.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => onOpen(ev)}
                  className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl text-left transition-colors"
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{ev.title}</p>
                    <p className="text-xs text-gray-400">{ev.date || ev.eventDate}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Meeting Agenda Modal (public) ─────────────────────────────────────────────
const MeetingAgendaModal = ({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) => {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEscapeKey(onClose);

  useEffect(() => {
    api.get(`/api/meetings/${meeting.id}/agenda`)
      .then(data => setItems(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [meeting.id]);

  const statusLabel: Record<AgendaItem['status'], string> = {
    pending: 'Up for Discussion',
    discussed: 'Discussed',
    decided: 'Decided',
    tabled: 'Tabled',
  };
  const statusColor: Record<AgendaItem['status'], string> = {
    pending: 'bg-gray-100 text-gray-500',
    discussed: 'bg-blue-100 text-blue-700',
    decided: 'bg-green-100 text-green-700',
    tabled: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-8 bg-gray-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-xl bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 px-8 pt-8 pb-6 shrink-0">
          <div className="flex items-start justify-between mb-4">
            <span className="flex items-center gap-2 bg-white/20 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
              {!meeting.isPast && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />}
              {meeting.isPast ? 'Past Session' : 'Upcoming Session'}
            </span>
            <button onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">{meeting.date}</div>
          <div className="text-white text-xl font-black mb-1">{meeting.time}</div>
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <MapPin size={13} /> {meeting.location}
          </div>
          {meeting.whoIsInvited && (
            <div className="flex items-center gap-2 text-white/50 text-xs mt-1">
              <Users size={12} /> {meeting.whoIsInvited}
            </div>
          )}
        </div>

        {/* Agenda items */}
        <div className="p-8 overflow-y-auto flex-1">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-5">Agenda</h3>
          {loading ? (
            <p className="text-gray-400 text-sm italic">Loading agenda…</p>
          ) : items.length === 0 ? (
            <div className="text-center py-10">
              <ClipboardList size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No agenda items have been added yet.</p>
              <p className="text-gray-300 text-xs mt-1">Check back closer to the meeting date.</p>
            </div>
          ) : (
            <ol className="space-y-4">
              {[...items].sort((a, b) => a.itemOrder - b.itemOrder).map((item, idx) => (
                <li key={item.id} className="flex gap-4">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <p className="font-bold text-gray-900 text-sm">{item.title}</p>
                      {item.status !== 'pending' && (
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${statusColor[item.status]}`}>
                          {statusLabel[item.status]}
                        </span>
                      )}
                    </div>
                    {item.description && <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 font-bold">
                      {item.presenter && <span>Presenter: {item.presenter}</span>}
                      {item.timeAllocated && <span>{item.timeAllocated} min</span>}
                    </div>
                    {item.outcome && (
                      <div className="mt-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs text-green-800 italic">
                        Outcome: {item.outcome}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {meeting.agendaUrl && (
          <div className="px-8 pb-6 shrink-0">
            <a href={meeting.agendaUrl} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">
              Full Agenda Document <ExternalLink size={14} />
            </a>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const MeetingCard = ({ meeting, onViewAgenda }: { meeting: Meeting; onViewAgenda: (m: Meeting) => void }) => (
  <div className={`p-6 rounded-2xl transition-all ${meeting.isPast ? 'bg-gray-50 border border-gray-200' : 'bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 shadow-sm'}`}>
    <div className="flex justify-between items-start mb-4">
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${meeting.isPast ? 'bg-gray-100 text-gray-400' : 'bg-indigo-100 text-indigo-700'}`}>
        {!meeting.isPast && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse inline-block" />}
        {meeting.isPast ? 'Past Session' : 'Upcoming Session'}
      </div>
      <button
        onClick={() => onViewAgenda(meeting)}
        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
          meeting.isPast
            ? 'text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200'
            : 'text-indigo-600 hover:text-indigo-800 bg-indigo-100 hover:bg-indigo-200'
        }`}
      >
        <ClipboardList size={13} /> View Agenda
      </button>
    </div>
    <div className="font-bold text-gray-400 text-xs uppercase tracking-widest mb-1">{meeting.date}</div>
    <h4 className="text-xl font-black text-gray-900 mb-2">{meeting.time}</h4>
    <div className="flex items-center gap-2 text-gray-600 text-sm mb-4">
      <MapPin size={14} /> {meeting.location}
    </div>
    <div className="bg-gray-50 p-3 rounded-lg text-xs">
      <span className="font-bold text-gray-400 uppercase tracking-tighter block mb-1">Who's Invited:</span>
      <p className="text-gray-600">{meeting.whoIsInvited}</p>
    </div>
  </div>
);

const ParticipationForm = ({ type, config, onClose }: {
  type: string;
  config: ParticipationConfig;
  onClose: () => void;
}) => {
  const [formData, setFormData] = useState<Record<string, string>>({ name: '', email: '', phone: '', organization: '', notes: '' });
  const [fileData, setFileData] = useState<{ name: string; data: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEscapeKey(onClose);

  useEffect(() => {
    const savedY = window.scrollY;
    return () => { window.scrollTo({ top: savedY, behavior: 'instant' as ScrollBehavior }); };
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setFileData({ name: file.name, data: ev.target?.result as string });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch(`/api/apply/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          ...(fileData ? { fileName: fileData.name, fileData: fileData.data } : {}),
        }),
      });
      setIsSuccess(true);
      setTimeout(onClose, 6000);
    } catch {
      alert('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldCls = 'w-full bg-gray-50 border-2 border-transparent focus:border-pink-500 p-4 rounded-xl outline-none transition-all';
  const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-gray-100 relative overflow-y-auto max-h-[90vh]"
      >
        <div className="p-10">
          <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors"><X /></button>

          {isSuccess ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart fill="currentColor" size={32} />
              </div>
              <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">Application Received!</h3>
              <p className="text-gray-500">{config.successMessage}</p>
            </div>
          ) : (
            <>
              <h3 className="text-4xl font-black uppercase tracking-tighter mb-2">
                {config.title} <span className="text-pink-500">Application</span>
              </h3>
              {config.description && (
                <p className="text-gray-500 mb-8 leading-relaxed [&_a]:text-pink-500 [&_a]:underline [&_a]:hover:text-pink-700"
                  dangerouslySetInnerHTML={{ __html: config.description }}
                />
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className={labelCls}>Full Name</label>
                  <input required type="text" placeholder="Your Name" value={formData.name}
                    onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                    className={fieldCls} />
                </div>

                <div>
                  <label className={labelCls}>Email Address</label>
                  <input required type="email" placeholder="contact@example.com" value={formData.email}
                    onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                    className={fieldCls} />
                </div>

                {config.showPhone && (
                  <div>
                    <label className={labelCls}>Phone Number</label>
                    <input type="tel" placeholder="(505) 555-0100" value={formData.phone}
                      onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                      className={fieldCls} />
                  </div>
                )}

                {config.showOrganization && (
                  <div>
                    <label className={labelCls}>Organization / Business Name</label>
                    <input type="text" placeholder="Optional" value={formData.organization}
                      onChange={e => setFormData(f => ({ ...f, organization: e.target.value }))}
                      className={fieldCls} />
                  </div>
                )}

                <div>
                  <label className={labelCls}>Tell us more</label>
                  <textarea value={formData.notes}
                    onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                    className={`${fieldCls} h-28 resize-none`}
                    placeholder="Your experience, your vision, or what you're bringing to Pride…" />
                </div>

                {config.showUpload && (
                  <div>
                    <label className={labelCls}>Attachment (optional)</label>
                    {fileData ? (
                      <div className="flex items-center gap-3 p-3 bg-pink-50 border border-pink-200 rounded-xl text-sm">
                        <span className="flex-1 truncate text-pink-800 font-medium">{fileData.name}</span>
                        <button type="button" onClick={() => setFileData(null)}
                          className="text-pink-400 hover:text-red-500 transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl hover:border-pink-300 transition-colors">
                        <Upload size={18} className="text-gray-400 shrink-0" />
                        <span className="text-sm text-gray-500">Click to attach a file (PDF, image, doc…)</span>
                        <input type="file" className="hidden" onChange={handleFile}
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif" />
                      </label>
                    )}
                  </div>
                )}

                <button type="submit" disabled={isSubmitting}
                  className="w-full bg-gray-900 text-white rounded-2xl p-5 font-black uppercase tracking-[0.2em] shadow-xl hover:bg-pink-500 transition-all active:scale-95 disabled:opacity-50">
                  {isSubmitting ? 'Processing…' : config.ctaLabel}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const ParticipationCard = ({ config, typeKey, onOpen }: {
  config: ParticipationConfig;
  typeKey: ParticipationTypeKey;
  onOpen: (type: string) => void;
}) => {
  const { icon, colorClass } = PARTICIPATION_META[typeKey];
  const handleClick = () => {
    if (config.externalUrl) {
      window.open(config.externalUrl, '_blank', 'noopener');
    } else {
      onOpen(typeKey);
    }
  };
  return (
    <motion.div
      onClick={handleClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`p-10 rounded-3xl border-2 flex flex-col h-full bg-white group transition-all cursor-pointer ${colorClass}`}
    >
      <div className="mb-6 w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:rotate-12 transition-transform bg-gray-900">
        {icon}
      </div>
      <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">
        {config.title}
      </h3>
      <p className="text-gray-600 mb-8 flex-grow leading-relaxed"
        dangerouslySetInnerHTML={{ __html: config.description }}
      />
      <div className="flex items-center gap-2 font-black uppercase text-sm tracking-widest group-hover:translate-x-2 transition-transform">
        {config.ctaLabel} <ChevronRight size={18} />
        {config.externalUrl && <ExternalLink size={14} className="opacity-60" />}
      </div>
    </motion.div>
  );
};

// ── Admin: Photos ─────────────────────────────────────────────────────────────
export const PhotosAdmin = ({ albums, events, onRefresh }: { albums: PhotoAlbum[]; events: EventData[]; onRefresh: () => void }) => {
  const blank: Partial<PhotoAlbum> = { title: '', year: new Date().getFullYear(), photoCount: 0, visible: true };
  const [selected, setSelected] = useState<PhotoAlbum | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Partial<PhotoAlbum>>(blank);
  const [coverPreview, setCoverPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const startNew = () => {
    setForm({ ...blank });
    setCoverPreview('');
    setIsNew(true);
    setSelected({} as PhotoAlbum);
  };

  const startEdit = (a: PhotoAlbum) => {
    setForm({ ...a });
    setCoverPreview(a.coverImage || '');
    setIsNew(false);
    setSelected(a);
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, 1200, 0.82).then(url => {
      setCoverPreview(url);
      setForm(f => ({ ...f, coverImage: url }));
    });
  };

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/api/photos', form);
      } else {
        await api.put(`/api/photos/${form.id}`, form);
      }
      onRefresh();
      setSelected(null);
    } catch {
      alert('Save failed.');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete album "${form.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.del(`/api/photos/${form.id}`);
      onRefresh();
      setSelected(null);
    } catch {
      alert('Delete failed.');
    }
    setDeleting(false);
  };

  const inputCls2 = 'w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-500 bg-white';

  // Group by year descending
  const years = [...new Set(albums.map(a => a.year))].sort((a, b) => b - a);

  return (
    <div className="flex gap-6 min-h-[580px]">
      {/* Left: album list */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
        <button onClick={startNew}
          className="w-full py-2.5 border-2 border-dashed border-gray-300 text-gray-400 rounded-xl text-sm font-bold hover:border-pink-400 hover:text-pink-500 transition-all">
          + New Album
        </button>

        {albums.length === 0 && (
          <p className="text-gray-400 text-xs italic text-center mt-6">No albums yet — add one!</p>
        )}

        {years.map(year => (
          <div key={year}>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">{year}</p>
            <div className="space-y-1.5">
              {albums.filter(a => a.year === year).map(a => (
                <button key={a.id} onClick={() => startEdit(a)}
                  className={`w-full text-left rounded-xl border-2 transition-all overflow-hidden flex items-stretch ${
                    selected?.id === a.id ? 'border-pink-500' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 flex-shrink-0 bg-gray-100 relative">
                    {(a.coverImage) ? (
                      <img src={a.coverImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera size={16} className="text-gray-300" />
                      </div>
                    )}
                    {!a.visible && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-[9px] font-black">HIDDEN</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-2.5 min-w-0">
                    <p className="font-bold text-sm text-gray-900 truncate leading-tight">{a.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {a.photoCount} photo{a.photoCount !== 1 ? 's' : ''}
                      {a.externalUrl && <span className="ml-1 text-pink-400">↗</span>}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Right: editor */}
      {selected !== null ? (
        <div className="flex-1 bg-white rounded-2xl border-2 border-gray-200 p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-gray-900">{isNew ? 'New Album' : 'Edit Album'}</h3>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          <div className="space-y-6">
            {/* Cover image */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-3">Cover Photo</label>
              <div className="flex items-start gap-5">
                <div className="w-32 h-20 rounded-xl border-2 border-dashed border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0 flex items-center justify-center">
                  {coverPreview ? (
                    <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={24} className="text-gray-300" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 transition-all">
                    Upload Cover
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                  </label>
                  {coverPreview && (
                    <button onClick={() => { setCoverPreview(''); setForm(f => ({ ...f, coverImage: '' })); }}
                      className="block text-xs text-red-400 hover:underline">Remove</button>
                  )}
                  <p className="text-xs text-gray-400">Landscape images work best (3:2 ratio)</p>
                </div>
              </div>
            </div>

            {/* Title + Year */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Album Title *</label>
                <input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={inputCls2} placeholder="Taos Pride 2026" />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Year *</label>
                <input type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                  className={inputCls2} placeholder="2026" />
              </div>
            </div>

            {/* Link to event */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Link to Event (optional)</label>
              <select value={form.eventId || ''} onChange={e => setForm(f => ({ ...f, eventId: e.target.value || undefined }))}
                className={inputCls2}>
                <option value="">— No specific event —</option>
                {events.map(e => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Description</label>
              <textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-500 resize-none"
                placeholder="A brief description shown on the public gallery page…" />
            </div>

            {/* External gallery URL */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">External Gallery URL</label>
              <input value={form.externalUrl || ''} onChange={e => setForm(f => ({ ...f, externalUrl: e.target.value }))}
                className={inputCls2} placeholder="Google Photos, Flickr, SmugMug link…" />
              <p className="text-xs text-gray-400 mt-1">Visitors will be sent here when they click the album.</p>
            </div>

            {/* Photo count + visibility */}
            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Photo Count</label>
                <input type="number" min="0" value={form.photoCount ?? 0}
                  onChange={e => setForm(f => ({ ...f, photoCount: parseInt(e.target.value) || 0 }))}
                  className={inputCls2} />
              </div>
              <div className="pb-0.5">
                <button type="button" onClick={() => setForm(f => ({ ...f, visible: !f.visible }))}
                  className="flex items-center gap-3 w-full">
                  <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.visible ? 'bg-green-500' : 'bg-gray-200'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow mt-0.5 transition-transform ${form.visible ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className={`text-sm font-bold ${form.visible ? 'text-green-600' : 'text-gray-400'}`}>
                    {form.visible ? 'Visible on site' : 'Hidden from site'}
                  </span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button onClick={handleSave} disabled={saving || !form.title}
                className="flex-1 py-3 bg-pink-500 text-white rounded-full font-black text-sm uppercase tracking-widest hover:bg-pink-600 transition-all disabled:opacity-50">
                {saving ? 'Saving…' : isNew ? 'Create Album' : 'Save Changes'}
              </button>
              {!isNew && (
                <button onClick={handleDelete} disabled={deleting}
                  className="px-5 py-3 border-2 border-red-200 text-red-400 rounded-full font-black text-sm hover:bg-red-50 transition-all disabled:opacity-50">
                  {deleting ? '…' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl">
          <div className="text-center text-gray-400">
            <Camera size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm italic">Select an album to edit, or click <strong>+ New Album</strong></p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Admin: Communications ─────────────────────────────────────────────────────
interface NewsletterSub { id: number; email: string; name: string; subscribedAt: string; }
interface Contribution  { id: number; submittedAt: string; name?: string; email: string; amount?: number; method?: string; message?: string; }

export const CommunicationsAdmin = () => {
  const [tab, setTab] = useState<'newsletter' | 'contributions'>('newsletter');
  const [subs, setSubs]     = useState<NewsletterSub[]>([]);
  const [contribs, setContribs] = useState<Contribution[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get('/api/newsletter'), api.get('/api/contributions')])
      .then(([n, c]) => { setSubs(n); setContribs(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const deleteSub = async (id: number) => {
    if (!confirm('Remove this subscriber?')) return;
    await api.del(`/api/newsletter/${id}`);
    setSubs(s => s.filter(x => x.id !== id));
  };

  const downloadCSV = () => {
    const header = 'Email,Name,Subscribed At';
    const rows = subs.map(s => `${s.email},${s.name || ''},${new Date(s.subscribedAt).toLocaleDateString()}`);
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'taospride-newsletter.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadContribsCSV = () => {
    const header = 'Date,Name,Email,Amount,Method,Message';
    const rows = contribs.map(c => [
      new Date(c.submittedAt).toLocaleDateString(),
      c.name || '',
      c.email,
      c.amount ? `$${c.amount}` : '',
      c.method || '',
      (c.message || '').replace(/,/g, ';'),
    ].join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'taospride-contributions.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-gray-400 text-sm italic">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* Sub-tab */}
      <div className="flex gap-2">
        {(['newsletter', 'contributions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
              tab === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
            }`}>
            {t === 'newsletter' ? `Newsletter (${subs.length})` : `Contributions (${contribs.length})`}
          </button>
        ))}
      </div>

      {/* Newsletter */}
      {tab === 'newsletter' && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h3 className="font-black text-gray-900">{subs.length} Subscriber{subs.length !== 1 ? 's' : ''}</h3>
              <p className="text-xs text-gray-400 mt-0.5">Export to CSV for Mailchimp or any email platform.</p>
            </div>
            <button onClick={downloadCSV}
              className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold hover:bg-pink-600 transition-colors">
              <ExternalLink size={13} /> Export CSV
            </button>
          </div>
          {subs.length === 0 ? (
            <p className="p-8 text-gray-400 text-sm italic text-center">No subscribers yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Email','Name','Subscribed',''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.email}</td>
                    <td className="px-4 py-3 text-gray-500">{s.name || <span className="text-gray-300 italic">—</span>}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(s.subscribedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteSub(s.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Contributions */}
      {tab === 'contributions' && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h3 className="font-black text-gray-900">{contribs.length} Gift Notification{contribs.length !== 1 ? 's' : ''}</h3>
              <p className="text-xs text-gray-400 mt-0.5">People who notified you of a gift via PayPal, Venmo, or check.</p>
            </div>
            {contribs.length > 0 && (
              <button onClick={downloadContribsCSV}
                className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold hover:bg-pink-600 transition-colors">
                <ExternalLink size={13} /> Export CSV
              </button>
            )}
          </div>
          {contribs.length === 0 ? (
            <p className="p-8 text-gray-400 text-sm italic text-center">No gift notifications yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Date','Name','Email','Amount','Method','Message'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contribs.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{new Date(c.submittedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name || <span className="text-gray-300 italic">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3">
                      {c.amount ? <span className="font-black text-green-600">${c.amount}</span> : <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.method ? (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          c.method === 'paypal' ? 'bg-blue-100 text-blue-700' :
                          c.method === 'venmo'  ? 'bg-sky-100 text-sky-700' :
                                                  'bg-gray-100 text-gray-600'
                        }`}>{c.method}</span>
                      ) : <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{c.message || <span className="text-gray-300 italic">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {contribs.length > 0 && (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-right">
              <span className="text-xs text-gray-400 font-bold">Total reported: </span>
              <span className="text-sm font-black text-green-600">
                ${contribs.reduce((s, c) => s + (c.amount || 0), 0).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Admin: Participation / Get Involved Editor ────────────────────────────────
export const ParticipationAdmin = ({
  initial,
  onSaved,
}: {
  initial: Record<ParticipationTypeKey, ParticipationConfig>;
  onSaved: (c: Record<ParticipationTypeKey, ParticipationConfig>) => void;
}) => {
  const [values, setValues] = useState(initial);
  const [activeKey, setActiveKey] = useState<ParticipationTypeKey>('volunteer');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setValues(initial); }, [initial]);

  const cur = values[activeKey];
  const set = <K extends keyof ParticipationConfig>(field: K, val: ParticipationConfig[K]) =>
    setValues(v => ({ ...v, [activeKey]: { ...v[activeKey], [field]: val } }));

  const save = async () => {
    setSaving(true);
    const payload: Record<string, string> = {};
    for (const key of PARTICIPATION_KEYS) {
      payload[`participate_${key}`] = JSON.stringify(values[key]);
    }
    try {
      await api.post('/api/settings', payload);
      onSaved(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { alert('Save failed'); }
    finally { setSaving(false); }
  };

  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-pink-400 transition-colors';
  const labelCls = 'text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1';
  const toggle = (field: 'visible' | 'showPhone' | 'showOrganization' | 'showUpload') => (
    <button
      onClick={() => set(field, !cur[field])}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cur[field] ? 'bg-pink-500' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${cur[field] ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 mb-1">Get Involved</h2>
        <p className="text-sm text-gray-500">
          Control which participation tiles appear on the public site, and customize each form's content and fields.
        </p>
      </div>

      {/* Type selector with visibility badges */}
      <div className="flex gap-2 flex-wrap">
        {PARTICIPATION_KEYS.map(key => (
          <button
            key={key}
            onClick={() => setActiveKey(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
              activeKey === key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            {values[key].title}
            <span className={`w-2 h-2 rounded-full ${values[key].visible ? 'bg-green-400' : 'bg-gray-300'}`} />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: visibility + form fields */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Display & Fields</h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">Show this tile</p>
              <p className="text-xs text-gray-400">Hide to remove from the public site entirely.</p>
            </div>
            {toggle('visible')}
          </div>
          <hr className="border-gray-100" />

          <div>
            <label className={labelCls}>Tile Title</label>
            <input value={cur.title} onChange={e => set('title', e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Button Label</label>
            <input value={cur.ctaLabel} onChange={e => set('ctaLabel', e.target.value)} className={inputCls} placeholder="Apply Now" />
          </div>

          <div>
            <label className={labelCls}>External Form URL</label>
            <input value={cur.externalUrl} onChange={e => set('externalUrl', e.target.value)}
              className={inputCls} placeholder="https://… — leave blank to use the inline form" />
            <p className="text-xs text-gray-400 mt-1">
              If set, clicking the tile opens this URL in a new tab instead of the inline form.
            </p>
          </div>

          <hr className="border-gray-100" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Inline Form Fields</p>

          {([
            { field: 'showPhone' as const, label: 'Phone number field' },
            { field: 'showOrganization' as const, label: 'Organization / business name field' },
            { field: 'showUpload' as const, label: 'File attachment field' },
          ]).map(({ field, label }) => (
            <div key={field} className="flex items-center justify-between">
              <p className="text-sm text-gray-700">{label}</p>
              {toggle(field)}
            </div>
          ))}
        </div>

        {/* Right: text content */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Text Content</h3>

          <div>
            <label className={labelCls}>Card & Form Description</label>
            <textarea
              value={cur.description}
              onChange={e => set('description', e.target.value)}
              rows={5}
              className={`${inputCls} resize-none`}
              placeholder="Describe this opportunity…"
            />
            <p className="text-xs text-gray-400 mt-1">
              HTML is supported for links: <code className="bg-gray-100 px-1 rounded">{'<a href="https://…">link text</a>'}</code>
            </p>
          </div>

          <div>
            <label className={labelCls}>Success Message (after submit)</label>
            <textarea
              value={cur.successMessage}
              onChange={e => set('successMessage', e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Thank you! We'll be in touch…"
            />
          </div>

          {/* Preview */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Card Preview</p>
            <div className={`rounded-2xl border-2 p-6 bg-white ${PARTICIPATION_META[activeKey].colorClass}`}>
              <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white mb-3">
                {PARTICIPATION_META[activeKey].icon}
              </div>
              <p className="font-black text-gray-900 text-lg mb-2">{cur.title}</p>
              <p className="text-gray-600 text-sm mb-3 [&_a]:text-pink-500 [&_a]:underline leading-relaxed"
                dangerouslySetInnerHTML={{ __html: cur.description || '<em>No description set</em>' }} />
              <p className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-1">
                {cur.ctaLabel} <ChevronRight size={12} />
                {cur.externalUrl && <ExternalLink size={10} className="opacity-60" />}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={saving}
          className="px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save All Participation Settings'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-bold text-green-600">
            <CheckCircle2 size={16} /> Saved
          </span>
        )}
      </div>
    </div>
  );
};

// ── Admin: Hero Banner Editor ────────────────────────────────────────────────
export const HeroEditor = ({ initial, onSaved }: { initial: HeroSettings; onSaved: (s: HeroSettings) => void }) => {
  type PhaseKey = 'planning' | 'activePlanning' | 'liveEvent';
  const PHASE_LABELS: Record<PhaseKey, string> = {
    planning: 'Planning Phase',
    activePlanning: 'Active Planning Phase',
    liveEvent: 'Live Event Phase',
  };
  const [activePhase, setActivePhase] = useState<PhaseKey>('planning');
  const [values, setValues] = useState<HeroSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync if parent re-loads settings
  useEffect(() => { setValues(initial); }, [initial]);

  const cur = values[activePhase];
  const def = HERO_DEFAULTS[activePhase];

  const set = (field: keyof HeroPhaseConfig, val: string) =>
    setValues(v => ({ ...v, [activePhase]: { ...v[activePhase], [field]: val } }));

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, 1200, 0.82).then(data => set('image', data));
    e.target.value = '';
  };

  const save = async () => {
    setSaving(true);
    const payload: Record<string, string> = {};
    (Object.keys(values) as PhaseKey[]).forEach(phase => {
      const slug = phase === 'activePlanning' ? 'active' : phase === 'liveEvent' ? 'live' : 'planning';
      (Object.keys(values[phase]) as (keyof HeroPhaseConfig)[]).forEach(field => {
        payload[`hero_${slug}_${field}`] = values[phase][field];
      });
    });
    try {
      await api.post('/api/settings', payload);
      onSaved(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert('Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 mb-1">Hero Banner</h2>
        <p className="text-sm text-gray-500">
          Each site phase shows a different full-screen banner. Edit the image, headline, subtext, and call-to-action for each phase below.
        </p>
      </div>

      {/* Phase tabs */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(PHASE_LABELS) as PhaseKey[]).map(p => (
          <button
            key={p}
            onClick={() => setActivePhase(p)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
              activePhase === p
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: image */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Background Image</h3>

          {cur.image ? (
            <div className="relative rounded-xl overflow-hidden aspect-video bg-gray-100">
              <img src={cur.image} alt="Hero" className="w-full h-full object-cover" />
              <button
                onClick={() => set('image', '')}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors"
                title="Remove image"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div className="aspect-video rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-400">
              <ImageIcon size={32} />
              <span className="text-sm">No image set — will use default gradient background</span>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <span className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors">
              <Upload size={14} /> Upload Image
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={pickImage} />
          </label>
          <p className="text-xs text-gray-400">Use a wide landscape photo (1920×1080 or similar). The image fills the entire screen.</p>
        </div>

        {/* Right: text fields */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Text Content</h3>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">
              Headline — Line 1
            </label>
            <input
              value={cur.line1}
              onChange={e => set('line1', e.target.value)}
              placeholder={def.line1}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold uppercase tracking-wide outline-none focus:border-pink-400 transition-colors"
            />
            <p className="text-xs text-gray-400 mt-1">Displayed in white. Appears on the first line of the large heading.</p>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">
              Headline — Line 2 (gradient)
            </label>
            <input
              value={cur.line2}
              onChange={e => set('line2', e.target.value)}
              placeholder={def.line2}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold uppercase tracking-wide outline-none focus:border-pink-400 transition-colors"
            />
            <p className="text-xs text-gray-400 mt-1">Displayed with the pink → yellow → cyan gradient.</p>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">
              Subtext
            </label>
            <textarea
              value={cur.sub}
              onChange={e => set('sub', e.target.value)}
              placeholder={def.sub || 'Optional — leave blank to hide'}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-pink-400 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">
                Button Label
              </label>
              <input
                value={cur.ctaLabel}
                onChange={e => set('ctaLabel', e.target.value)}
                placeholder={def.ctaLabel}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-pink-400 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">
                Button Link
              </label>
              <input
                value={cur.ctaHref}
                onChange={e => set('ctaHref', e.target.value)}
                placeholder={def.ctaHref}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-pink-400 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Live preview strip */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Preview</p>
        </div>
        <div
          className="relative h-48 flex items-center justify-center overflow-hidden bg-gray-900"
        >
          {cur.image ? (
            <img src={cur.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />
          <div className="relative z-10 text-center px-4">
            <div className="text-3xl md:text-4xl font-black uppercase leading-tight tracking-tighter text-white drop-shadow-xl">
              {cur.line1 || def.line1}
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-yellow-500 to-cyan-500">
                {cur.line2 || def.line2}
              </span>
            </div>
            {(cur.sub || def.sub) && (
              <p className="text-white/70 text-xs mt-2 max-w-sm mx-auto leading-relaxed">
                {cur.sub || def.sub}
              </p>
            )}
            <div className="mt-3">
              <span className="inline-block px-4 py-1.5 bg-pink-500 text-white rounded-full text-xs font-bold">
                {cur.ctaLabel || def.ctaLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save All Hero Settings'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-bold text-green-600">
            <CheckCircle2 size={16} /> Saved
          </span>
        )}
      </div>
    </div>
  );
};

// ── Admin: Sponsors ───────────────────────────────────────────────────────────
export const SponsorsAdmin = ({ sponsors, onRefresh }: { sponsors: Sponsor[]; onRefresh: () => void }) => {
  const [selected, setSelected] = useState<Sponsor | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Partial<Sponsor>>({});
  const [logoPreview, setLogoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Independent of site phase on purpose — see the sponsorshipOpen comment
  // in App(). Self-contained here rather than threaded through props/
  // fetchData since it's a simple standalone setting.
  const [sponsorshipOpen, setSponsorshipOpen] = useState(true);
  const [savingOpen, setSavingOpen] = useState(false);

  useEffect(() => {
    api.get('/api/settings').then(s => setSponsorshipOpen(s?.sponsorship_open !== '0')).catch(() => {});
  }, []);

  const toggleSponsorshipOpen = async () => {
    const next = !sponsorshipOpen;
    setSponsorshipOpen(next);
    setSavingOpen(true);
    try {
      await api.post('/api/settings', { sponsorship_open: next ? '1' : '0' });
    } catch {
      setSponsorshipOpen(!next);
      alert('Could not save — please try again.');
    } finally {
      setSavingOpen(false);
    }
  };

  const startNew = () => {
    setForm({ level: 'Silver', paymentReceived: false });
    setLogoPreview('');
    setIsNew(true);
    setSelected({} as Sponsor);
  };

  const startEdit = (s: Sponsor) => {
    setForm({ ...s });
    setLogoPreview(s.logoUrl || '');
    setIsNew(false);
    setSelected(s);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, 600, 0.90).then(url => {
      setLogoPreview(url);
      setForm(f => ({ ...f, logoUrl: url }));
    });
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/api/sponsors', form);
      } else {
        await api.put(`/api/sponsors/${form.id}`, form);
      }
      onRefresh();
      setSelected(null);
    } catch {
      alert('Save failed — check console for details.');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Remove "${form.name}" from sponsors? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.del(`/api/sponsors/${form.id}`);
      onRefresh();
      setSelected(null);
    } catch {
      alert('Delete failed.');
    }
    setDeleting(false);
  };

  const grouped = SPONSOR_TIERS
    .map(t => ({ ...t, items: sponsors.filter(s => s.level === t.level) }))
    .filter(t => t.items.length > 0);

  const inputCls2 = 'w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-500 bg-white';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-5 py-4">
        <div>
          <p className="text-sm font-bold text-gray-800">Sponsorship is open</p>
          <p className="text-xs text-gray-400">
            Independent of site phase — turn off once your tiers are locked in to switch the public
            page to a thank-you page instead of a pitch, whenever that actually happens.
          </p>
        </div>
        <button
          onClick={toggleSponsorshipOpen}
          disabled={savingOpen}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 shrink-0 ml-4 ${sponsorshipOpen ? 'bg-pink-500' : 'bg-gray-200'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${sponsorshipOpen ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <div className="flex gap-6 min-h-[580px]">
      {/* Left: sponsor list */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
        <button
          onClick={startNew}
          className="w-full py-2.5 border-2 border-dashed border-gray-300 text-gray-400 rounded-xl text-sm font-bold hover:border-pink-400 hover:text-pink-500 transition-all"
        >
          + Add Sponsor
        </button>

        {sponsors.length === 0 && (
          <p className="text-gray-400 text-xs italic text-center mt-6">No sponsors yet — add one!</p>
        )}

        {grouped.map(tier => (
          <div key={tier.level}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TIER_COLORS[tier.level] }} />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{tier.level}</span>
            </div>
            <div className="space-y-1.5">
              {tier.items.map(s => (
                <button
                  key={s.id}
                  onClick={() => startEdit(s)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    selected?.id === s.id
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  {s.logoUrl ? (
                    <img src={s.logoUrl} alt={s.name} className="w-9 h-9 rounded-lg object-contain bg-gray-50 flex-shrink-0 border border-gray-100" />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                      style={{ background: TIER_COLORS[s.level] }}
                    >
                      {s.logoInitials || s.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400">
                      {s.amount ? `$${Number(s.amount).toLocaleString()}` : '—'}
                      {' · '}
                      <span className={s.paymentReceived ? 'text-green-500' : 'text-gray-400'}>
                        {s.paymentReceived ? '✓ paid' : 'unpaid'}
                      </span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Right: editor */}
      {selected !== null ? (
        <div className="flex-1 bg-white rounded-2xl border-2 border-gray-200 p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-gray-900">{isNew ? 'New Sponsor' : 'Edit Sponsor'}</h3>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          <div className="space-y-6">
            {/* Logo upload */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-3">Logo</label>
              <div className="flex items-start gap-5">
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="preview" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Camera size={24} className="text-gray-300" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 transition-all">
                    <span>Upload Logo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                  {logoPreview && (
                    <button onClick={() => { setLogoPreview(''); setForm(f => ({ ...f, logoUrl: '' })); }}
                      className="block text-xs text-red-400 hover:underline">Remove logo</button>
                  )}
                  <p className="text-xs text-gray-400">PNG, JPG, SVG — keep under 500 KB</p>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Initials fallback</label>
                    <input
                      value={form.logoInitials || ''}
                      onChange={e => setForm(f => ({ ...f, logoInitials: e.target.value.toUpperCase().slice(0, 4) }))}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center font-bold focus:outline-none focus:border-pink-500"
                      placeholder="ABC"
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Name + Level */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Organization Name *</label>
                <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls2} placeholder="Business name" />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Sponsor Level *</label>
                <select value={form.level || 'Silver'} onChange={e => setForm(f => ({ ...f, level: e.target.value as Sponsor['level'] }))}
                  className={inputCls2}>
                  {SPONSOR_TIERS.map(t => (
                    <option key={t.level} value={t.level}>
                      {t.level}{t.minAmount ? ` ($${t.minAmount.toLocaleString()}+)` : ' — goods/services'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Website */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Website URL</label>
              <input value={form.website || ''} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                className={inputCls2} placeholder="https://..." />
            </div>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Contact Name</label>
                <input value={form.contactName || ''} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                  className={inputCls2} placeholder="Full name" />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Contact Email</label>
                <input type="email" value={form.contactEmail || ''} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                  className={inputCls2} placeholder="email@..." />
              </div>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Contact Phone</label>
              <input value={form.contactPhone || ''} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                className={inputCls2} placeholder="(505) 555-0100" />
            </div>

            {/* Amount + payment toggle */}
            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Amount ($)</label>
                <input type="number" min="0" value={form.amount ?? ''}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value ? Number(e.target.value) : undefined }))}
                  className={inputCls2} placeholder="0" />
              </div>
              <div className="pb-0.5">
                <button type="button" onClick={() => setForm(f => ({ ...f, paymentReceived: !f.paymentReceived }))}
                  className="flex items-center gap-3 w-full">
                  <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.paymentReceived ? 'bg-green-500' : 'bg-gray-200'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow mt-0.5 transition-transform ${form.paymentReceived ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className={`text-sm font-bold ${form.paymentReceived ? 'text-green-600' : 'text-gray-500'}`}>
                    {form.paymentReceived ? 'Payment Received' : 'Payment Pending'}
                  </span>
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Internal Notes</label>
              <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-500 resize-none"
                placeholder="Agreements, outstanding asks, relationship notes…" />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button onClick={handleSave} disabled={saving || !form.name}
                className="flex-1 py-3 bg-pink-500 text-white rounded-full font-black text-sm uppercase tracking-widest hover:bg-pink-600 transition-all disabled:opacity-50">
                {saving ? 'Saving…' : isNew ? 'Add Sponsor' : 'Save Changes'}
              </button>
              {!isNew && (
                <button onClick={handleDelete} disabled={deleting}
                  className="px-5 py-3 border-2 border-red-200 text-red-400 rounded-full font-black text-sm hover:bg-red-50 transition-all disabled:opacity-50">
                  {deleting ? '…' : 'Remove'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl">
          <div className="text-center text-gray-400">
            <Users size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm italic">Select a sponsor to edit, or click <strong>+ Add Sponsor</strong></p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

// ── Sponsorship Section ───────────────────────────────────────────────────────
const SponsorshipSection = ({ sponsors, sponsorshipOpen }: { sponsors: Sponsor[]; sponsorshipOpen: boolean }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', org: '', email: '', tier: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const handleInquire = (tier: string) => {
    setForm(f => ({ ...f, tier }));
    setShowForm(true);
    setTimeout(() => document.getElementById('sponsor-inquiry')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await api.post('/api/apply/sponsor', {
        name: form.name, org: form.org, email: form.email,
        notes: `Preferred tier: ${form.tier}. ${form.message}`.trim(),
      });
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  const byLevel = SPONSOR_TIERS.map(t => ({
    ...t,
    activeSponsor: sponsors.filter(s => s.level === t.level),
  })).filter(t => t.activeSponsor.length > 0);

  return (
    <section id="sponsors" className="py-32 px-6 bg-[#F5F4F1]">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="text-center mb-20">
          <p className="text-pink-500 font-black uppercase tracking-[0.3em] text-xs mb-4">Partnership Opportunities</p>
          <h2 className="text-5xl md:text-6xl font-display font-black uppercase tracking-tighter text-gray-900 mb-6">
            {sponsorshipOpen ? 'Become a Sponsor' : 'Our Proud Partners'}
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed text-lg">
            {sponsorshipOpen
              ? 'Connect your brand with the heart of Taos. Support an event that brings joy, visibility, and community across Northern New Mexico.'
              : 'These organizations make Taos Pride possible. We are deeply grateful for their commitment to the LGBTQ+ community of Northern New Mexico.'}
          </p>
        </div>

        {/* Current confirmed sponsors grouped by level */}
        {byLevel.length > 0 && (
          <div className="mb-24 space-y-10">
            {byLevel.map(tier => (
              <div key={tier.level}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: TIER_COLORS[tier.level] }} />
                  <span className="font-black uppercase tracking-widest text-sm text-gray-500">{tier.level} Sponsors</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div className={`grid gap-4 ${tier.level === 'Platinum' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
                  {tier.activeSponsor.map(s => (
                    <motion.div
                      key={s.name}
                      whileHover={{ y: -3 }}
                      className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 border border-gray-100 shadow-sm"
                    >
                      {s.logoUrl ? (
                        <img src={s.logoUrl} alt={s.name}
                          className="w-16 h-16 object-contain rounded-xl bg-gray-50 p-1 border border-gray-100" />
                      ) : (
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center font-black text-white text-sm"
                          style={{ background: TIER_COLORS[s.level] }}
                        >
                          {s.logoInitials || s.name.slice(0, 3).toUpperCase()}
                        </div>
                      )}
                      <div className="text-center">
                        <p className="font-black text-gray-900 text-sm">{s.name}</p>
                        {s.website && (
                          <a href={s.website} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-pink-500 hover:underline flex items-center gap-1 justify-center mt-1">
                            Visit <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sponsorship tier cards */}
        {sponsorshipOpen && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {SPONSOR_TIERS.map(tier => (
                <motion.div
                  key={tier.level}
                  whileHover={{ y: -4 }}
                  className={`relative rounded-3xl p-8 border-2 transition-all flex flex-col ${
                    tier.highlight
                      ? 'bg-gray-900 border-gray-900 text-white'
                      : 'bg-white border-gray-100 hover:border-gray-300'
                  }`}
                >
                  {tier.highlight && (
                    <div className="absolute -top-3 left-6 bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                      Most Impactful
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div
                        className="inline-block px-3 py-1 rounded-full text-white text-xs font-black uppercase tracking-wider mb-3"
                        style={{ background: TIER_COLORS[tier.level] }}
                      >
                        {tier.level}
                      </div>
                      <p className={`text-sm ${tier.highlight ? 'text-white/60' : 'text-gray-400'}`}>{tier.tagline}</p>
                    </div>
                    <div className="text-right">
                      {tier.minAmount ? (
                        <>
                          <span className={`text-3xl font-black ${tier.highlight ? 'text-white' : 'text-gray-900'}`}>
                            ${tier.minAmount.toLocaleString()}
                          </span>
                          <span className={`text-xs block ${tier.highlight ? 'text-white/40' : 'text-gray-400'}`}>minimum</span>
                        </>
                      ) : (
                        <span className={`text-xl font-black ${tier.highlight ? 'text-white' : 'text-gray-900'}`}>In-Kind</span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-2.5 mb-8 flex-1">
                    {tier.benefits.map((b, i) => (
                      <li key={i} className={`flex items-start gap-2 text-sm ${tier.highlight ? 'text-white/80' : 'text-gray-600'}`}>
                        <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" style={{ color: TIER_COLORS[tier.level] }} />
                        {b}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleInquire(tier.level)}
                    className={`w-full py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                      tier.highlight
                        ? 'bg-purple-600 text-white hover:bg-purple-500'
                        : 'bg-gray-900 text-white hover:bg-gray-700'
                    }`}
                  >
                    Inquire About {tier.level}
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Inquiry form */}
            <AnimatePresence>
              {showForm && (
                <motion.div
                  id="sponsor-inquiry"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="bg-white rounded-3xl border-2 border-gray-200 p-10 max-w-2xl mx-auto shadow-xl"
                >
                  {status === 'done' ? (
                    <div className="text-center py-8">
                      <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
                      <h3 className="text-2xl font-black text-gray-900 mb-2">Inquiry Received!</h3>
                      <p className="text-gray-500">We'll reach out to {form.email} within a few business days.</p>
                      <button onClick={() => { setStatus('idle'); setShowForm(false); }}
                        className="mt-6 text-pink-500 text-sm font-bold hover:underline">
                        Close
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-8">
                        <div>
                          <h3 className="text-2xl font-black text-gray-900">Sponsorship Inquiry</h3>
                          <p className="text-gray-400 text-sm mt-1">We'll reach out within 2–3 business days with a full package.</p>
                        </div>
                        <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 mt-1">
                          <X size={20} />
                        </button>
                      </div>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Your Name *</label>
                            <input required value={form.name}
                              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-pink-500"
                              placeholder="Full name" />
                          </div>
                          <div>
                            <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Organization *</label>
                            <input required value={form.org}
                              onChange={e => setForm(f => ({ ...f, org: e.target.value }))}
                              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-pink-500"
                              placeholder="Business or org name" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Email *</label>
                          <input required type="email" value={form.email}
                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-pink-500"
                            placeholder="you@yourbusiness.com" />
                        </div>
                        <div>
                          <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Sponsorship Level</label>
                          <select value={form.tier}
                            onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-pink-500 bg-white">
                            <option value="">— Select a tier —</option>
                            {SPONSOR_TIERS.map(t => (
                              <option key={t.level} value={t.level}>
                                {t.level}{t.minAmount ? ` ($${t.minAmount.toLocaleString()}+)` : ' (goods/services)'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-1">Message (optional)</label>
                          <textarea value={form.message}
                            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                            rows={3}
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-pink-500 resize-none"
                            placeholder="Questions, in-kind offer details, or anything else..." />
                        </div>
                        {status === 'error' && (
                          <p className="text-red-500 text-sm">Something went wrong — email us at <a href="mailto:info@taospride.org" className="underline">info@taospride.org</a></p>
                        )}
                        <button type="submit" disabled={status === 'sending'}
                          className="w-full py-4 bg-pink-500 text-white rounded-full font-black uppercase tracking-widest hover:bg-pink-600 transition-all disabled:opacity-50">
                          {status === 'sending' ? 'Sending…' : 'Send Inquiry'}
                        </button>
                      </form>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {!showForm && (
              <p className="text-center text-gray-400 text-sm mt-4">
                Questions? Email <a href="mailto:info@taospride.org" className="text-pink-500 hover:underline">info@taospride.org</a>
              </p>
            )}
          </>
        )}

        {/* Sponsorship closed: small nudge instead of the full pitch. Phrased
            generically (not "future events") since this is independent of
            phase now — sponsorship could be closed for a still-upcoming event. */}
        {!sponsorshipOpen && (
          <div className="text-center mt-12">
            <p className="text-gray-400 text-sm">
              Interested in sponsoring Taos Pride?{' '}
              <a href="mailto:info@taospride.org" className="text-pink-500 hover:underline font-bold">Get in touch →</a>
            </p>
          </div>
        )}

      </div>
    </section>
  );
};

// ── Contribution Section ──────────────────────────────────────────────────────
const ContributionSection = () => {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'paypal' | 'venmo' | 'check'>('paypal');
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const successRef = React.useRef<HTMLDivElement>(null);

  const finalAmount = selectedAmount ?? (customAmount ? parseInt(customAmount, 10) : 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await api.post('/api/contribute', { ...form, amount: finalAmount, method: payMethod });
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    if (status === 'done') {
      setTimeout(() => successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    }
  }, [status]);

  return (
    <section id="contribute" className="py-32 bg-[#151619] relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-yellow-500 to-blue-500 mix-blend-color" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-pink-500 font-black uppercase tracking-[0.3em] text-xs mb-4">Individual Giving</p>
          <h2 className="text-5xl md:text-6xl font-display font-black uppercase tracking-tighter text-white mb-6">
            FUEL PRIDE
          </h2>
          <p className="text-white/60 max-w-xl mx-auto leading-relaxed text-lg">
            Every dollar keeps Taos Pride free, accessible, and alive. 100% of contributions go directly to event costs.
          </p>
        </div>

        {/* Impact amount selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
          {CONTRIBUTION_IMPACTS.map(item => (
            <motion.button
              key={item.amount}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setSelectedAmount(item.amount); setCustomAmount(''); }}
              className={`rounded-2xl p-4 text-left border-2 transition-all ${
                selectedAmount === item.amount
                  ? 'bg-pink-500 border-pink-500 text-white'
                  : 'bg-white/5 border-white/10 text-white/80 hover:border-white/30'
              }`}
            >
              <div className="text-2xl font-black mb-1">{item.label}</div>
              <div className={`text-xs leading-snug ${selectedAmount === item.amount ? 'text-white/80' : 'text-white/40'}`}>
                {item.blurb}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Custom amount */}
        <div className="flex items-center gap-4 mb-16 max-w-xs">
          <span className="text-white/40 font-black">or</span>
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-black text-sm">$</span>
            <input
              type="number"
              min="1"
              placeholder="Custom amount"
              value={customAmount}
              onChange={e => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
              className="w-full bg-white/10 border-2 border-white/20 rounded-full pl-8 pr-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-pink-500"
            />
          </div>
        </div>

        {/* Full-width success state */}
        <AnimatePresence>
          {status === 'done' && (
            <motion.div
              ref={successRef}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="mb-16 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-12 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                className="w-24 h-24 bg-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-pink-500/40"
              >
                <Heart size={44} fill="currentColor" className="text-white" />
              </motion.div>
              <h3 className="text-white font-black text-4xl uppercase tracking-tighter mb-3">Thank You{form.name ? `, ${form.name.split(' ')[0]}` : ''}!</h3>
              <p className="text-white/60 text-lg max-w-md mx-auto leading-relaxed mb-2">
                Your generosity makes Taos Pride possible. We'll send a confirmation to
              </p>
              <p className="text-pink-400 font-bold text-lg mb-8">{form.email}</p>
              {finalAmount > 0 && (
                <div className="inline-flex items-center gap-2 bg-white/10 rounded-2xl px-6 py-3 mb-8">
                  <span className="text-white/50 text-sm font-bold uppercase tracking-widest">Gift amount</span>
                  <span className="text-pink-400 font-black text-2xl">${finalAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="block">
                <button
                  onClick={() => { setStatus('idle'); setForm({ name: '', email: '', message: '' }); setSelectedAmount(null); setCustomAmount(''); }}
                  className="text-white/40 text-sm hover:text-white/70 transition-colors underline underline-offset-4"
                >
                  Make another gift
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Payment methods + notify form */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${status === 'done' ? 'hidden' : ''}`}>

          {/* Payment methods */}
          <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-8">
            <h3 className="text-white font-black text-xl mb-6">How to Give</h3>

            {/* Method tabs */}
            <div className="flex gap-1 mb-8 p-1 bg-white/5 rounded-full">
              {(['paypal', 'venmo', 'check'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={`flex-1 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                    payMethod === m ? 'bg-pink-500 text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {m === 'paypal' ? 'PayPal' : m === 'venmo' ? 'Venmo' : 'Check'}
                </button>
              ))}
            </div>

            {payMethod === 'paypal' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-[#003087] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-black text-2xl italic">P</span>
                </div>
                <p className="text-white/60 text-sm mb-2">Send to our PayPal account.</p>
                <p className="text-white/30 text-xs mb-6">Select "Friends &amp; Family" to avoid transaction fees.</p>
                <a
                  href="https://paypal.me/taospride"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#0070BA] text-white px-8 py-3 rounded-full font-black text-sm uppercase tracking-widest hover:bg-[#005ea6] transition-all"
                >
                  PayPal.me/TaosPride <ExternalLink size={14} />
                </a>
                {finalAmount > 0 && (
                  <p className="text-white/30 text-xs mt-5">You selected: <span className="text-pink-400 font-black">${finalAmount.toLocaleString()}</span></p>
                )}
              </div>
            )}

            {payMethod === 'venmo' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-[#008CFF] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-black text-xl">V</span>
                </div>
                <p className="text-white/60 text-sm mb-1">Search <strong className="text-white">@TaosPride</strong> in Venmo.</p>
                <p className="text-white/30 text-xs mb-6">Add your name in the memo so we can thank you!</p>
                <div className="bg-white/10 rounded-2xl p-5 font-mono text-center">
                  <span className="text-white text-xl font-black">@TaosPride</span>
                  {finalAmount > 0 && (
                    <p className="text-pink-400 font-black mt-2">${finalAmount.toLocaleString()}</p>
                  )}
                </div>
              </div>
            )}

            {payMethod === 'check' && (
              <div className="py-4">
                <p className="text-white/60 text-sm mb-4">
                  Make check payable to <strong className="text-white">Taos Pride</strong> and mail to:
                </p>
                <div className="bg-white/10 rounded-2xl p-5 font-mono text-white/70 text-sm leading-8">
                  Taos Pride<br />
                  PO Box 0000<br />
                  Taos, NM 87571
                </div>
                <p className="text-white/30 text-xs mt-4">Include your email so we can send a receipt.</p>
                {finalAmount > 0 && (
                  <p className="text-white/30 text-xs mt-2">Amount: <span className="text-pink-400 font-black">${finalAmount.toLocaleString()}</span></p>
                )}
              </div>
            )}
          </div>

          {/* Notify us form */}
          <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-8">
            <h3 className="text-white font-black text-xl mb-1">Let Us Know</h3>
            <p className="text-white/40 text-sm mb-6">
              After sending your gift, fill this out so we can thank you and send a receipt.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-white/40 text-xs font-black uppercase tracking-widest block mb-1">Your Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white/10 border-2 border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-pink-500"
                  placeholder="Full name" />
              </div>
              <div>
                <label className="text-white/40 text-xs font-black uppercase tracking-widest block mb-1">Email *</label>
                <input
                  required type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-white/10 border-2 border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-pink-500"
                  placeholder="your@email.com" />
              </div>
              <div>
                <label className="text-white/40 text-xs font-black uppercase tracking-widest block mb-1">Note (optional)</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  rows={3}
                  className="w-full bg-white/10 border-2 border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-pink-500 resize-none"
                  placeholder="Dedicate your gift or leave a message of support…" />
              </div>
              {status === 'error' && (
                <p className="text-red-400 text-sm">Something went wrong — email <a href="mailto:info@taospride.org" className="underline">info@taospride.org</a></p>
              )}
              <button type="submit" disabled={status === 'sending' || !form.email}
                className="w-full py-4 bg-pink-500 text-white rounded-full font-black uppercase tracking-widest hover:bg-pink-600 transition-all shadow-xl shadow-pink-500/20 disabled:opacity-50">
                {status === 'sending' ? 'Sending…' : 'Notify Us of My Gift'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default function App() {
  const [phase, setPhase] = useState<SitePhase>('PLANNING');
  const [isManageMode, setIsManageMode] = useState(false);
  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem('tp_admin') === '1');
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');
  const [activeDetailEvent, setActiveDetailEvent] = useState<EventData | null>(null);

  // Dynamic Data States
  const [events, setEvents] = useState<EventData[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [heroSettings, setHeroSettings] = useState<HeroSettings>(HERO_DEFAULTS);
  const [participationConfigs, setParticipationConfigs] = useState<Record<ParticipationTypeKey, ParticipationConfig>>(PARTICIPATION_DEFAULTS);
  // Independent of `phase` on purpose — these used to be inferred from the
  // phase (Meetings hid at LIVE_EVENT, Sponsors switched to thank-you framing
  // at LIVE_EVENT), which broke when reality didn't match the assumption
  // (still recruiting sponsors after going live; still holding public
  // meetings after going live). Both default to "on" until explicitly
  // turned off, regardless of phase.
  const [showMeetings, setShowMeetings] = useState(true);
  const [sponsorshipOpen, setSponsorshipOpen] = useState(true);

  useEffect(() => {
    const handleHash = () => setIsManageMode(window.location.hash === '#manage');
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const fetchData = async () => {
    try {
      const [dataE, dataM, dataS, dataP, settings] = await Promise.all([
        api.get('/api/events'),
        api.get('/api/meetings'),
        api.get('/api/sponsors'),
        api.get('/api/photos'),
        api.get('/api/settings'),
      ]);

      setEvents(dataE.length ? dataE : [
        { id: '1', title: 'Film Fest', status: 'TBD', iconKey: 'Camera', color: '#9C27B0' },
        { id: '2', title: 'Plaza Pride', status: 'TBD', iconKey: 'Globe', color: '#E91E63' },
        { id: '3', title: 'Drag Show', status: 'TBD', iconKey: 'Music', color: '#FF5722' }
      ]);
      setMeetings(dataM.length ? dataM : [
        { id: 'm1', date: 'Date TBD', time: '6:30 PM', location: 'Meeting Room', whoIsInvited: 'Everyone' }
      ]);
      setSponsors(dataS.length ? dataS : [
        { name: 'Taos Ski Valley', level: 'Platinum', logoInitials: 'TSV' }
      ]);
      setAlbums(dataP || []);

      if (settings?.phase) setPhase(settings.phase as SitePhase);
      setShowMeetings(settings?.show_meetings_section !== '0');
      setSponsorshipOpen(settings?.sponsorship_open !== '0');

      // Extract hero settings from flat settings map
      const readPhase = (slug: string, defaults: HeroPhaseConfig): HeroPhaseConfig => ({
        image:    settings?.[`hero_${slug}_image`]    ?? defaults.image,
        line1:    settings?.[`hero_${slug}_line1`]    ?? defaults.line1,
        line2:    settings?.[`hero_${slug}_line2`]    ?? defaults.line2,
        sub:      settings?.[`hero_${slug}_sub`]      ?? defaults.sub,
        ctaLabel: settings?.[`hero_${slug}_ctaLabel`] ?? defaults.ctaLabel,
        ctaHref:  settings?.[`hero_${slug}_ctaHref`]  ?? defaults.ctaHref,
      });
      setHeroSettings({
        planning:      readPhase('planning', HERO_DEFAULTS.planning),
        activePlanning: readPhase('active',  HERO_DEFAULTS.activePlanning),
        liveEvent:     readPhase('live',     HERO_DEFAULTS.liveEvent),
      });

      const parsedConfigs = { ...PARTICIPATION_DEFAULTS };
      for (const key of PARTICIPATION_KEYS) {
        const raw = settings?.[`participate_${key}`];
        if (raw) {
          try { parsedConfigs[key] = { ...PARTICIPATION_DEFAULTS[key], ...JSON.parse(raw) }; } catch {}
        }
      }
      setParticipationConfigs(parsedConfigs);
    } catch (e) {
      console.error("Fetch failed", e);
    }
  };

  useEffect(() => {
    fetchData();
    if (sessionStorage.getItem('tp_admin') === '1') {
      api.get('/api/auth/check').then(r => {
        if (!r.authenticated) {
          sessionStorage.removeItem('tp_admin');
          setIsAuthed(false);
        }
      }).catch(() => {});
    }
  }, []);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await api.post('/api/auth/login', { password });
      if (result.success) {
        sessionStorage.setItem('tp_admin', '1');
        setIsAuthed(true);
      } else {
        alert("Invalid password");
      }
    } catch {
      alert("Unable to sign in. Please try again.");
    }
  };

  const visibleParticipationKeys = PARTICIPATION_KEYS.filter(k => participationConfigs[k].visible);

  // Events without a sort date are always "upcoming" (nothing to judge them
  // against — they're TBD, not expired). String comparison works fine since
  // eventDateSort is always an ISO YYYY-MM-DD, which sorts lexicographically
  // the same as chronologically.
  //
  // Deliberately NOT `new Date().toISOString()` — that's UTC, and Taos is
  // UTC-6/-7. From roughly mid-afternoon Mountain Time onward, the UTC
  // calendar date has already rolled to tomorrow, which would flip today's
  // events into "past" while they're still hours from happening. Use the
  // visitor's local date components instead.
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const upcomingEvents = events.filter(e => !e.eventDateSort || e.eventDateSort >= todayIso);
  const pastEvents     = events.filter(e => e.eventDateSort && e.eventDateSort < todayIso);

  const [activeFormType, setActiveFormType] = useState<string | null>(null);
  const [activeMeetingAgenda, setActiveMeetingAgenda] = useState<Meeting | null>(null);

  if (isManageMode) {
    if (!isAuthed) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-xl p-10">
            <div className="flex items-center gap-3 mb-8">
              <img src="/TaosPrideLogo.png" alt="Taos Pride" className="h-12 w-12 object-contain" />
              <div>
                <h1 className="text-lg font-black text-gray-900">Taos Pride Admin</h1>
                <p className="text-xs text-gray-400">Management portal</p>
              </div>
            </div>
            <form onSubmit={handleAdminAuth}>
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-2">Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-5 outline-none focus:border-pink-500 text-sm font-medium transition-colors"
              />
              <button
                type="submit"
                className="w-full bg-pink-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-pink-600 transition-colors"
              >
                Sign In
              </button>
            </form>
            <a href="#" className="block text-center mt-5 text-xs text-gray-400 hover:text-gray-600 transition-colors">← Return to public site</a>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans overflow-x-hidden">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <img src="/TaosPrideLogo.png" alt="Taos Pride" className="h-10 w-10 object-contain flex-shrink-0" />
              <div>
                <h1 className="text-xl font-black text-gray-900">Taos Pride <span className="text-pink-500">Admin</span></h1>
                <p className="text-xs text-gray-400">Event Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Phase switcher */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-2">Site Phase:</span>
                {(['PLANNING','ACTIVE_PLANNING','LIVE_EVENT'] as SitePhase[]).map(p => (
                  <button
                    key={p}
                    onClick={() => { setPhase(p); api.post('/api/settings', { phase: p }); }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      phase === p ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {p === 'PLANNING' ? 'Planning' : p === 'ACTIVE_PLANNING' ? 'Active' : 'Live'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { sessionStorage.removeItem('tp_admin'); setIsAuthed(false); api.post('/api/auth/logout', {}); }}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors shadow-sm"
              >
                Sign Out
              </button>
            </div>
          </header>

          {/* Tab bar */}
          <AdminTabBar active={adminTab} onChange={setAdminTab} />

          {/* Tab content */}
          {adminTab === 'overview' && (
            <AdminDashboard events={events} meetings={meetings} sponsors={sponsors} />
          )}

          {adminTab === 'events' && (
            <EventsTab events={events} onRefresh={fetchData} />
          )}

          {adminTab === 'meetings' && (
            <MeetingsTab meetings={meetings} onRefresh={fetchData} />
          )}

          {adminTab === 'applications' && (
            <ApplicationsViewer />
          )}

          {adminTab === 'sponsors' && (
            <SponsorsAdmin sponsors={sponsors} onRefresh={fetchData} />
          )}

          {adminTab === 'photos' && (
            <PhotosAdmin albums={albums} events={events} onRefresh={fetchData} />
          )}

          {adminTab === 'comms' && (
            <CommunicationsAdmin />
          )}

          {adminTab === 'hero' && (
            <HeroEditor initial={heroSettings} onSaved={setHeroSettings} />
          )}

          {adminTab === 'participation' && (
            <ParticipationAdmin initial={participationConfigs} onSaved={setParticipationConfigs} />
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-gray-900 font-sans selection:bg-pink-200 selection:text-pink-900 pb-20">
      <Navbar phase={phase} />
      
      {activeFormType && (
        <ParticipationForm
          type={activeFormType}
          config={participationConfigs[activeFormType as ParticipationTypeKey] ?? PARTICIPATION_DEFAULTS.volunteer}
          onClose={() => setActiveFormType(null)}
        />
      )}
      <AnimatePresence>
        {activeDetailEvent && <EventDetailModal event={activeDetailEvent} onClose={() => setActiveDetailEvent(null)} />}
        {activeMeetingAgenda && <MeetingAgendaModal meeting={activeMeetingAgenda} onClose={() => setActiveMeetingAgenda(null)} />}
      </AnimatePresence>

{/* Hero Section */}
      {(() => {
        const hk = phase === 'PLANNING' ? 'planning' : phase === 'ACTIVE_PLANNING' ? 'activePlanning' : 'liveEvent';
        const hc = heroSettings[hk];
        const hd = HERO_DEFAULTS[hk];
        const line1    = hc.line1    || hd.line1;
        const line2    = hc.line2    || hd.line2;
        const sub      = hc.sub      !== undefined ? hc.sub : hd.sub;
        const ctaLabel = hc.ctaLabel || hd.ctaLabel;
        const ctaHref  = hc.ctaHref  || hd.ctaHref;
        const bgImage  = hc.image    || null;

        return (
          <section className="relative h-screen flex items-center justify-center overflow-hidden bg-gray-900">
            <div className="absolute inset-0 z-0">
              {bgImage ? (
                <img src={bgImage} alt="" className="w-full h-full object-cover opacity-60 scale-105" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
            </div>

            <div className="relative z-10 text-center px-6 max-w-5xl">
              <motion.div
                key={phase}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <h1 className="text-6xl md:text-9xl font-display font-black leading-[0.85] tracking-tighter text-white uppercase drop-shadow-2xl">
                  {line1}<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-yellow-500 to-cyan-500">{line2}</span>
                </h1>
                {sub && (
                  <p className="text-white/80 text-2xl font-medium max-w-2xl mx-auto">
                    {sub}
                  </p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="mt-16 flex flex-wrap justify-center gap-4"
              >
                <a
                  href={ctaHref}
                  className="group relative inline-flex items-center gap-3 px-10 py-5 bg-pink-500 text-white rounded-full font-black uppercase tracking-widest hover:scale-105 transition-all shadow-2xl overflow-hidden"
                >
                  {ctaLabel} <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                </a>
                <a
                  href="/gallery"
                  className="px-10 py-5 bg-white/10 backdrop-blur-md text-white rounded-full font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/20"
                >
                  Photo Library
                </a>
              </motion.div>
            </div>

            {/* Floating glow elements */}
            <div className="absolute top-1/4 -left-20 w-64 h-64 bg-pink-500/20 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-blue-500/20 rounded-full blur-[120px] animate-pulse" />
          </section>
        );
      })()}

      {/* Meetings Section — independent "Show Meetings section" toggle (Meetings
          admin tab), not tied to phase. Has its own "no meetings scheduled"
          empty state, so there's no need to auto-hide it based on phase. */}
      {showMeetings && (
        <section id="meetings" className="py-32 px-6 bg-white border-b border-gray-100">
           <div className="max-w-7xl mx-auto">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
               <div className="lg:col-span-1">
                 <h2 className="text-5xl font-display font-black uppercase tracking-tighter mb-6">Planning <br /><span className="text-pink-500 underline decoration-4 underline-offset-8">Meetings</span></h2>
                 <p className="text-gray-500 leading-relaxed mb-8">
                   Our events are built by the community. Join us at our regular sessions to decide on themes, lineups, and logistics.
                 </p>
                 <SuggestionBoxForm />
               </div>
               <div className="lg:col-span-2 space-y-6">
                 {meetings.map((m, idx) => (
                   <motion.div 
                     key={m.id || idx}
                     initial={{ opacity: 0, x: 20 }}
                     whileInView={{ opacity: 1, x: 0 }}
                     viewport={{ once: true }}
                     transition={{ delay: idx * 0.1 }}
                   >
                     <MeetingCard meeting={m} onViewAgenda={setActiveMeetingAgenda} />
                   </motion.div>
                 ))}
                 {meetings.length === 0 && (
                   <div className="p-12 border-2 border-dashed border-gray-100 rounded-3xl text-center text-gray-400 font-medium">
                     No meetings currently scheduled. Check back soon!
                   </div>
                 )}
               </div>
             </div>
           </div>
        </section>
      )}

      {/* Events Section — now a real 3-way split matching the phase's own
          definition (was previously LIVE_EVENT vs. everything else, so
          Planning and Active shared a heading). */}
      <section id="events" className="py-32 px-6 max-w-7xl mx-auto">
        <SectionHeading subtitle={
          phase === 'LIVE_EVENT'      ? "Celebrating our community through art, performance, and joy." :
          phase === 'ACTIVE_PLANNING' ? "Here's a first look at what we're planning — details are still coming together." :
          "The early stages of our vision. Everything starts here."
        }>
          {phase === 'LIVE_EVENT' ? 'Main Events' : phase === 'ACTIVE_PLANNING' ? 'Event Teasers' : 'Save the Date'}
        </SectionHeading>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {upcomingEvents.map((event, idx) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
            >
              <EventCard event={event} phase={phase} onOpen={setActiveDetailEvent} />
            </motion.div>
          ))}
        </div>

        <PastEventsSection events={pastEvents} onOpen={setActiveDetailEvent} />
      </section>

      {/* Participation / Get Involved */}
      <section id="volunteer" className="py-32 bg-gray-50/50 px-6 border-y border-gray-100">
        <div className="max-w-7xl mx-auto">
          <SectionHeading subtitle="Help us make Taos Pride the best one yet. We can't do it without you.">
            GET INVOLVED
          </SectionHeading>

        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${visibleParticipationKeys.length >= 3 ? 'lg:grid-cols-' + visibleParticipationKeys.length : ''}`}>
            {visibleParticipationKeys.map((key, idx) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <ParticipationCard
                  typeKey={key}
                  config={participationConfigs[key]}
                  onOpen={setActiveFormType}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SponsorshipSection sponsors={sponsors} sponsorshipOpen={sponsorshipOpen} />
      <ContributionSection />

      {/* Footer */}
      <footer className="bg-white py-20 px-6 border-t border-gray-100">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <a href="#" className="flex items-center gap-3 mb-6">
              <img src="/TaosPrideLogo.png" alt="Taos Pride" className="h-12 w-12 object-contain" />
              <span className="text-2xl font-black tracking-tighter text-gray-900">
                TAOS <span className="text-pink-500">PRIDE</span>
              </span>
            </a>
            <p className="text-gray-500 max-w-sm mb-8 leading-relaxed">
              Taos Pride is a grassroots community organization dedicated to celebrating, supporting, and empowering LGBTQ+ individuals and their allies in Taos and beyond.
            </p>
            <div className="flex gap-4">
              {[Globe, Mail, Camera].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-pink-50 hover:text-pink-500 transition-colors">
                  <Icon size={20} />
                </a>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-black uppercase tracking-widest text-sm mb-6 text-gray-900">Quick Links</h4>
            <ul className="space-y-4 text-gray-500 font-medium">
              <li><a href="#events" className="hover:text-pink-500 transition-colors">Events & Schedule</a></li>
              <li><a href="#volunteer" className="hover:text-pink-500 transition-colors">Volunteer Opportunities</a></li>
              <li><a href="/gallery" className="hover:text-pink-500 transition-colors">Photo Library</a></li>
              {/* Matches the Meetings section's own showMeetings toggle above —
                  keeps this link in sync with whether the section actually exists. */}
              {showMeetings && (
                <li><a href="#meetings" className="hover:text-pink-500 transition-colors">Meetings & Agendas</a></li>
              )}
            </ul>
          </div>

          <div>
            <h4 className="font-black uppercase tracking-widest text-sm mb-6 text-gray-900">Contact</h4>
            <ul className="space-y-4 text-gray-500 font-medium">
              <li className="flex items-center gap-3"><Mail size={16} className="text-pink-500" /> info@taospride.org</li>
              <li className="flex items-center gap-3"><MapPin size={16} className="text-pink-500" /> Taos, New Mexico</li>
            </ul>
            <NewsletterForm />
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-gray-50 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center text-gray-400 text-sm font-medium">
          <span>&copy; {new Date().getFullYear()} Taos Pride. All rights reserved. Created with ❤️ in Taos.</span>
          <span className="hidden sm:inline text-gray-200">&middot;</span>
          {/* Plain <a>, not an in-page link — /admin is a separate app entry
              point (see main.tsx), so this needs a real navigation. Kept
              small and in the copyright bar deliberately: findable by staff
              who know to look, without reading as a public-facing feature. */}
          <a href="/admin" className="hover:text-pink-500 transition-colors">
            Staff &amp; Board Login
          </a>
        </div>
      </footer>
    </div>
  );
}
