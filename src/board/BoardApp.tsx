import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Briefcase, GitBranch, CheckSquare, Archive,
  LogOut, Plus, X, Edit2, Trash2, ChevronDown, ChevronUp,
  Mail, Phone, User, Save, AlertCircle, Clock, Shield,
  FileText, Download, Upload, FolderOpen, AlertTriangle, ExternalLink, Link,
  Lock, Unlock, Eye, EyeOff, KeyRound, ClipboardList, StickyNote
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BoardMember {
  id: number;
  firstName: string;
  lastName: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  bio?: string;
  photo?: string;
  contactPreference: 'email' | 'phone' | 'either' | 'none';
  active: boolean;
  notes?: string;
}

export interface BoardPosition {
  id: number;
  title: string;
  description?: string;
  isOfficer: boolean;
  sortOrder: number;
}

export interface BoardTerm {
  id: number;
  memberId: number;
  positionId: number;
  positionTitle?: string;
  memberName?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  notes?: string;
}

export interface BoardCommittee {
  id: number;
  name: string;
  description?: string;
  active: boolean;
}

export interface BoardMemberCommittee {
  id: number;
  memberId: number;
  committeeId: number;
  committeeName?: string;
  memberName?: string;
  role: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
}

export interface BoardDuty {
  id: number;
  memberId?: number;
  memberName?: string;
  title: string;
  description?: string;
  status: 'active' | 'completed' | 'delegated' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  dueDate?: string;
  createdAt: string;
}

export interface BoardFile {
  id: number;
  memberId?: number;
  memberName?: string;
  entryType: 'file' | 'link';
  originalName: string;
  mimeType?: string;
  fileSize?: number;
  linkUrl?: string;
  description?: string;
  category: string;
  createdAt: string;
}

interface VaultItem {
  id: number;
  itemType: 'note' | 'link' | 'file';
  title: string;
  content?: string;
  linkUrl?: string;
  originalName?: string;
  mimeType?: string;
  fileSize?: number;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface VaultLogEntry {
  id: number;
  accessedAt: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  action: string;
  itemId?: number;
}

type Tab = 'members' | 'positions' | 'committees' | 'duties' | 'files' | 'vault' | 'archive';

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = '/api/board';

export async function api(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    // Session expired while the portal was open — reload to show login screen
    window.location.reload();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ─── Image compression ────────────────────────────────────────────────────────

const compressImage = (file: File, maxDim = 600, quality = 0.85): Promise<string> =>
  new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target!.result as string);
      reader.readAsDataURL(file);
    };
    img.src = url;
  });

// ─── Helpers ─────────────────────────────────────────────────────────────────

const displayName = (m: BoardMember) =>
  m.preferredName ? `${m.preferredName} ${m.lastName}` : `${m.firstName} ${m.lastName}`;

const priorityColor = (p: BoardDuty['priority']) => ({
  low: 'bg-slate-100 text-slate-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
}[p]);

const statusColor = (s: BoardDuty['status']) => ({
  active: 'bg-green-100 text-green-700',
  completed: 'bg-slate-100 text-slate-500',
  delegated: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-400',
}[s]);

// ─── Modal shell ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className={`bg-white rounded-2xl shadow-2xl my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Login screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('/auth/login', 'POST', { password });
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-3">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Board Portal</h1>
          <p className="text-sm text-slate-500 mt-1">Taos Pride — Members Only</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Access Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter board password"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-indigo-600 text-white rounded-xl py-2.5 font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Checking…' : 'Enter Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Member form ──────────────────────────────────────────────────────────────

function MemberForm({ member, onSave, onCancel }: {
  member?: BoardMember; onSave: (data: Partial<BoardMember>) => Promise<void>; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    firstName: member?.firstName ?? '',
    lastName: member?.lastName ?? '',
    preferredName: member?.preferredName ?? '',
    email: member?.email ?? '',
    phone: member?.phone ?? '',
    bio: member?.bio ?? '',
    photo: member?.photo ?? '',
    contactPreference: member?.contactPreference ?? 'email' as const,
    notes: member?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, 400, 0.85);
    set('photo', compressed);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) { setErr('First and last name required'); return; }
    setSaving(true);
    setErr('');
    try {
      await onSave(form);
    } catch (er: any) {
      setErr(er.message || 'Save failed');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
          <input value={form.firstName} onChange={e => set('firstName', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label>
          <input value={form.lastName} onChange={e => set('lastName', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Preferred Name (if different)</label>
        <input value={form.preferredName} onChange={e => set('preferredName', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Goes by…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
          <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Contact Preference</label>
        <select value={form.contactPreference} onChange={e => set('contactPreference', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="email">Email preferred</option>
          <option value="phone">Phone preferred</option>
          <option value="either">Either</option>
          <option value="none">Do not contact directly</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Bio / Background</label>
        <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Brief bio for roster…" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Internal Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Private notes (board only)…" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Photo</label>
        <div className="flex items-center gap-3">
          {form.photo && <img src={form.photo} className="w-12 h-12 rounded-full object-cover border-2 border-slate-200" />}
          <label className="cursor-pointer text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            {form.photo ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/*" onChange={handlePhoto} className="sr-only" />
          </label>
          {form.photo && <button type="button" onClick={() => set('photo', '')} className="text-sm text-red-400 hover:text-red-600">Remove</button>}
        </div>
      </div>
      {err && <div className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 flex items-center gap-2"><AlertCircle size={14} />{err}</div>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
          <Save size={15} />{saving ? 'Saving…' : 'Save Member'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
      </div>
    </form>
  );
}

// ─── Term form ────────────────────────────────────────────────────────────────

function TermForm({ memberId, positions, term, onSave, onCancel }: {
  memberId: number; positions: BoardPosition[]; term?: BoardTerm;
  onSave: (data: object) => Promise<void>; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    positionId: term?.positionId ?? (positions[0]?.id ?? ''),
    startDate: term?.startDate ?? '',
    endDate: term?.endDate ?? '',
    isCurrent: term?.isCurrent ?? true,
    notes: term?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave({ ...form, memberId }); } finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Position</label>
        <select value={form.positionId} onChange={e => set('positionId', +e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
          <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
          <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={form.isCurrent} onChange={e => set('isCurrent', e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
        Currently active in this position
      </label>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <input value={form.notes} onChange={e => set('notes', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Optional notes…" />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save Term'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
      </div>
    </form>
  );
}

// ─── Duty form ────────────────────────────────────────────────────────────────

function DutyForm({ members, duty, onSave, onCancel }: {
  members: BoardMember[]; duty?: BoardDuty;
  onSave: (data: object) => Promise<void>; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    memberId: duty?.memberId ?? '' as number | '',
    title: duty?.title ?? '',
    description: duty?.description ?? '',
    status: duty?.status ?? 'active' as BoardDuty['status'],
    priority: duty?.priority ?? 'normal' as BoardDuty['priority'],
    dueDate: duty?.dueDate ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try { await onSave({ ...form, memberId: form.memberId || null }); } finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Task Title *</label>
        <input value={form.title} onChange={e => set('title', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="What needs to be done?" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Assigned To</label>
          <select value={form.memberId} onChange={e => set('memberId', e.target.value ? +e.target.value : '')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">— Unassigned —</option>
            {members.map(m => <option key={m.id} value={m.id}>{displayName(m)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
          <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
          <select value={form.priority} onChange={e => set('priority', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="delegated">Delegated</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save Task'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
      </div>
    </form>
  );
}

// ─── Member detail modal ──────────────────────────────────────────────────────

function MemberDetailModal({ member, positions, committees, allTerms, allMemberCommittees, duties, onClose, onUpdate }: {
  member: BoardMember;
  positions: BoardPosition[];
  committees: BoardCommittee[];
  allTerms: BoardTerm[];
  allMemberCommittees: BoardMemberCommittee[];
  duties: BoardDuty[];
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [innerTab, setInnerTab] = useState<'profile' | 'terms' | 'committees' | 'duties'>('profile');
  const [editing, setEditing] = useState(false);
  const [addingTerm, setAddingTerm] = useState(false);
  const [addingCommittee, setAddingCommittee] = useState(false);
  const [addingDuty, setAddingDuty] = useState(false);
  const [editTerm, setEditTerm] = useState<BoardTerm | null>(null);
  const [editDuty, setEditDuty] = useState<BoardDuty | null>(null);
  const [committeeForm, setCommitteeForm] = useState({ committeeId: committees[0]?.id ?? '', role: 'member', startDate: '' });

  const memberTerms = allTerms.filter(t => t.memberId === member.id);
  const memberCommittees = allMemberCommittees.filter(mc => mc.memberId === member.id && mc.active);
  const memberDuties = duties.filter(d => d.memberId === member.id);
  const currentTerm = memberTerms.find(t => t.isCurrent);

  const saveMember = async (data: Partial<BoardMember>) => {
    await api(`/members/${member.id}`, 'PUT', data);
    onUpdate();
    setEditing(false);
  };

  const saveTerm = async (data: object) => {
    if (editTerm) {
      await api(`/terms/${editTerm.id}`, 'PUT', data);
    } else {
      await api(`/members/${member.id}/terms`, 'POST', data);
    }
    onUpdate();
    setAddingTerm(false);
    setEditTerm(null);
  };

  const deleteTerm = async (id: number) => {
    if (!confirm('Remove this term record?')) return;
    await api(`/terms/${id}`, 'DELETE');
    onUpdate();
  };

  const saveCommittee = async (e: React.FormEvent) => {
    e.preventDefault();
    await api(`/members/${member.id}/committees`, 'POST', committeeForm);
    onUpdate();
    setAddingCommittee(false);
  };

  const removeCommittee = async (id: number) => {
    if (!confirm('Remove from committee?')) return;
    await api(`/member_committees/${id}`, 'DELETE');
    onUpdate();
  };

  const saveDuty = async (data: object) => {
    if (editDuty) {
      await api(`/duties/${editDuty.id}`, 'PUT', data);
    } else {
      await api('/duties', 'POST', data);
    }
    onUpdate();
    setAddingDuty(false);
    setEditDuty(null);
  };

  const deleteDuty = async (id: number) => {
    if (!confirm('Delete this task?')) return;
    await api(`/duties/${id}`, 'DELETE');
    onUpdate();
  };

  const deactivate = async () => {
    if (!confirm(`Archive ${displayName(member)}? They will be moved to the archive.`)) return;
    await api(`/members/${member.id}`, 'PUT', { ...member, active: false });
    onUpdate();
    onClose();
  };

  return (
    <Modal title={displayName(member)} onClose={onClose} wide>
      {/* Inner tab bar */}
      <div className="flex gap-1 mb-5 border-b border-slate-100 pb-3">
        {(['profile', 'terms', 'committees', 'duties'] as const).map(t => (
          <button key={t} onClick={() => setInnerTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${innerTab === t ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {innerTab === 'profile' && (
        editing ? (
          <MemberForm member={member} onSave={saveMember} onCancel={() => setEditing(false)} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              {member.photo
                ? <img src={member.photo} className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 shrink-0" />
                : <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl shrink-0">
                    {member.firstName[0]}{member.lastName[0]}
                  </div>
              }
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 text-lg">{displayName(member)}</div>
                {member.preferredName && <div className="text-sm text-slate-500">Legal name: {member.firstName} {member.lastName}</div>}
                {currentTerm && <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium"><Briefcase size={11} />{currentTerm.positionTitle}</div>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {member.email && <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-slate-700 hover:text-indigo-600"><Mail size={14} className="text-slate-400" />{member.email}</a>}
              {member.phone && <a href={`tel:${member.phone}`} className="flex items-center gap-2 text-slate-700 hover:text-indigo-600"><Phone size={14} className="text-slate-400" />{member.phone}</a>}
            </div>
            {member.contactPreference && member.contactPreference !== 'email' && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5">Contact preference: <span className="font-medium">{member.contactPreference}</span></div>
            )}
            {member.bio && <p className="text-sm text-slate-700 leading-relaxed">{member.bio}</p>}
            {member.notes && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm text-amber-800">
                <span className="font-medium text-amber-700">Notes: </span>{member.notes}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
                <Edit2 size={13} />Edit Profile
              </button>
              <button onClick={deactivate} className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors">
                <Archive size={13} />Archive Member
              </button>
            </div>
          </div>
        )
      )}

      {/* Terms tab */}
      {innerTab === 'terms' && (
        <div className="space-y-3">
          {!addingTerm && !editTerm && (
            <button onClick={() => setAddingTerm(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
              <Plus size={14} />Add Term / Position
            </button>
          )}
          {(addingTerm || editTerm) && (
            <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50">
              <h4 className="text-sm font-semibold text-indigo-800 mb-3">{editTerm ? 'Edit Term' : 'Add New Term'}</h4>
              <TermForm memberId={member.id} positions={positions} term={editTerm ?? undefined}
                onSave={saveTerm} onCancel={() => { setAddingTerm(false); setEditTerm(null); }} />
            </div>
          )}
          {memberTerms.length === 0 && !addingTerm && (
            <p className="text-sm text-slate-500 italic">No terms recorded yet.</p>
          )}
          {memberTerms.map(t => (
            <div key={t.id} className={`flex items-start justify-between p-3 rounded-xl border ${t.isCurrent ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
              <div>
                <div className="font-medium text-sm text-slate-800">{t.positionTitle}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {t.startDate || '?'} → {t.isCurrent ? <span className="text-indigo-600 font-medium">Current</span> : (t.endDate || '?')}
                </div>
                {t.notes && <div className="text-xs text-slate-500 mt-1 italic">{t.notes}</div>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditTerm(t); setAddingTerm(false); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"><Edit2 size={13} /></button>
                <button onClick={() => deleteTerm(t.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Committees tab */}
      {innerTab === 'committees' && (
        <div className="space-y-3">
          {!addingCommittee && (
            <button onClick={() => setAddingCommittee(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
              <Plus size={14} />Add to Committee
            </button>
          )}
          {addingCommittee && (
            <form onSubmit={saveCommittee} className="border border-indigo-200 rounded-xl p-4 bg-indigo-50 space-y-3">
              <select value={committeeForm.committeeId} onChange={e => setCommitteeForm(f => ({ ...f, committeeId: +e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input value={committeeForm.role} onChange={e => setCommitteeForm(f => ({ ...f, role: e.target.value }))} placeholder="Role (e.g. Chair, Member)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Add</button>
                <button type="button" onClick={() => setAddingCommittee(false)} className="px-4 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-white transition-colors">Cancel</button>
              </div>
            </form>
          )}
          {memberCommittees.length === 0 && !addingCommittee && (
            <p className="text-sm text-slate-500 italic">Not assigned to any committees.</p>
          )}
          {memberCommittees.map(mc => (
            <div key={mc.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-white">
              <div>
                <div className="font-medium text-sm text-slate-800">{mc.committeeName}</div>
                <div className="text-xs text-slate-500 capitalize">{mc.role}</div>
              </div>
              <button onClick={() => removeCommittee(mc.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Duties tab */}
      {innerTab === 'duties' && (
        <div className="space-y-3">
          {!addingDuty && !editDuty && (
            <button onClick={() => setAddingDuty(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
              <Plus size={14} />Add Task
            </button>
          )}
          {(addingDuty || editDuty) && (
            <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50">
              <DutyForm members={[member]} duty={editDuty ?? undefined} onSave={saveDuty} onCancel={() => { setAddingDuty(false); setEditDuty(null); }} />
            </div>
          )}
          {memberDuties.length === 0 && !addingDuty && (
            <p className="text-sm text-slate-500 italic">No tasks assigned.</p>
          )}
          {memberDuties.filter(d => d.status === 'active').map(d => (
            <div key={d.id} className="flex items-start justify-between p-3 border border-slate-200 rounded-xl bg-white">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-slate-800">{d.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor(d.priority)}`}>{d.priority}</span>
                </div>
                {d.description && <div className="text-xs text-slate-500 mt-0.5">{d.description}</div>}
                {d.dueDate && <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Clock size={10} />Due {d.dueDate}</div>}
              </div>
              <div className="flex gap-1 ml-2">
                <button onClick={() => { setEditDuty(d); setAddingDuty(false); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"><Edit2 size={13} /></button>
                <button onClick={() => deleteDuty(d.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
          {memberDuties.filter(d => d.status !== 'active').length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">Show completed / cancelled tasks</summary>
              <div className="mt-2 space-y-2">
                {memberDuties.filter(d => d.status !== 'active').map(d => (
                  <div key={d.id} className="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl opacity-60">
                    <div>
                      <span className="text-sm text-slate-600 line-through">{d.title}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${statusColor(d.status)}`}>{d.status}</span>
                    </div>
                    <button onClick={() => deleteDuty(d.id)} className="p-1 text-slate-300 hover:text-red-400 rounded-lg transition-colors"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Members tab ──────────────────────────────────────────────────────────────

export function MembersTab({ members, positions, committees, terms, memberCommittees, duties, onUpdate }: {
  members: BoardMember[]; positions: BoardPosition[]; committees: BoardCommittee[];
  terms: BoardTerm[]; memberCommittees: BoardMemberCommittee[]; duties: BoardDuty[];
  onUpdate: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Always derived from the current members array so modal auto-refreshes after edits
  const selected = selectedId !== null ? (members.find(m => m.id === selectedId) ?? null) : null;
  const activeMembers = members.filter(m => m.active);

  const addMember = async (data: Partial<BoardMember>) => {
    await api('/members', 'POST', data);
    onUpdate();
    setAdding(false);
  };

  const getCurrentPosition = (memberId: number) =>
    terms.find(t => t.memberId === memberId && t.isCurrent)?.positionTitle;

  const getCommitteeCount = (memberId: number) =>
    memberCommittees.filter(mc => mc.memberId === memberId && mc.active).length;

  const getActiveDuties = (memberId: number) =>
    duties.filter(d => d.memberId === memberId && d.status === 'active').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Board Members</h2>
          <p className="text-sm text-slate-500">{activeMembers.length} active member{activeMembers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <Plus size={15} />Add Member
        </button>
      </div>

      {activeMembers.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Users size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No active board members yet.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeMembers.map(m => {
          const position = getCurrentPosition(m.id);
          const committeeCount = getCommitteeCount(m.id);
          const activeDuties = getActiveDuties(m.id);
          return (
            <button key={m.id} onClick={() => setSelectedId(m.id)}
              className="text-left p-4 border border-slate-200 rounded-2xl bg-white hover:border-indigo-300 hover:shadow-md transition-all group">
              <div className="flex items-start gap-3">
                {m.photo
                  ? <img src={m.photo} className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 shrink-0" />
                  : <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-base shrink-0">
                      {m.firstName[0]}{m.lastName[0]}
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">{displayName(m)}</div>
                  {position
                    ? <div className="text-xs text-indigo-600 font-medium mt-0.5">{position}</div>
                    : <div className="text-xs text-slate-400 mt-0.5 italic">No position assigned</div>
                  }
                </div>
              </div>
              {(committeeCount > 0 || activeDuties > 0) && (
                <div className="flex gap-3 mt-3 pt-3 border-t border-slate-100">
                  {committeeCount > 0 && <span className="text-xs text-slate-500">{committeeCount} committee{committeeCount !== 1 ? 's' : ''}</span>}
                  {activeDuties > 0 && <span className="text-xs text-amber-600 font-medium">{activeDuties} task{activeDuties !== 1 ? 's' : ''}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {adding && (
        <Modal title="Add Board Member" onClose={() => setAdding(false)} wide>
          <MemberForm onSave={addMember} onCancel={() => setAdding(false)} />
        </Modal>
      )}
      {selected && (
        <MemberDetailModal
          member={selected}
          positions={positions}
          committees={committees}
          allTerms={terms}
          allMemberCommittees={memberCommittees}
          duties={duties}
          onClose={() => setSelectedId(null)}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

// ─── Positions tab ────────────────────────────────────────────────────────────

export function PositionsTab({ positions, terms, members, onUpdate }: {
  positions: BoardPosition[]; terms: BoardTerm[]; members: BoardMember[]; onUpdate: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', isOfficer: false, sortOrder: 0 });
  const [editing, setEditing] = useState<BoardPosition | null>(null);
  const [editForm, setEditForm] = useState<Partial<BoardPosition>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const saveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await api('/positions', 'POST', form);
    onUpdate();
    setAdding(false);
    setForm({ title: '', description: '', isOfficer: false, sortOrder: 0 });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await api(`/positions/${editing.id}`, 'PUT', editForm);
    onUpdate();
    setEditing(null);
  };

  const deletePosition = async (id: number) => {
    if (!confirm('Delete this position? Existing terms will keep the reference.')) return;
    await api(`/positions/${id}`, 'DELETE');
    onUpdate();
  };

  const getCurrentHolder = (posId: number) => {
    const term = terms.find(t => t.positionId === posId && t.isCurrent);
    if (!term) return null;
    return members.find(m => m.id === term.memberId);
  };

  const getHistory = (posId: number) =>
    terms.filter(t => t.positionId === posId && !t.isCurrent).map(t => ({
      ...t,
      member: members.find(m => m.id === t.memberId),
    }));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Board Positions</h2>
          <p className="text-sm text-slate-500">{positions.length} position{positions.length !== 1 ? 's' : ''} defined</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <Plus size={15} />Add Position
        </button>
      </div>

      {adding && (
        <form onSubmit={saveNew} className="border border-indigo-200 rounded-2xl p-4 bg-indigo-50 mb-4 space-y-3">
          <h3 className="font-semibold text-indigo-800 text-sm">New Position</h3>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Position title *" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.isOfficer} onChange={e => setForm(f => ({ ...f, isOfficer: e.target.checked }))} className="rounded border-slate-300 text-indigo-600" />
            Officer position (President, VP, Secretary, Treasurer)
          </label>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">Create</button>
            <button type="button" onClick={() => setAdding(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-white transition-colors">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {positions.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).map(pos => {
          const holder = getCurrentHolder(pos.id);
          const history = getHistory(pos.id);
          const isExp = expanded === pos.id;
          return (
            <div key={pos.id} className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
              {editing?.id === pos.id ? (
                <form onSubmit={saveEdit} className="p-4 space-y-3">
                  <input value={editForm.title ?? ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input value={editForm.description ?? ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={editForm.isOfficer ?? false} onChange={e => setEditForm(f => ({ ...f, isOfficer: e.target.checked }))} className="rounded border-slate-300 text-indigo-600" />
                    Officer position
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">Save</button>
                    <button type="button" onClick={() => setEditing(null)} className="px-4 py-1.5 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{pos.title}</span>
                        {pos.isOfficer && <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">Officer</span>}
                      </div>
                      {pos.description && <p className="text-sm text-slate-500 mt-0.5">{pos.description}</p>}
                      {holder ? (
                        <div className="flex items-center gap-2 mt-2">
                          {holder.photo
                            ? <img src={holder.photo} className="w-6 h-6 rounded-full object-cover" />
                            : <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">{holder.firstName[0]}</div>
                          }
                          <span className="text-sm font-medium text-indigo-700">{displayName(holder)}</span>
                          <span className="text-xs text-indigo-500">(current)</span>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400 mt-2 italic">Vacant</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      {history.length > 0 && (
                        <button onClick={() => setExpanded(isExp ? null : pos.id)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                          {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                      <button onClick={() => { setEditing(pos); setEditForm({ ...pos }); }} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => deletePosition(pos.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {isExp && history.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Past Holders</div>
                      {history.map(h => (
                        <div key={h.id} className="flex items-center gap-2 text-sm">
                          <span className="text-slate-600">{h.member ? displayName(h.member) : 'Unknown'}</span>
                          <span className="text-slate-400 text-xs">{h.startDate || '?'} – {h.endDate || '?'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Committees tab ───────────────────────────────────────────────────────────

export function CommitteesTab({ committees, memberCommittees, members, onUpdate }: {
  committees: BoardCommittee[]; memberCommittees: BoardMemberCommittee[]; members: BoardMember[]; onUpdate: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [expanded, setExpanded] = useState<number | null>(null);

  const saveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await api('/committees', 'POST', form);
    onUpdate();
    setAdding(false);
    setForm({ name: '', description: '' });
  };

  const deleteCommittee = async (id: number) => {
    if (!confirm('Delete this committee?')) return;
    await api(`/committees/${id}`, 'DELETE');
    onUpdate();
  };

  const getMembers = (committeeId: number) =>
    memberCommittees
      .filter(mc => mc.committeeId === committeeId && mc.active)
      .map(mc => ({ ...mc, member: members.find(m => m.id === mc.memberId) }));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Committees</h2>
          <p className="text-sm text-slate-500">{committees.length} committee{committees.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <Plus size={15} />Add Committee
        </button>
      </div>

      {adding && (
        <form onSubmit={saveNew} className="border border-indigo-200 rounded-2xl p-4 bg-indigo-50 mb-4 space-y-3">
          <h3 className="font-semibold text-indigo-800 text-sm">New Committee</h3>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Committee name *" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">Create</button>
            <button type="button" onClick={() => setAdding(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-white transition-colors">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {committees.filter(c => c.active).map(c => {
          const cMembers = getMembers(c.id);
          const isExp = expanded === c.id;
          return (
            <div key={c.id} className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{c.name}</div>
                    {c.description && <p className="text-sm text-slate-500 mt-0.5">{c.description}</p>}
                    <div className="text-sm text-slate-500 mt-1">{cMembers.length} member{cMembers.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    {cMembers.length > 0 && (
                      <button onClick={() => setExpanded(isExp ? null : c.id)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                        {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                    <button onClick={() => deleteCommittee(c.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
                {isExp && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    {cMembers.map(mc => (
                      <div key={mc.id} className="flex items-center gap-2">
                        {mc.member?.photo
                          ? <img src={mc.member.photo} className="w-6 h-6 rounded-full object-cover" />
                          : <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">{mc.member?.firstName[0]}</div>
                        }
                        <span className="text-sm text-slate-700">{mc.member ? displayName(mc.member) : 'Unknown'}</span>
                        {mc.role && mc.role !== 'member' && <span className="text-xs text-indigo-600 font-medium capitalize">{mc.role}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {cMembers.length > 0 && !isExp && (
                  <div className="flex items-center gap-1 mt-2">
                    {cMembers.slice(0, 5).map(mc => (
                      mc.member?.photo
                        ? <img key={mc.id} src={mc.member.photo} className="w-6 h-6 rounded-full object-cover border border-white -ml-1 first:ml-0" />
                        : <div key={mc.id} className="w-6 h-6 rounded-full bg-indigo-100 border border-white flex items-center justify-center text-indigo-600 text-xs font-bold -ml-1 first:ml-0">{mc.member?.firstName[0]}</div>
                    ))}
                    {cMembers.length > 5 && <span className="text-xs text-slate-500 ml-1">+{cMembers.length - 5} more</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Duties tab ───────────────────────────────────────────────────────────────

export function DutiesTab({ duties, members, onUpdate }: {
  duties: BoardDuty[]; members: BoardMember[]; onUpdate: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BoardDuty | null>(null);
  const [filterStatus, setFilterStatus] = useState<'active' | 'all'>('active');
  const [filterMember, setFilterMember] = useState<number | ''>('');

  const saveDuty = async (data: object) => {
    if (editing) {
      await api(`/duties/${editing.id}`, 'PUT', data);
    } else {
      await api('/duties', 'POST', data);
    }
    onUpdate();
    setAdding(false);
    setEditing(null);
  };

  const deleteDuty = async (id: number) => {
    if (!confirm('Delete this task?')) return;
    await api(`/duties/${id}`, 'DELETE');
    onUpdate();
  };

  const toggleStatus = async (duty: BoardDuty) => {
    const next = duty.status === 'active' ? 'completed' : 'active';
    await api(`/duties/${duty.id}`, 'PUT', { ...duty, status: next });
    onUpdate();
  };

  let filtered = filterStatus === 'active' ? duties.filter(d => d.status === 'active') : duties;
  if (filterMember) filtered = filtered.filter(d => d.memberId === filterMember);
  filtered = filtered.sort((a, b) => {
    const pOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    return (pOrder[a.priority] - pOrder[b.priority]) || (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Board Tasks</h2>
          <p className="text-sm text-slate-500">{duties.filter(d => d.status === 'active').length} active task{duties.filter(d => d.status === 'active').length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <Plus size={15} />Add Task
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="border border-slate-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option value="active">Active tasks</option>
          <option value="all">All tasks</option>
        </select>
        <select value={filterMember} onChange={e => setFilterMember(e.target.value ? +e.target.value : '')} className="border border-slate-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option value="">All members</option>
          {members.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{displayName(m)}</option>)}
        </select>
      </div>

      {(adding || editing) && (
        <div className="border border-indigo-200 rounded-2xl p-4 bg-indigo-50 mb-4">
          <h3 className="font-semibold text-indigo-800 text-sm mb-3">{editing ? 'Edit Task' : 'New Task'}</h3>
          <DutyForm members={members.filter(m => m.active)} duty={editing ?? undefined}
            onSave={saveDuty} onCancel={() => { setAdding(false); setEditing(null); }} />
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <CheckSquare size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No tasks found.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(d => {
          const isOverdue = d.dueDate && d.dueDate < new Date().toISOString().slice(0, 10) && d.status === 'active';
          return (
            <div key={d.id} className={`flex items-start gap-3 p-3.5 border rounded-xl transition-all ${d.status !== 'active' ? 'opacity-50 border-slate-100 bg-slate-50' : 'border-slate-200 bg-white hover:border-indigo-200'}`}>
              <button onClick={() => toggleStatus(d)} className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${d.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-indigo-500'}`}>
                {d.status === 'completed' && <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="2,6 5,9 10,3"/></svg>}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${d.status !== 'active' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{d.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${priorityColor(d.priority)}`}>{d.priority}</span>
                  {d.status !== 'active' && <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor(d.status)}`}>{d.status}</span>}
                </div>
                {d.description && <div className="text-xs text-slate-500 mt-0.5">{d.description}</div>}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {d.memberName && <span className="text-xs text-slate-500 flex items-center gap-1"><User size={10} />{d.memberName}</span>}
                  {d.dueDate && <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}><Clock size={10} />{isOverdue ? 'Overdue: ' : ''}{d.dueDate}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(d); setAdding(false); }} className="p-1.5 text-slate-300 hover:text-indigo-600 rounded-lg transition-colors"><Edit2 size={13} /></button>
                <button onClick={() => deleteDuty(d.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Files tab ────────────────────────────────────────────────────────────────

const FILE_CATEGORIES = [
  { value: 'tax',       label: 'Tax Forms' },
  { value: 'financial', label: 'Financial Reports' },
  { value: 'minutes',   label: 'Meeting Minutes' },
  { value: 'policy',    label: 'Policies & Bylaws' },
  { value: 'contract',  label: 'Contracts & Agreements' },
  { value: 'member',    label: 'Member Documents' },
  { value: 'other',     label: 'Other' },
];

const isGoogleUrl = (url: string) =>
  /docs\.google\.com|drive\.google\.com|sheets\.google\.com|slides\.google\.com/.test(url);

const googleServiceLabel = (url: string) => {
  if (url.includes('spreadsheet') || url.includes('sheets')) return 'Google Sheets';
  if (url.includes('/document') || url.includes('docs.google')) return 'Google Docs';
  if (url.includes('/presentation') || url.includes('slides')) return 'Google Slides';
  if (url.includes('drive.google')) return 'Google Drive';
  return 'External Link';
};

const categoryLabel = (v: string) => FILE_CATEGORIES.find(c => c.value === v)?.label ?? v;

const formatBytes = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const mimeIcon = (mime?: string) => {
  if (!mime) return <FileText size={18} className="text-slate-400" />;
  if (mime.includes('pdf')) return <FileText size={18} className="text-red-500" />;
  if (mime.includes('word') || mime.includes('document')) return <FileText size={18} className="text-blue-500" />;
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('spreadsheet'))
    return <FileText size={18} className="text-green-500" />;
  if (mime.startsWith('image/')) return <FileText size={18} className="text-purple-500" />;
  return <FileText size={18} className="text-slate-400" />;
};

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.zip';
const MAX_MB = 15;

export function FilesTab({ files, members, onUpdate }: {
  files: BoardFile[]; members: BoardMember[]; onUpdate: () => void;
}) {
  const [addMode, setAddMode] = useState<'file' | 'link'>('file');
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ description: '', category: 'other', memberId: '' as number | '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sizeWarning, setSizeWarning] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [linkForm, setLinkForm] = useState({ linkUrl: '', originalName: '', description: '', category: 'other', memberId: '' as number | '' });
  const [linkErr, setLinkErr] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterMember, setFilterMember] = useState<number | ''>('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ originalName: '', description: '', category: 'other', memberId: '' as number | '', linkUrl: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
    setSizeWarning(!!f && f.size > MAX_MB * 1024 * 1024);
    setUploadErr('');
  };

  const submitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) { setUploadErr('Please select a file.'); return; }
    if (selectedFile.size > 20 * 1024 * 1024) { setUploadErr('File exceeds 20 MB limit.'); return; }
    setUploadErr('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('category', uploadForm.category);
      if (uploadForm.description) form.append('description', uploadForm.description);
      if (uploadForm.memberId !== '') form.append('memberId', String(uploadForm.memberId));
      // Use fetch directly — api() always sets Content-Type: application/json,
      // but FormData requires the browser to set its own multipart boundary.
      const res = await fetch(`${BASE}/files`, { method: 'POST', credentials: 'include', body: form });
      if (res.status === 401) { window.location.reload(); throw new Error('Session expired'); }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Upload failed');
      }
      onUpdate();
      setSelectedFile(null);
      setUploadForm({ description: '', category: 'other', memberId: '' });
      setSizeWarning(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      setUploadErr(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const submitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkErr('');
    if (!linkForm.linkUrl.trim()) { setLinkErr('URL is required.'); return; }
    if (!linkForm.originalName.trim()) { setLinkErr('A display name is required.'); return; }
    try {
      new URL(linkForm.linkUrl.trim()); // validate URL structure
    } catch {
      setLinkErr('Please enter a valid URL (must start with https://).');
      return;
    }
    setUploading(true);
    try {
      await api('/files', 'POST', {
        entryType: 'link',
        linkUrl: linkForm.linkUrl.trim(),
        originalName: linkForm.originalName.trim(),
        description: linkForm.description || null,
        category: linkForm.category,
        memberId: linkForm.memberId || null,
      });
      onUpdate();
      setLinkForm({ linkUrl: '', originalName: '', description: '', category: 'other', memberId: '' });
    } catch (err: any) {
      setLinkErr(err.message || 'Failed to save link');
    } finally {
      setUploading(false);
    }
  };

  const saveEdit = async (file: BoardFile) => {
    await api(`/files/${file.id}`, 'PUT', {
      originalName: editForm.originalName,
      description: editForm.description || null,
      category: editForm.category,
      memberId: editForm.memberId || null,
      linkUrl: editForm.linkUrl || null,
    });
    onUpdate();
    setEditingId(null);
  };

  const deleteFile = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await api(`/files/${id}`, 'DELETE');
    onUpdate();
  };

  const downloadFile = (id: number, name: string) => {
    const a = document.createElement('a');
    a.href = `/api/board/files/${id}/download`;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  let filtered = files;
  if (filterCat) filtered = filtered.filter(f => f.category === filterCat);
  if (filterMember) filtered = filtered.filter(f => f.memberId === filterMember);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Board Documents</h2>
          <p className="text-sm text-slate-500">{files.length} item{files.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Add panel — toggle between Upload File and Add Link */}
      <div className="border border-indigo-200 bg-indigo-50 rounded-2xl p-4 mb-5">
        {/* Mode toggle */}
        <div className="flex gap-1 mb-4 bg-indigo-100 rounded-xl p-1 w-fit">
          <button type="button" onClick={() => setAddMode('file')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${addMode === 'file' ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-500 hover:text-indigo-700'}`}>
            <Upload size={13} />Upload File
          </button>
          <button type="button" onClick={() => setAddMode('link')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${addMode === 'link' ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-500 hover:text-indigo-700'}`}>
            <Link size={13} />Add Link
          </button>
        </div>

        {addMode === 'file' ? (
          <form onSubmit={submitUpload} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">File (PDF, Word, Excel, etc.)</label>
              <input ref={fileRef} type="file" accept={ACCEPTED_TYPES} onChange={handleFileChange}
                className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 transition-colors" />
              {sizeWarning && (
                <div className="flex items-center gap-1.5 text-amber-600 text-xs mt-1.5">
                  <AlertTriangle size={12} />Large file ({formatBytes(selectedFile?.size)}) — uploads may take a moment
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <select value={uploadForm.category} onChange={e => setUploadForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {FILE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Associate with Member (optional)</label>
                <select value={uploadForm.memberId} onChange={e => setUploadForm(f => ({ ...f, memberId: e.target.value ? +e.target.value : '' }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— General board document —</option>
                  {members.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{displayName(m)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
              <input value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. IRS Form 990 for fiscal year 2025"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {uploadErr && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle size={14} />{uploadErr}
              </div>
            )}
            <button type="submit" disabled={!selectedFile || uploading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              <Upload size={14} />{uploading ? 'Uploading…' : 'Upload File'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitLink} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">URL <span className="text-slate-400">(Google Docs, Sheets, Drive, or any link)</span></label>
              <input value={linkForm.linkUrl} onChange={e => setLinkForm(f => ({ ...f, linkUrl: e.target.value }))}
                placeholder="https://docs.google.com/..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Display Name</label>
              <input value={linkForm.originalName} onChange={e => setLinkForm(f => ({ ...f, originalName: e.target.value }))}
                placeholder="e.g. 2025 Budget Spreadsheet"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <select value={linkForm.category} onChange={e => setLinkForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {FILE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Associate with Member (optional)</label>
                <select value={linkForm.memberId} onChange={e => setLinkForm(f => ({ ...f, memberId: e.target.value ? +e.target.value : '' }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— General board document —</option>
                  {members.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{displayName(m)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
              <input value={linkForm.description} onChange={e => setLinkForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Shared budget tracking spreadsheet"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {linkErr && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle size={14} />{linkErr}
              </div>
            )}
            <button type="submit" disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              <Link size={14} />{uploading ? 'Saving…' : 'Save Link'}
            </button>
          </form>
        )}
      </div>

      {/* Filters */}
      {files.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
            <option value="">All categories</option>
            {FILE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={filterMember} onChange={e => setFilterMember(e.target.value ? +e.target.value : '')}
            className="border border-slate-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
            <option value="">All members</option>
            {members.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{displayName(m)}</option>)}
          </select>
        </div>
      )}

      {/* File list */}
      {filtered.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <FolderOpen size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">{files.length === 0 ? 'No documents or links added yet.' : 'No items match the current filter.'}</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(file => (
          <div key={file.id} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            {editingId === file.id ? (
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {file.entryType === 'link' ? 'Display Name' : 'File Name'}
                  </label>
                  <input value={editForm.originalName} onChange={e => setEditForm(f => ({ ...f, originalName: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                {file.entryType === 'link' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">URL</label>
                    <input value={editForm.linkUrl} onChange={e => setEditForm(f => ({ ...f, linkUrl: e.target.value }))}
                      placeholder="https://..."
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {FILE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <select value={editForm.memberId} onChange={e => setEditForm(f => ({ ...f, memberId: e.target.value ? +e.target.value : '' }))}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">— General board document —</option>
                    {members.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{displayName(m)}</option>)}
                  </select>
                </div>
                <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(file)} className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1.5"><Save size={13} />Save</button>
                  <button onClick={() => setEditingId(null)} className="px-4 py-1.5 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4">
                <div className="shrink-0 mt-0.5">
                  {file.entryType === 'link'
                    ? <ExternalLink size={18} className="text-indigo-400" />
                    : mimeIcon(file.mimeType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-800 truncate">{file.originalName}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{categoryLabel(file.category)}</span>
                    {file.entryType === 'link' && file.linkUrl && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isGoogleUrl(file.linkUrl) ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                        {googleServiceLabel(file.linkUrl)}
                      </span>
                    )}
                    {file.memberName && <span className="text-xs text-indigo-600 font-medium">{file.memberName}</span>}
                    {file.fileSize && <span className="text-xs text-slate-400">{formatBytes(file.fileSize)}</span>}
                    <span className="text-xs text-slate-400">{new Date(file.createdAt).toLocaleDateString()}</span>
                  </div>
                  {file.description && <div className="text-xs text-slate-500 mt-1">{file.description}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {file.entryType === 'link' && file.linkUrl ? (
                    <a href={file.linkUrl} target="_blank" rel="noreferrer"
                      title="Open link"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors">
                      <ExternalLink size={14} />
                    </a>
                  ) : (
                    <button onClick={() => downloadFile(file.id, file.originalName)}
                      title="Download"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors">
                      <Download size={14} />
                    </button>
                  )}
                  <button onClick={() => { setEditingId(file.id); setEditForm({ originalName: file.originalName, description: file.description ?? '', category: file.category, memberId: file.memberId ?? '', linkUrl: file.linkUrl ?? '' }); }}
                    title="Edit"
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => deleteFile(file.id, file.originalName)}
                    title="Delete"
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Vault tab ────────────────────────────────────────────────────────────────

const VAULT_BASE = '/api/board/vault';

const VAULT_CATEGORIES = [
  { value: 'general',     label: 'General' },
  { value: 'financial',   label: 'Financial Accounts' },
  { value: 'credentials', label: 'Passwords & Credentials' },
  { value: 'tax_legal',   label: 'Tax & Legal' },
  { value: 'insurance',   label: 'Insurance' },
  { value: 'vendor',      label: 'Vendor Accounts' },
  { value: 'other',       label: 'Other' },
];

const vaultCatLabel = (v: string) => VAULT_CATEGORIES.find(c => c.value === v)?.label ?? v;

const ACCEPTED_VAULT_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.zip';

// Sentinel thrown when the vault session expires mid-use so callers can re-show the PIN gate.
class VaultLockError extends Error { constructor() { super('Vault PIN required'); } }

async function vaultApi(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${VAULT_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { window.location.reload(); throw new Error('Session expired'); }
  if (res.status === 403) throw new VaultLockError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

function parseBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
  if (/MSIE|Trident/.test(ua)) return 'IE';
  return 'Unknown browser';
}

export function VaultTab() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const [items, setItems] = useState<VaultItem[]>([]);
  const [log, setLog] = useState<VaultLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [showLog, setShowLog] = useState(false);

  // Add-item state
  const [addType, setAddType] = useState<'note' | 'link' | 'file'>('note');
  const [addForm, setAddForm] = useState({ title: '', content: '', linkUrl: '', category: 'general' });
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addErr, setAddErr] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const addFileRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: '', content: '', linkUrl: '', category: 'general' });

  const [filterCat, setFilterCat] = useState('');
  const [filterType, setFilterType] = useState('');

  const relock = () => { setUnlocked(false); setItems([]); setLog([]); };

  const loadVault = async () => {
    setLoading(true);
    setLoadErr('');
    try {
      const [its, lg] = await Promise.all([
        vaultApi('/items'),
        vaultApi('/log'),
      ]);
      setItems(its);
      setLog(lg);
    } catch (err: any) {
      if (err instanceof VaultLockError) { relock(); return; }
      setLoadErr(err.message || 'Failed to load vault');
    } finally {
      setLoading(false);
    }
  };

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinErr('');
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setPinErr('Enter a 4-digit PIN.');
      return;
    }
    setPinBusy(true);
    try {
      await vaultApi('/unlock', 'POST', { pin });
      setUnlocked(true);
      setPin('');
      loadVault();
    } catch (err: any) {
      setPinErr(err.message || 'Incorrect PIN');
    } finally {
      setPinBusy(false);
    }
  };

  const lockVault = async () => {
    await vaultApi('/lock', 'POST').catch(() => {});
    setUnlocked(false);
    setItems([]);
    setLog([]);
    setPin('');
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddErr('');
    if (!addForm.title.trim()) { setAddErr('Title is required.'); return; }
    setAddBusy(true);
    try {
      if (addType === 'file') {
        if (!addFile) { setAddErr('Please select a file.'); setAddBusy(false); return; }
        const form = new FormData();
        form.append('file', addFile);
        form.append('title', addForm.title.trim());
        form.append('category', addForm.category);
        if (addForm.content) form.append('content', addForm.content);
        const res = await fetch(`${VAULT_BASE}/items`, { method: 'POST', credentials: 'include', body: form });
        if (res.status === 401) { window.location.reload(); throw new Error('Session expired'); }
        if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error(e.error || 'Upload failed'); }
      } else {
        await vaultApi('/items', 'POST', {
          itemType: addType,
          title: addForm.title.trim(),
          content: addForm.content || null,
          linkUrl: addType === 'link' ? addForm.linkUrl.trim() : null,
          category: addForm.category,
        });
      }
      setAddForm({ title: '', content: '', linkUrl: '', category: 'general' });
      setAddFile(null);
      if (addFileRef.current) addFileRef.current.value = '';
      loadVault();
    } catch (err: any) {
      if (err instanceof VaultLockError) { relock(); return; }
      setAddErr(err.message || 'Failed to save');
    } finally {
      setAddBusy(false);
    }
  };

  const startEdit = (item: VaultItem) => {
    setEditingId(item.id);
    setEditForm({ title: item.title, content: item.content ?? '', linkUrl: item.linkUrl ?? '', category: item.category });
  };

  const saveEdit = async (item: VaultItem) => {
    await vaultApi(`/items/${item.id}`, 'PUT', {
      title: editForm.title,
      content: editForm.content || null,
      linkUrl: item.itemType === 'link' ? editForm.linkUrl : null,
      category: editForm.category,
    });
    setEditingId(null);
    loadVault();
  };

  const deleteItem = async (item: VaultItem) => {
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    await vaultApi(`/items/${item.id}`, 'DELETE');
    loadVault();
  };

  const downloadItem = (item: VaultItem) => {
    const a = document.createElement('a');
    a.href = `${VAULT_BASE}/items/${item.id}/download`;
    a.download = item.originalName ?? item.title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── PIN gate ────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="max-w-sm mx-auto mt-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound size={28} className="text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Secure Vault</h2>
          <p className="text-sm text-slate-500 mt-1">Enter the 4-digit PIN to access sensitive information.</p>
        </div>
        <form onSubmit={unlock} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">PIN</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                maxLength={4}
                inputMode="numeric"
                autoComplete="off"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 pr-10"
              />
              <button type="button" onClick={() => setShowPin(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {pinErr && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} />{pinErr}
            </div>
          )}
          <button type="submit" disabled={pinBusy || pin.length !== 4}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors">
            <Unlock size={16} />{pinBusy ? 'Verifying…' : 'Unlock Vault'}
          </button>
        </form>
      </div>
    );
  }

  // ── Vault contents ──────────────────────────────────────────
  let filtered = items;
  if (filterCat)  filtered = filtered.filter(i => i.category === filterCat);
  if (filterType) filtered = filtered.filter(i => i.itemType === filterType);

  const typeIcon = (type: string) => {
    if (type === 'note') return <StickyNote size={16} className="text-indigo-400" />;
    if (type === 'link') return <ExternalLink size={16} className="text-blue-400" />;
    return <FileText size={16} className="text-slate-400" />;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
            <Shield size={18} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Secure Vault</h2>
            <p className="text-xs text-slate-500">{items.length} item{items.length !== 1 ? 's' : ''} · end-to-end board access only</p>
          </div>
        </div>
        <button onClick={lockVault}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-700 border border-amber-300 rounded-xl hover:bg-amber-50 transition-colors font-medium">
          <Lock size={13} />Lock Vault
        </button>
      </div>

      {loading && (
        <div className="text-center py-10 text-slate-400">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading…
        </div>
      )}
      {loadErr && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <AlertCircle size={14} />{loadErr}
        </div>
      )}

      {!loading && !loadErr && (
        <>
          {/* Add item form */}
          <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 mb-5">
            {/* Type toggle */}
            <div className="flex gap-1 mb-4 bg-amber-100 rounded-xl p-1 w-fit">
              {(['note', 'link', 'file'] as const).map(t => (
                <button key={t} type="button" onClick={() => setAddType(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${addType === t ? 'bg-white text-amber-700 shadow-sm' : 'text-amber-600 hover:text-amber-800'}`}>
                  {t === 'note' && <StickyNote size={13} />}
                  {t === 'link' && <Link size={13} />}
                  {t === 'file' && <Upload size={13} />}
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={submitAdd} className="space-y-3">
              <input value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Title"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />

              {addType === 'link' && (
                <input value={addForm.linkUrl} onChange={e => setAddForm(f => ({ ...f, linkUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              )}

              {addType === 'file' && (
                <input ref={addFileRef} type="file" accept={ACCEPTED_VAULT_TYPES}
                  onChange={e => setAddFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 transition-colors" />
              )}

              <textarea value={addForm.content} onChange={e => setAddForm(f => ({ ...f, content: e.target.value }))}
                placeholder={addType === 'note' ? 'Enter sensitive information here…' : 'Notes (optional)'}
                rows={addType === 'note' ? 4 : 2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y" />

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                  {VAULT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {addErr && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle size={14} />{addErr}
                </div>
              )}

              <button type="submit" disabled={addBusy}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors">
                <Plus size={14} />{addBusy ? 'Saving…' : 'Add to Vault'}
              </button>
            </form>
          </div>

          {/* Filters */}
          {items.length > 3 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                <option value="">All types</option>
                <option value="note">Notes</option>
                <option value="link">Links</option>
                <option value="file">Files</option>
              </select>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                <option value="">All categories</option>
                {VAULT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          )}

          {/* Item list */}
          {filtered.length === 0 && !loading && (
            <div className="text-center py-10 text-slate-400">
              <Shield size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">{items.length === 0 ? 'No items in the vault yet.' : 'No items match the filter.'}</p>
            </div>
          )}

          <div className="space-y-2 mb-6">
            {filtered.map(item => (
              <div key={item.id} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                {editingId === item.id ? (
                  <div className="p-4 space-y-3">
                    <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Title"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    {item.itemType === 'link' && (
                      <input value={editForm.linkUrl} onChange={e => setEditForm(f => ({ ...f, linkUrl: e.target.value }))}
                        placeholder="https://..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    )}
                    <textarea value={editForm.content} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                      placeholder={item.itemType === 'note' ? 'Content…' : 'Notes…'}
                      rows={item.itemType === 'note' ? 4 : 2}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y" />
                    <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                      {VAULT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(item)} className="px-4 py-1.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors flex items-center gap-1.5"><Save size={13} />Save</button>
                      <button onClick={() => setEditingId(null)} className="px-4 py-1.5 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">{typeIcon(item.itemType)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-slate-900">{item.title}</span>
                          <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200">{vaultCatLabel(item.category)}</span>
                          {item.itemType === 'file' && item.originalName && (
                            <span className="text-xs text-slate-400">{item.originalName}</span>
                          )}
                        </div>
                        {item.itemType === 'link' && item.linkUrl && (
                          <a href={item.linkUrl} target="_blank" rel="noreferrer"
                            className="text-xs text-blue-600 hover:underline mt-0.5 block truncate">{item.linkUrl}</a>
                        )}
                        {item.content && (
                          <pre className="text-xs text-slate-600 mt-2 whitespace-pre-wrap break-words font-sans bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">{item.content}</pre>
                        )}
                        <div className="text-xs text-slate-400 mt-1.5">
                          Added {new Date(item.createdAt).toLocaleDateString()}
                          {item.updatedAt !== item.createdAt && ` · updated ${new Date(item.updatedAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.itemType === 'link' && item.linkUrl && (
                          <a href={item.linkUrl} target="_blank" rel="noreferrer"
                            title="Open link"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors">
                            <ExternalLink size={14} />
                          </a>
                        )}
                        {item.itemType === 'file' && (
                          <button onClick={() => downloadItem(item)} title="Download"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors">
                            <Download size={14} />
                          </button>
                        )}
                        <button onClick={() => startEdit(item)} title="Edit"
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-50 rounded-lg transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteItem(item)} title="Delete"
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Access log */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <button onClick={() => setShowLog(s => !s)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <ClipboardList size={15} />Access Log
                <span className="text-xs font-normal text-slate-400">({log.length} entries)</span>
              </span>
              {showLog ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
            </button>
            {showLog && (
              <div className="overflow-x-auto">
                {log.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No access events recorded.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-2 font-medium text-slate-500">When</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-500">Action</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-500">Status</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-500">IP Address</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-500">Browser</th>
                      </tr>
                    </thead>
                    <tbody>
                      {log.map(entry => (
                        <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                            {new Date(entry.accessedAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-slate-700 capitalize">{entry.action}</td>
                          <td className="px-4 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${entry.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {entry.success ? 'OK' : 'Failed'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-slate-500 font-mono">{entry.ipAddress}</td>
                          <td className="px-4 py-2 text-slate-500" title={entry.userAgent}>
                            {parseBrowser(entry.userAgent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Archive tab ──────────────────────────────────────────────────────────────

export function ArchiveTab({ members, terms, positions, onUpdate }: {
  members: BoardMember[]; terms: BoardTerm[]; positions: BoardPosition[]; onUpdate: () => void;
}) {
  const archived = members.filter(m => !m.active);

  const reactivate = async (m: BoardMember) => {
    if (!confirm(`Reactivate ${displayName(m)} as an active board member?`)) return;
    await api(`/members/${m.id}`, 'PUT', { ...m, active: true });
    onUpdate();
  };

  const getTermSummary = (memberId: number) => {
    const mTerms = terms.filter(t => t.memberId === memberId);
    if (mTerms.length === 0) return 'No terms recorded';
    const posNames = [...new Set(mTerms.map(t => t.positionTitle))].join(', ');
    const start = mTerms.reduce((min, t) => t.startDate < min ? t.startDate : min, mTerms[0].startDate);
    const end = mTerms.filter(t => t.endDate).reduce((max, t) => (t.endDate ?? '') > max ? (t.endDate ?? '') : max, '');
    return `${posNames} · ${start}${end ? ' – ' + end : ''}`;
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">Alumni</h2>
        <p className="text-sm text-slate-500">{archived.length} former member{archived.length !== 1 ? 's' : ''}</p>
      </div>

      {archived.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Archive size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No archived members.</p>
        </div>
      )}

      <div className="space-y-3">
        {archived.map(m => (
          <div key={m.id} className="flex items-center gap-4 p-4 border border-slate-200 rounded-2xl bg-white">
            {m.photo
              ? <img src={m.photo} className="w-10 h-10 rounded-full object-cover opacity-70 shrink-0" />
              : <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold shrink-0">
                  {m.firstName[0]}{m.lastName[0]}
                </div>
            }
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-700">{displayName(m)}</div>
              <div className="text-xs text-slate-400 truncate">{getTermSummary(m.id)}</div>
            </div>
            <button onClick={() => reactivate(m)} className="px-3 py-1.5 text-xs border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors font-medium">
              Reactivate
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Board Portal (main layout post-login) ────────────────────────────────────

function BoardPortal({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('members');
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [positions, setPositions] = useState<BoardPosition[]>([]);
  const [committees, setCommittees] = useState<BoardCommittee[]>([]);
  const [terms, setTerms] = useState<BoardTerm[]>([]);
  const [memberCommittees, setMemberCommittees] = useState<BoardMemberCommittee[]>([]);
  const [duties, setDuties] = useState<BoardDuty[]>([]);
  const [files, setFiles] = useState<BoardFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [m, p, c, t, mc, d] = await Promise.all([
        api('/members'),
        api('/positions'),
        api('/committees'),
        api('/terms'),
        api('/member_committees'),
        api('/duties'),
      ]);
      setMembers(m);
      setPositions(p);
      setCommittees(c);
      setTerms(t);
      setMemberCommittees(mc);
      setDuties(d);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      return;
    } finally {
      setLoading(false);
    }
    // Load files independently — if the table hasn't been created yet, show empty list
    try {
      setFiles(await api('/files'));
    } catch {
      setFiles([]);
    }
  };

  useEffect(() => { load(); }, []);

  const logout = async () => {
    await api('/auth/logout', 'POST');
    onLogout();
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'members', label: 'Members', icon: <Users size={15} /> },
    { id: 'positions', label: 'Positions', icon: <Briefcase size={15} /> },
    { id: 'committees', label: 'Committees', icon: <GitBranch size={15} /> },
    { id: 'duties', label: 'Tasks', icon: <CheckSquare size={15} /> },
    { id: 'files', label: 'Documents', icon: <FolderOpen size={15} /> },
    { id: 'vault', label: 'Secure Vault', icon: <Shield size={15} /> },
    { id: 'archive', label: 'Alumni', icon: <Archive size={15} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-indigo-700 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/TaosPrideLogo.png" className="w-8 h-8 rounded-lg opacity-90" onError={e => (e.currentTarget.style.display = 'none')} />
            <div>
              <div className="font-bold text-sm leading-tight">Taos Pride</div>
              <div className="text-indigo-300 text-xs leading-tight">Board Portal</div>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-1.5 text-indigo-200 hover:text-white hover:bg-indigo-600 rounded-lg text-sm transition-colors">
            <LogOut size={14} />Sign Out
          </button>
        </div>
        {/* Tab navigation */}
        <div className="max-w-5xl mx-auto px-4 pb-0 flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${tab === t.id ? 'bg-slate-50 text-indigo-700' : 'text-indigo-200 hover:text-white hover:bg-indigo-600'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading && (
          <div className="text-center py-16 text-slate-400">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading board data…
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle size={16} />{error}
          </div>
        )}
        {!loading && !error && (
          <>
            {tab === 'members' && <MembersTab members={members} positions={positions} committees={committees} terms={terms} memberCommittees={memberCommittees} duties={duties} onUpdate={load} />}
            {tab === 'positions' && <PositionsTab positions={positions} terms={terms} members={members} onUpdate={load} />}
            {tab === 'committees' && <CommitteesTab committees={committees} memberCommittees={memberCommittees} members={members} onUpdate={load} />}
            {tab === 'duties' && <DutiesTab duties={duties} members={members} onUpdate={load} />}
            {tab === 'files' && <FilesTab files={files} members={members} onUpdate={load} />}
            {tab === 'vault' && <VaultTab />}
            {tab === 'archive' && <ArchiveTab members={members} terms={terms} positions={positions} onUpdate={load} />}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function BoardApp() {
  const [auth, setAuth] = useState<boolean | null>(null);

  useEffect(() => {
    api('/auth/check').then(r => setAuth(r.authenticated)).catch(() => setAuth(false));
  }, []);

  if (auth === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!auth) return <LoginScreen onLogin={() => setAuth(true)} />;
  return <BoardPortal onLogout={() => setAuth(false)} />;
}
