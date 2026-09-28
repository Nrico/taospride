import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Camera, Plus, Trash2, ChevronLeft, Upload, X,
  Eye, EyeOff, Edit2, Save, Star, Images, Calendar, AlertCircle,
  CheckCircle2, Loader2,
} from 'lucide-react';
import { galleryApi, processPhoto } from './galleryApi';

// ============================================================
// Adapted from gallery.taospride.org/src/AdminApp.tsx. The three pages
// (Years/Events/Photos) and the upload-queue logic are carried over
// faithfully — see galleryApi.ts for the API-call/image-URL adaptation.
// What's deliberately different here:
//   - No login screen or auth-check of its own — this only ever renders
//     inside the already-authenticated unified /admin shell.
//   - Navigation is real routes (/admin/gallery/...) via react-router
//     instead of local page-state, so links are bookmarkable/back-button-
//     correct, consistent with the Site and Board sections.
//   - Each page's own full-viewport dark header bar (with its own
//     "Gallery Admin" title + sign-out button) is replaced by a plain
//     breadcrumb row — the unified shell already provides page chrome,
//     the top nav, and sign-out.
// ============================================================

interface AdminYear {
  id: number;
  year: number;
  description?: string;
  visible: boolean;
  eventCount: number;
  photoCount: number;
}

interface AdminEvent {
  id: number;
  yearId: number;
  year: number;
  name: string;
  slug: string;
  description?: string;
  eventDate?: string;
  coverPhotoId?: number;
  visible: boolean;
  photoCount: number;
}

interface AdminPhoto {
  id: number;
  eventId: number;
  filename: string;
  caption?: string;
  width: number;
  height: number;
  fileSize?: number;
  sortOrder: number;
}

interface QueueItem {
  uid: string;
  file: File;
  previewUrl: string;
  fullBlob?: Blob;
  thumbBlob?: Blob;
  fullW?: number;
  fullH?: number;
  caption: string;
  status: 'processing' | 'ready' | 'uploading' | 'done' | 'error';
  error?: string;
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
    </div>
  );
}

const inp = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-pink-500 transition-colors';
const btn = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500';
const btnPrimary = `${btn} bg-pink-600 hover:bg-pink-500 text-white`;
const btnGhost   = `${btn} text-zinc-400 hover:text-white hover:bg-zinc-800`;

function Breadcrumb({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-5 h-12 border-b border-zinc-800 text-sm">
      {children}
    </div>
  );
}

// ── Years Page ────────────────────────────────────────────────────────────────

function YearsPage() {
  const navigate = useNavigate();
  const [years, setYears] = useState<AdminYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newYear, setNewYear] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    galleryApi.get<AdminYear[]>('/years')
      .then(setYears)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const addYear = async (e: React.FormEvent) => {
    e.preventDefault();
    const y = parseInt(newYear, 10);
    if (isNaN(y) || y < 2000 || y > 2100) return;
    setSaving(true);
    try {
      await galleryApi.post('/years', { year: y, description: newDesc || null });
      setNewYear(''); setNewDesc(''); setAdding(false);
      load();
    } catch (err: any) {
      alert('Could not add year: ' + err.message);
    }
    setSaving(false);
  };

  const toggleVisible = async (yr: AdminYear) => {
    try {
      await galleryApi.put(`/years/${yr.id}`, { ...yr, visible: !yr.visible });
      load();
    } catch { alert('Could not update visibility.'); }
  };

  const deleteYear = async (yr: AdminYear) => {
    if (!confirm(`Delete ${yr.year} and ALL its events and photos? This cannot be undone.`)) return;
    try {
      await galleryApi.del(`/years/${yr.id}`);
      load();
    } catch (err: any) { alert('Delete failed: ' + err.message); }
  };

  return (
    <div className="bg-zinc-950 rounded-2xl overflow-hidden">
      <Breadcrumb>
        <Camera className="w-4 h-4 text-pink-400" />
        <span className="text-white font-semibold">Gallery</span>
      </Breadcrumb>

      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-white">Years</h1>
          <button onClick={() => setAdding(true)} className={`${btnPrimary} flex items-center gap-1.5`}>
            <Plus className="w-4 h-4" /> Add Year
          </button>
        </div>

        {adding && (
          <form onSubmit={addYear} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 mb-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="sm:w-28">
                <label className="block text-xs text-zinc-400 mb-1">Year *</label>
                <input
                  type="number" value={newYear} onChange={e => setNewYear(e.target.value)}
                  className={inp} placeholder="2026" min="2000" max="2100" autoFocus required
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-zinc-400 mb-1">Description (optional)</label>
                <input
                  type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  className={inp} placeholder="Taos Pride 2026 highlights"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAdding(false)} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? 'Saving…' : 'Add Year'}
              </button>
            </div>
          </form>
        )}

        {loading && <Spinner />}

        <div className="space-y-2">
          {years.map(yr => (
            <div
              key={yr.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <button
                onClick={() => navigate(`years/${yr.id}`, { state: { year: yr.year } })}
                className="flex-1 text-left group"
              >
                <span className="text-white font-bold text-lg group-hover:text-pink-400 transition-colors">
                  {yr.year}
                </span>
                {yr.description && (
                  <span className="text-zinc-500 text-sm ml-2">{yr.description}</span>
                )}
                <div className="text-xs text-zinc-500 mt-0.5 flex gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {yr.eventCount} events
                  </span>
                  <span className="flex items-center gap-1">
                    <Images className="w-3 h-3" /> {yr.photoCount} photos
                  </span>
                </div>
              </button>
              <button
                onClick={() => toggleVisible(yr)}
                className={`w-11 h-11 flex items-center justify-center rounded-lg transition-colors ${yr.visible ? 'text-green-400 hover:text-green-300' : 'text-zinc-600 hover:text-zinc-400'}`}
                title={yr.visible ? 'Visible — tap to hide' : 'Hidden — tap to show'}
              >
                {yr.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => deleteYear(yr)}
                className="w-11 h-11 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 transition-colors"
                title="Delete year"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {!loading && years.length === 0 && (
            <p className="text-center text-zinc-600 text-sm py-10">
              No years yet — add one to get started.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Events Page ───────────────────────────────────────────────────────────────

function EventsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { yearId: yearIdParam } = useParams();
  const yearId = Number(yearIdParam);
  // Cosmetic-only: the year number is for display and the back-link label.
  // Passed via navigation state on the common in-app path; falls back to
  // just omitting the label on a cold deep link (functionally everything
  // here only needs yearId, which comes from the URL either way).
  const year: number | undefined = (location.state as any)?.year;

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const toSlug = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const load = useCallback(() => {
    galleryApi.get<AdminEvent[]>(`/events?yearId=${yearId}`)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [yearId]);

  useEffect(() => { load(); }, [load]);

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await galleryApi.post('/events', {
        yearId,
        name: newName.trim(),
        slug: toSlug(newName),
        eventDate: newDate || null,
        description: newDesc || null,
      });
      setNewName(''); setNewDate(''); setNewDesc(''); setAdding(false);
      load();
    } catch (err: any) {
      alert('Could not add event: ' + err.message);
    }
    setSaving(false);
  };

  const toggleVisible = async (ev: AdminEvent) => {
    try {
      await galleryApi.put(`/events/${ev.id}`, { ...ev, visible: !ev.visible });
      load();
    } catch { alert('Could not update visibility.'); }
  };

  const deleteEvent = async (ev: AdminEvent) => {
    if (!confirm(`Delete "${ev.name}" and all its photos? This cannot be undone.`)) return;
    try {
      await galleryApi.del(`/events/${ev.id}`);
      load();
    } catch (err: any) { alert('Delete failed: ' + err.message); }
  };

  return (
    <div className="bg-zinc-950 rounded-2xl overflow-hidden">
      <Breadcrumb>
        <button onClick={() => navigate('/gallery')} className={`${btnGhost} !px-2 !py-1 flex items-center gap-1`}>
          <ChevronLeft className="w-4 h-4" /> Years
        </button>
        <span className="text-zinc-600">/</span>
        <span className="text-white font-semibold">{year ?? `Year #${yearId}`}</span>
      </Breadcrumb>

      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-white">Events{year ? ` — ${year}` : ''}</h1>
          <button onClick={() => setAdding(true)} className={`${btnPrimary} flex items-center gap-1.5`}>
            <Plus className="w-4 h-4" /> Add Event
          </button>
        </div>

        {adding && (
          <form onSubmit={addEvent} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 mb-4 space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Event Name *</label>
              <input
                type="text" value={newName} onChange={e => setNewName(e.target.value)}
                className={inp} placeholder="e.g. Pride in the Park" autoFocus required
              />
              {newName && (
                <p className="text-xs text-zinc-500 mt-1">
                  URL slug: <span className="text-zinc-400 font-mono">{toSlug(newName)}</span>
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="sm:w-44">
                <label className="block text-xs text-zinc-400 mb-1">Date (optional)</label>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className={inp} />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-zinc-400 mb-1">Description (optional)</label>
                <input
                  type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  className={inp} placeholder="Brief description"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAdding(false)} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? 'Saving…' : 'Add Event'}
              </button>
            </div>
          </form>
        )}

        {loading && <Spinner />}

        <div className="space-y-2">
          {events.map(ev => (
            <div
              key={ev.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <button
                onClick={() => navigate(`events/${ev.id}`, { state: { eventName: ev.name, yearId, year } })}
                className="flex-1 text-left group"
              >
                <span className="text-white font-medium group-hover:text-pink-400 transition-colors">
                  {ev.name}
                </span>
                <div className="text-xs text-zinc-500 mt-0.5 flex gap-3">
                  <span className="flex items-center gap-1">
                    <Images className="w-3 h-3" /> {ev.photoCount} photos
                  </span>
                  {ev.eventDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(ev.eventDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => toggleVisible(ev)}
                className={`w-11 h-11 flex items-center justify-center rounded-lg transition-colors ${ev.visible ? 'text-green-400 hover:text-green-300' : 'text-zinc-600 hover:text-zinc-400'}`}
                title={ev.visible ? 'Visible' : 'Hidden'}
              >
                {ev.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => deleteEvent(ev)}
                className="w-11 h-11 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 transition-colors"
                title="Delete event"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {!loading && events.length === 0 && (
            <p className="text-center text-zinc-600 text-sm py-10">
              No events yet — add one above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Photos Page ───────────────────────────────────────────────────────────────

function PhotosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { yearId: yearIdParam, eventId: eventIdParam } = useParams();
  const eventId = Number(eventIdParam);
  const yearId = Number(yearIdParam);
  const state = (location.state as any) || {};
  const eventName: string | undefined = state.eventName;
  const year: number | undefined = state.year;

  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingCaption, setEditingCaption] = useState<number | null>(null);
  const [captionVal, setCaptionVal] = useState('');
  const [coverPhotoId, setCoverPhotoId] = useState<number | undefined>();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(() => {
    galleryApi.get<{ photos: AdminPhoto[]; coverPhotoId?: number }>(`/events/${eventId}/photos`)
      .then(d => { setPhotos(d.photos); setCoverPhotoId(d.coverPhotoId); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  const addFiles = useCallback(async (files: File[]) => {
    const images = files.filter(f => f.type.startsWith('image/'));
    if (images.length === 0) return;

    const newItems: QueueItem[] = images.map(f => ({
      uid: Math.random().toString(36).slice(2),
      file: f,
      previewUrl: URL.createObjectURL(f),
      caption: '',
      status: 'processing',
    }));

    setQueue(q => [...q, ...newItems]);

    for (const item of newItems) {
      try {
        const [full, thumb] = await Promise.all([
          processPhoto(item.file, 1920, 1080, 0.88),
          processPhoto(item.file, 800, 533, 0.78),
        ]);
        setQueue(q => q.map(qi =>
          qi.uid !== item.uid ? qi : {
            ...qi,
            fullBlob: full.blob, thumbBlob: thumb.blob,
            fullW: full.width, fullH: full.height,
            status: 'ready',
          }
        ));
      } catch {
        setQueue(q => q.map(qi =>
          qi.uid !== item.uid ? qi : { ...qi, status: 'error', error: 'Processing failed' }
        ));
      }
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  };

  const removeQueued = (uid: string) => {
    setQueue(q => {
      const item = q.find(i => i.uid === uid);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return q.filter(i => i.uid !== uid);
    });
  };

  const uploadAll = async () => {
    const ready = queue.filter(i => i.status === 'ready');
    if (ready.length === 0) return;
    setUploading(true);

    for (const item of ready) {
      setQueue(q => q.map(qi => qi.uid === item.uid ? { ...qi, status: 'uploading' } : qi));
      try {
        const form = new FormData();
        form.append('full',  item.fullBlob!,  item.file.name);
        form.append('thumb', item.thumbBlob!, item.file.name);
        form.append('width',   String(item.fullW));
        form.append('height',  String(item.fullH));
        form.append('caption', item.caption);
        await galleryApi.upload(`/events/${eventId}/photos`, form);
        setQueue(q => q.map(qi => qi.uid === item.uid ? { ...qi, status: 'done' } : qi));
      } catch (err: any) {
        setQueue(q => q.map(qi =>
          qi.uid === item.uid ? { ...qi, status: 'error', error: err.message } : qi
        ));
      }
    }

    setUploading(false);
    setQueue(q => q.filter(i => i.status !== 'done'));
    loadPhotos();
  };

  const clearDone = () => {
    setQueue(q => {
      q.filter(i => i.status === 'done').forEach(i => URL.revokeObjectURL(i.previewUrl));
      return q.filter(i => i.status !== 'done');
    });
  };

  const deletePhoto = async (photo: AdminPhoto) => {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    try {
      await galleryApi.del(`/photos/${photo.id}`);
      loadPhotos();
    } catch (err: any) { alert('Delete failed: ' + err.message); }
  };

  const setCover = async (photoId: number) => {
    try {
      await galleryApi.put(`/events/${eventId}/cover`, { photoId });
      setCoverPhotoId(photoId);
    } catch { alert('Could not set cover.'); }
  };

  const saveCaption = async (photo: AdminPhoto) => {
    try {
      await galleryApi.put(`/photos/${photo.id}`, { caption: captionVal });
      setPhotos(ps => ps.map(p => p.id === photo.id ? { ...p, caption: captionVal } : p));
      setEditingCaption(null);
    } catch { alert('Could not save caption.'); }
  };

  const readyCount = queue.filter(i => i.status === 'ready').length;
  const processingCount = queue.filter(i => i.status === 'processing').length;

  return (
    <div className="bg-zinc-950 rounded-2xl overflow-hidden">
      <Breadcrumb>
        <button
          onClick={() => navigate(Number.isFinite(yearId) ? `/gallery/years/${yearId}` : '/gallery')}
          className={`${btnGhost} !px-2 !py-1 flex items-center gap-1`}
        >
          <ChevronLeft className="w-4 h-4" /> {year ?? 'Events'}
        </button>
        <span className="text-zinc-600">/</span>
        <span className="text-white font-semibold truncate">{eventName ?? `Event #${eventId}`}</span>
      </Breadcrumb>

      <div className="p-4 sm:p-6 space-y-8">

        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Upload Photos
          </h2>
          <div className="sm:hidden flex gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex flex-col items-center gap-2 py-6 bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-xl text-zinc-300 active:border-pink-500 active:bg-pink-500/5 transition-colors"
            >
              <Camera className="w-8 h-8 text-pink-400" />
              <span className="text-sm font-medium">Camera / Library</span>
              <span className="text-xs text-zinc-500">Tap to select photos</span>
            </button>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`hidden sm:block border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              isDragOver
                ? 'border-pink-500 bg-pink-500/5'
                : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'
            }`}
          >
            <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
            <p className="text-zinc-300 text-sm font-medium">
              Drag photos here, or click to select
            </p>
            <p className="text-zinc-600 text-xs mt-1">
              JPEG, PNG, HEIC — any size, processed to 1920×1080 automatically
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={handleFileInput}
          />

          {queue.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-zinc-400">
                  {readyCount} ready
                  {processingCount > 0 && `, ${processingCount} processing…`}
                </p>
                <div className="flex gap-2">
                  {queue.some(i => i.status === 'done') && (
                    <button onClick={clearDone} className={btnGhost + ' text-sm flex-shrink-0'}>
                      Clear done
                    </button>
                  )}
                  <button
                    onClick={uploadAll}
                    disabled={uploading || readyCount === 0}
                    className={`${btnPrimary} flex-1 sm:flex-none flex items-center justify-center gap-1.5 disabled:opacity-50`}
                  >
                    {uploading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                      : <><Upload className="w-4 h-4" /> Upload {readyCount} photo{readyCount !== 1 ? 's' : ''}</>
                    }
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {queue.map(item => (
                  <div
                    key={item.uid}
                    className="relative bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
                  >
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {item.status !== 'ready' && (
                      <div className={`absolute inset-0 flex items-center justify-center text-xs font-medium ${
                        item.status === 'processing' ? 'bg-black/60 text-zinc-300' :
                        item.status === 'uploading'  ? 'bg-black/60 text-blue-300' :
                        item.status === 'done'       ? 'bg-black/50 text-green-400' :
                        'bg-black/70 text-red-400'
                      }`}>
                        {item.status === 'processing' && <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Processing</>}
                        {item.status === 'uploading'  && <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Uploading</>}
                        {item.status === 'done'       && <><CheckCircle2 className="w-4 h-4 mr-1" /> Done</>}
                        {item.status === 'error'      && <><AlertCircle className="w-4 h-4 mr-1" /> {item.error}</>}
                      </div>
                    )}
                    {item.status === 'ready' && (
                      <input
                        type="text"
                        value={item.caption}
                        onChange={e => setQueue(q => q.map(qi =>
                          qi.uid === item.uid ? { ...qi, caption: e.target.value } : qi
                        ))}
                        placeholder="Caption (optional)"
                        className="w-full bg-zinc-800 text-zinc-200 text-xs px-2 py-1.5 placeholder-zinc-600 focus:outline-none border-t border-zinc-700"
                      />
                    )}
                    {(item.status === 'ready' || item.status === 'error') && (
                      <button
                        onClick={() => removeQueued(item.uid)}
                        className="absolute top-1 right-1 bg-black/70 text-zinc-300 hover:text-white rounded-full w-7 h-7 flex items-center justify-center transition-colors"
                        aria-label="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Photos in this event ({photos.length})
          </h2>
          {loading && <Spinner />}
          {!loading && photos.length === 0 && (
            <p className="text-zinc-600 text-sm text-center py-8">
              No photos yet — upload some above.
            </p>
          )}

          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {photos.map(p => (
                <div
                  key={p.id}
                  className={`relative bg-zinc-900 border rounded-lg overflow-hidden group ${
                    p.id === coverPhotoId ? 'border-yellow-500' : 'border-zinc-800'
                  }`}
                >
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={`/gallery-photos/${p.eventId}/thumb_${p.filename}`}
                      alt={p.caption ?? ''}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {p.id === coverPhotoId && (
                    <div className="absolute top-1 left-1 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded">
                      Cover
                    </div>
                  )}

                  <div className="absolute top-1 right-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setCover(p.id)}
                      className="bg-black/75 text-zinc-300 hover:text-yellow-400 rounded w-8 h-8 flex items-center justify-center transition-colors"
                      title="Set as cover"
                      aria-label="Set as cover photo"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deletePhoto(p)}
                      className="bg-black/75 text-zinc-300 hover:text-red-400 rounded w-8 h-8 flex items-center justify-center transition-colors"
                      title="Delete"
                      aria-label="Delete photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {editingCaption === p.id ? (
                    <div className="flex border-t border-zinc-700">
                      <input
                        type="text"
                        value={captionVal}
                        onChange={e => setCaptionVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveCaption(p);
                          if (e.key === 'Escape') setEditingCaption(null);
                        }}
                        className="flex-1 bg-zinc-800 text-zinc-200 text-xs px-2 py-1.5 focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => saveCaption(p)}
                        className="px-2 bg-pink-600 hover:bg-pink-500 text-white"
                      >
                        <Save className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingCaption(p.id); setCaptionVal(p.caption ?? ''); }}
                      className="w-full text-left border-t border-zinc-800 px-2 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-1 min-h-[36px]"
                    >
                      <Edit2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">{p.caption || 'Add caption…'}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Section root ─────────────────────────────────────────────────────────────

export default function GallerySection() {
  return (
    <Routes>
      <Route index element={<YearsPage />} />
      <Route path="years/:yearId" element={<EventsPage />} />
      <Route path="years/:yearId/events/:eventId" element={<PhotosPage />} />
      <Route path="*" element={<Navigate to="/gallery" replace />} />
    </Routes>
  );
}
