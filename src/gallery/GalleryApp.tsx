import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Camera, Calendar, Images, ChevronLeft, ChevronRight, X,
} from 'lucide-react';

// Adapted from gallery.taospride.org/src/App.tsx as part of merging the
// standalone gallery site into taospride.org (mounted at /gallery/, its
// own build entry — see vite.config.ts and gallery/.htaccess). Only two
// things changed from the original: routes are relative to a /gallery
// base path (see stripBase/navigate below), and image URLs point at
// /gallery-photos/ instead of the old site's own /photos/ root. Everything
// else — components, API calls, lightbox — is unchanged.

// ── Types ─────────────────────────────────────────────────────────────────────

interface GalleryYear {
  id: number;
  year: number;
  description?: string;
  eventCount: number;
  photoCount: number;
  coverThumb?: string;
}

interface GalleryEvent {
  id: number;
  yearId: number;
  year: number;
  name: string;
  slug: string;
  description?: string;
  eventDate?: string;
  photoCount: number;
  coverThumb?: string;
}

interface GalleryPhoto {
  id: number;
  eventId: number;
  filename: string;
  caption?: string;
  width: number;
  height: number;
}

// ── Routing ───────────────────────────────────────────────────────────────────

const BASE = '/gallery';

type Route =
  | { view: 'years' }
  | { view: 'year'; year: number }
  | { view: 'event'; year: number; slug: string };

function stripBase(path: string): string {
  return path.startsWith(BASE) ? path.slice(BASE.length) : path;
}

function parsePath(path: string): Route {
  const parts = stripBase(path).split('/').filter(Boolean);
  if (parts.length === 0) return { view: 'years' };
  const year = parseInt(parts[0], 10);
  if (isNaN(year)) return { view: 'years' };
  if (parts.length === 1) return { view: 'year', year };
  return { view: 'event', year, slug: parts[1] };
}

function useRoute() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const h = () => setPath(window.location.pathname);
    window.addEventListener('popstate', h);
    return () => window.removeEventListener('popstate', h);
  }, []);
  // Callers pass short-form paths ('/', '/2025', '/2025/pride-on-plaza') —
  // the /gallery prefix is an implementation detail of where this app is
  // mounted, not something the view components need to know about.
  const navigate = useCallback((to: string) => {
    const full = BASE + (to === '/' ? '' : to);
    window.history.pushState(null, '', full);
    setPath(full);
    window.scrollTo(0, 0);
  }, []);
  return { route: parsePath(path), navigate };
}

// ── API ───────────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const thumbUrl = (eventId: number, filename: string) =>
  `/gallery-photos/${eventId}/thumb_${filename}`;
const fullUrl = (eventId: number, filename: string) =>
  `/gallery-photos/${eventId}/${filename}`;

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-zinc-700 border-t-pink-500 rounded-full animate-spin" />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center py-24 text-zinc-500 text-sm">
      {msg}
    </div>
  );
}

// ── Top Nav ───────────────────────────────────────────────────────────────────

function TopNav({
  crumbs,
  navigate,
}: {
  crumbs: { label: string; href?: string }[];
  navigate: (p: string) => void;
}) {
  return (
    <header className="sticky top-0 z-30 bg-black/85 backdrop-blur-md border-b border-zinc-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-1.5 text-sm">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-pink-400 font-semibold hover:text-pink-300 transition-colors shrink-0"
        >
          <Camera className="w-4 h-4" />
          Taos Pride
        </button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="text-zinc-600">/</span>
            {c.href && i < crumbs.length - 1 ? (
              <button
                onClick={() => navigate(c.href!)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                {c.label}
              </button>
            ) : (
              <span className="text-zinc-200">{c.label}</span>
            )}
          </span>
        ))}
      </div>
    </header>
  );
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({
  photos,
  index,
  onClose,
  onNav,
}: {
  photos: GalleryPhoto[];
  index: number;
  onClose: () => void;
  onNav: (i: number) => void;
}) {
  const photo = photos[index];
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onNav(index - 1);
      if (e.key === 'ArrowRight' && index < photos.length - 1) onNav(index + 1);
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [index, photos.length, onClose, onNav]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/96 flex items-center justify-center"
      onClick={onClose}
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (dx < -50 && index < photos.length - 1) onNav(index + 1);
        if (dx > 50 && index > 0) onNav(index - 1);
        touchStartX.current = null;
      }}
    >
      {/* Counter */}
      <div className="absolute top-4 left-4 text-zinc-400 text-sm font-mono select-none">
        {index + 1} / {photos.length}
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-zinc-400 hover:text-white w-11 h-11 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Prev arrow — hidden on mobile (swipe instead), visible sm+ */}
      {index > 0 && (
        <button
          onClick={e => { e.stopPropagation(); onNav(index - 1); }}
          className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 items-center justify-center text-zinc-300 hover:text-white bg-black/50 hover:bg-black/80 rounded-full w-12 h-12 transition-colors"
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
      )}

      {/* Photo */}
      <img
        src={fullUrl(photo.eventId, photo.filename)}
        alt={photo.caption ?? ''}
        className="max-w-[95vw] max-h-[85vh] object-contain select-none shadow-2xl"
        onClick={e => e.stopPropagation()}
        draggable={false}
      />

      {/* Next arrow — hidden on mobile (swipe instead), visible sm+ */}
      {index < photos.length - 1 && (
        <button
          onClick={e => { e.stopPropagation(); onNav(index + 1); }}
          className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 items-center justify-center text-zinc-300 hover:text-white bg-black/50 hover:bg-black/80 rounded-full w-12 h-12 transition-colors"
          aria-label="Next photo"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      )}

      {/* Mobile swipe hint — shown briefly at bottom on small screens */}
      <div className="sm:hidden absolute bottom-14 left-1/2 -translate-x-1/2 text-zinc-600 text-xs select-none pointer-events-none">
        ← swipe →
      </div>

      {/* Caption */}
      {photo.caption && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-zinc-200 text-sm text-center max-w-xl px-6 py-2 bg-black/70 rounded-lg backdrop-blur-sm">
          {photo.caption}
        </div>
      )}
    </div>
  );
}

// ── YearsView ─────────────────────────────────────────────────────────────────

function YearsView({ navigate }: { navigate: (p: string) => void }) {
  const [years, setYears] = useState<GalleryYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<GalleryYear[]>('/api/years')
      .then(setYears)
      .catch(() => setError('Could not load the gallery. Please try again later.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero */}
      <div className="py-20 px-4 text-center border-b border-zinc-800/60">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Camera className="w-9 h-9 text-pink-500" />
          <h1 className="text-5xl font-black text-white tracking-tight">Taos Pride</h1>
        </div>
        <p className="text-zinc-400 text-xl mt-1">Photo Gallery</p>
        <p className="text-zinc-600 text-sm mt-3">Celebrating our community through the years</p>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        {loading && <Spinner />}
        {error && <ErrorMsg msg={error} />}
        {!loading && !error && years.length === 0 && (
          <ErrorMsg msg="No galleries yet — check back soon!" />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {years.map(y => (
            <button
              key={y.id}
              onClick={() => navigate(`/${y.year}`)}
              className="group relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-pink-500/40 transition-all duration-300 text-left focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <div className="aspect-video overflow-hidden">
                {y.coverThumb ? (
                  <img
                    src={y.coverThumb}
                    alt={`Taos Pride ${y.year}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <Camera className="w-14 h-14 text-zinc-700" />
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="text-5xl font-black text-white leading-none mb-2">{y.year}</div>
                <div className="flex items-center gap-4 text-zinc-300 text-xs">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-pink-400" />
                    {y.eventCount} {y.eventCount === 1 ? 'event' : 'events'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Images className="w-3 h-3 text-pink-400" />
                    {y.photoCount.toLocaleString()} photos
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── YearView ──────────────────────────────────────────────────────────────────

function YearView({ year, navigate }: { year: number; navigate: (p: string) => void }) {
  const [events, setEvents] = useState<GalleryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<GalleryEvent[]>(`/api/years/${year}/events`)
      .then(setEvents)
      .catch(() => setError('Could not load events for this year.'))
      .finally(() => setLoading(false));
  }, [year]);

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    });

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopNav
        crumbs={[{ label: String(year) }]}
        navigate={navigate}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-black text-white mb-1">
          Taos Pride <span className="text-pink-400">{year}</span>
        </h1>
        <p className="text-zinc-500 text-sm mb-10">Select an event to view photos</p>

        {loading && <Spinner />}
        {error && <ErrorMsg msg={error} />}
        {!loading && !error && events.length === 0 && (
          <ErrorMsg msg="No events for this year yet." />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map(ev => (
            <button
              key={ev.id}
              onClick={() => navigate(`/${year}/${ev.slug}`)}
              className="group relative overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 hover:border-pink-500/40 transition-all duration-300 text-left focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <div className="aspect-video overflow-hidden">
                {ev.coverThumb ? (
                  <img
                    src={ev.coverThumb}
                    alt={ev.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <Camera className="w-10 h-10 text-zinc-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="text-white font-bold text-lg leading-tight mb-1">
                  {ev.name}
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Images className="w-3 h-3" />
                    {ev.photoCount} photos
                  </span>
                  {ev.eventDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(ev.eventDate)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── EventView ─────────────────────────────────────────────────────────────────

function EventView({
  year,
  slug,
  navigate,
}: {
  year: number;
  slug: string;
  navigate: (p: string) => void;
}) {
  const [event, setEvent] = useState<GalleryEvent | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lbIndex, setLbIndex] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<GalleryEvent>(`/api/years/${year}/events/${slug}`),
      apiFetch<GalleryPhoto[]>(`/api/years/${year}/events/${slug}/photos`),
    ])
      .then(([ev, ph]) => { setEvent(ev); setPhotos(ph); })
      .catch(() => setError('Could not load photos. Please try again later.'))
      .finally(() => setLoading(false));
  }, [year, slug]);

  const handleNav = useCallback((i: number) => setLbIndex(i), []);
  const handleClose = useCallback(() => setLbIndex(null), []);

  const formatDateLong = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopNav
        crumbs={[
          { label: String(year), href: `/${year}` },
          { label: event?.name ?? slug },
        ]}
        navigate={navigate}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8">
        {loading && <Spinner />}
        {error && <ErrorMsg msg={error} />}

        {event && !loading && !error && (
          <>
            <div className="mb-7 px-1">
              <h1 className="text-2xl font-bold text-white">{event.name}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-1.5 text-sm text-zinc-400">
                {event.eventDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDateLong(event.eventDate)}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Images className="w-3.5 h-3.5" />
                  {photos.length} photos
                </span>
              </div>
              {event.description && (
                <p className="text-zinc-300 text-sm mt-2 max-w-2xl">{event.description}</p>
              )}
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-0.5">
                {photos.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setLbIndex(i)}
                    className="aspect-video overflow-hidden bg-zinc-900 hover:opacity-85 transition-opacity focus:outline-none focus:ring-2 focus:ring-inset focus:ring-pink-500"
                    aria-label={p.caption ?? `Photo ${i + 1}`}
                  >
                    <img
                      src={thumbUrl(p.eventId, p.filename)}
                      alt={p.caption ?? ''}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <ErrorMsg msg="No photos in this event yet." />
            )}
          </>
        )}
      </div>

      {lbIndex !== null && (
        <Lightbox
          photos={photos}
          index={lbIndex}
          onClose={handleClose}
          onNav={handleNav}
        />
      )}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function GalleryApp() {
  const { route, navigate } = useRoute();
  if (route.view === 'year')  return <YearView  year={route.year} navigate={navigate} />;
  if (route.view === 'event') return <EventView year={route.year} slug={route.slug} navigate={navigate} />;
  return <YearsView navigate={navigate} />;
}
