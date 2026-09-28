import React, { useEffect, useState } from 'react';
import {
  BrowserRouter, Routes, Route, Navigate, Link, useLocation,
} from 'react-router-dom';
import {
  LayoutDashboard, Calendar, CalendarDays, ClipboardList, Megaphone,
  Camera, Mail, Image as ImageIcon, Users, LogOut, Shield, Images,
  Briefcase, GitBranch, CheckSquare, FolderOpen, Archive,
} from 'lucide-react';
import { adminApi } from './adminApi';
import AdminLogin from './AdminLogin';
import BoardSection from './board/BoardSection';
import GallerySection from './gallery/GallerySection';

// Reused as-is from the existing #manage admin (App.tsx) — see the export
// comment there. Physically moving these into their own files is tracked
// as later cleanup (plan Phase 2+); for now this is the single source of
// truth for both the legacy #manage path and this new /admin path.
import {
  AdminDashboard, EventsTab, MeetingsTab, ApplicationsViewer, SponsorsAdmin,
  PhotosAdmin, CommunicationsAdmin, HeroEditor, ParticipationAdmin,
  HERO_DEFAULTS, PARTICIPATION_DEFAULTS, PARTICIPATION_KEYS,
} from '../App';
import type {
  SitePhase, EventData, Meeting, Sponsor, PhotoAlbum, HeroSettings,
  ParticipationTypeKey, ParticipationConfig,
} from '../App';

// ============================================================
// Data loading — same shape/endpoints as App.tsx's fetchData(), kept as an
// independent copy for the same reason adminApi.ts is independent of App's
// `api` object (see adminApi.ts comment).
// ============================================================
function useAdminData() {
  const [phase, setPhase] = useState<SitePhase>('PLANNING');
  const [events, setEvents] = useState<EventData[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [heroSettings, setHeroSettings] = useState<HeroSettings>(HERO_DEFAULTS);
  const [participationConfigs, setParticipationConfigs] = useState<Record<ParticipationTypeKey, ParticipationConfig>>(PARTICIPATION_DEFAULTS);

  const refresh = async () => {
    try {
      const [dataE, dataM, dataS, dataP, settings] = await Promise.all([
        adminApi.get('/api/events'),
        adminApi.get('/api/meetings'),
        adminApi.get('/api/sponsors'),
        adminApi.get('/api/photos'),
        adminApi.get('/api/settings'),
      ]);

      setEvents(dataE || []);
      setMeetings(dataM || []);
      setSponsors(dataS || []);
      setAlbums(dataP || []);

      if (settings?.phase) setPhase(settings.phase as SitePhase);

      const readPhase = (slug: string, defaults: HeroSettings['planning']) => ({
        image:    settings?.[`hero_${slug}_image`]    ?? defaults.image,
        line1:    settings?.[`hero_${slug}_line1`]    ?? defaults.line1,
        line2:    settings?.[`hero_${slug}_line2`]    ?? defaults.line2,
        sub:      settings?.[`hero_${slug}_sub`]      ?? defaults.sub,
        ctaLabel: settings?.[`hero_${slug}_ctaLabel`] ?? defaults.ctaLabel,
        ctaHref:  settings?.[`hero_${slug}_ctaHref`]  ?? defaults.ctaHref,
      });
      setHeroSettings({
        planning:       readPhase('planning', HERO_DEFAULTS.planning),
        activePlanning: readPhase('active',   HERO_DEFAULTS.activePlanning),
        liveEvent:      readPhase('live',     HERO_DEFAULTS.liveEvent),
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
      console.error('Admin data fetch failed', e);
    }
  };

  useEffect(() => { refresh(); }, []);

  return {
    phase, setPhase, events, meetings, sponsors, albums,
    heroSettings, setHeroSettings, participationConfigs, setParticipationConfigs,
    refresh,
  };
}

// ============================================================
// Section + tab navigation (Site / Board / Gallery)
// ============================================================
const SITE_TABS = [
  { to: 'overview',      label: 'Overview',       icon: <LayoutDashboard size={15} /> },
  { to: 'events',        label: 'Events',         icon: <Calendar size={15} /> },
  { to: 'meetings',      label: 'Meetings',       icon: <CalendarDays size={15} /> },
  { to: 'applications',  label: 'Applications',   icon: <ClipboardList size={15} /> },
  { to: 'sponsors',      label: 'Sponsors',       icon: <Megaphone size={15} /> },
  { to: 'photo-albums',  label: 'Photo Albums',   icon: <Camera size={15} /> },
  { to: 'comms',         label: 'Communications', icon: <Mail size={15} /> },
  { to: 'hero',          label: 'Hero Banner',    icon: <ImageIcon size={15} /> },
  { to: 'participation', label: 'Get Involved',   icon: <Users size={15} /> },
];

const BOARD_TABS = [
  { to: 'board/members',    label: 'Members',      icon: <Users size={15} /> },
  { to: 'board/positions',  label: 'Positions',    icon: <Briefcase size={15} /> },
  { to: 'board/committees', label: 'Committees',   icon: <GitBranch size={15} /> },
  { to: 'board/duties',     label: 'Tasks',        icon: <CheckSquare size={15} /> },
  { to: 'board/files',      label: 'Documents',    icon: <FolderOpen size={15} /> },
  { to: 'board/vault',      label: 'Secure Vault', icon: <Shield size={15} /> },
  { to: 'board/archive',    label: 'Alumni',       icon: <Archive size={15} /> },
];

function SectionNav() {
  const location = useLocation();
  const section = location.pathname.startsWith('/board') ? 'board'
    : location.pathname.startsWith('/gallery') ? 'gallery' : 'site';
  const tabs = section === 'board' ? BOARD_TABS : section === 'site' ? SITE_TABS : null;

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-1 bg-gray-900 rounded-2xl p-1.5 w-fit mb-4 shadow-sm">
        {[
          { id: 'site',    to: '/overview', label: 'Site',    icon: <LayoutDashboard size={15} /> },
          { id: 'board',   to: '/board',    label: 'Board',   icon: <Shield size={15} /> },
          { id: 'gallery', to: '/gallery',  label: 'Gallery', icon: <Images size={15} /> },
        ].map(s => (
          <Link
            key={s.id}
            to={s.to}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              section === s.id ? 'bg-pink-500 text-white shadow-sm' : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            {s.icon} {s.label}
          </Link>
        ))}
      </div>

      {tabs && (
        <div className="flex flex-wrap gap-1 bg-white border border-gray-200 rounded-2xl p-1.5 w-fit shadow-sm">
          {tabs.map(t => (
            <Link
              key={t.to}
              to={`/${t.to}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                location.pathname === `/${t.to}` ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {t.icon} {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Authenticated shell — header, nav, routed tab content
// ============================================================
function AdminAuthedShell({ onLogout }: { onLogout: () => void }) {
  const data = useAdminData();

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <img src="/TaosPrideLogo.png" alt="Taos Pride" className="h-10 w-10 object-contain flex-shrink-0" />
            <div>
              <h1 className="text-xl font-black text-gray-900">Taos Pride <span className="text-pink-500">Admin</span></h1>
              <p className="text-xs text-gray-400">Site, board &amp; volunteers</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-2">Site Phase:</span>
              {(['PLANNING', 'ACTIVE_PLANNING', 'LIVE_EVENT'] as SitePhase[]).map(p => (
                <button
                  key={p}
                  onClick={() => { data.setPhase(p); adminApi.post('/api/settings', { phase: p }); }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    data.phase === p ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {p === 'PLANNING' ? 'Planning' : p === 'ACTIVE_PLANNING' ? 'Active' : 'Live'}
                </button>
              ))}
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors shadow-sm"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </header>

        <SectionNav />

        <Routes>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminDashboard events={data.events} meetings={data.meetings} sponsors={data.sponsors} />} />
          <Route path="events" element={<EventsTab events={data.events} onRefresh={data.refresh} />} />
          <Route path="meetings" element={<MeetingsTab meetings={data.meetings} onRefresh={data.refresh} />} />
          <Route path="applications" element={<ApplicationsViewer />} />
          <Route path="sponsors" element={<SponsorsAdmin sponsors={data.sponsors} onRefresh={data.refresh} />} />
          <Route path="photo-albums" element={<PhotosAdmin albums={data.albums} events={data.events} onRefresh={data.refresh} />} />
          <Route path="comms" element={<CommunicationsAdmin />} />
          <Route path="hero" element={<HeroEditor initial={data.heroSettings} onSaved={data.setHeroSettings} />} />
          <Route path="participation" element={<ParticipationAdmin initial={data.participationConfigs} onSaved={data.setParticipationConfigs} />} />
          <Route path="board/*" element={<BoardSection />} />
          <Route path="gallery/*" element={<GallerySection />} />
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Routes>
      </div>
    </div>
  );
}

// ============================================================
// Root — session bootstrap, then router
// ============================================================
export default function AdminShell() {
  const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem('tp_admin') === '1');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('tp_admin') === '1') {
      adminApi.get('/api/auth/check')
        .then(r => { if (!r.authenticated) { sessionStorage.removeItem('tp_admin'); setIsAuthed(false); } })
        .catch(() => {})
        .finally(() => setChecked(true));
    } else {
      setChecked(true);
    }
  }, []);

  const handleLogout = async () => {
    sessionStorage.removeItem('tp_admin');
    try { await adminApi.post('/api/auth/logout', {}); } catch {}
    setIsAuthed(false);
  };

  // Avoid a login-screen flash while we're re-validating an existing session.
  if (!checked) return null;

  if (!isAuthed) {
    return <AdminLogin onAuthed={() => setIsAuthed(true)} />;
  }

  return (
    <BrowserRouter basename="/admin">
      <AdminAuthedShell onLogout={handleLogout} />
    </BrowserRouter>
  );
}
