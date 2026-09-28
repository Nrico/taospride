import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

// Reused as-is from the standalone board portal bundle (src/board/BoardApp.tsx)
// — same single-source-of-truth approach as the Site section (see AdminShell.tsx).
// The old /board/ bundle keeps working unmodified as a rollback fallback until
// Phase 4; this component gives the same tabs a home inside the unified /admin
// shell, sharing the one admin login instead of board's own.
import {
  api,
  MembersTab, PositionsTab, CommitteesTab, DutiesTab, FilesTab, VaultTab, ArchiveTab,
} from '../../board/BoardApp';
import type {
  BoardMember, BoardPosition, BoardCommittee, BoardTerm, BoardMemberCommittee, BoardDuty, BoardFile,
} from '../../board/BoardApp';

export default function BoardSection() {
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [positions, setPositions] = useState<BoardPosition[]>([]);
  const [committees, setCommittees] = useState<BoardCommittee[]>([]);
  const [terms, setTerms] = useState<BoardTerm[]>([]);
  const [memberCommittees, setMemberCommittees] = useState<BoardMemberCommittee[]>([]);
  const [duties, setDuties] = useState<BoardDuty[]>([]);
  const [files, setFiles] = useState<BoardFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Same load() shape as the standalone BoardPortal component — every endpoint
  // here is api/board.php, unchanged by the unification (only its auth check
  // moved to the shared admin session, in Phase 1).
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
      setError(err.message || 'Failed to load board data');
      return;
    } finally {
      setLoading(false);
    }
    try {
      setFiles(await api('/files'));
    } catch {
      setFiles([]);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Loading board data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
        <AlertCircle size={16} />{error}
      </div>
    );
  }

  return (
    <Routes>
      <Route index element={<Navigate to="members" replace />} />
      <Route path="members" element={<MembersTab members={members} positions={positions} committees={committees} terms={terms} memberCommittees={memberCommittees} duties={duties} onUpdate={load} />} />
      <Route path="positions" element={<PositionsTab positions={positions} terms={terms} members={members} onUpdate={load} />} />
      <Route path="committees" element={<CommitteesTab committees={committees} memberCommittees={memberCommittees} members={members} onUpdate={load} />} />
      <Route path="duties" element={<DutiesTab duties={duties} members={members} onUpdate={load} />} />
      <Route path="files" element={<FilesTab files={files} members={members} onUpdate={load} />} />
      <Route path="vault" element={<VaultTab />} />
      <Route path="archive" element={<ArchiveTab members={members} terms={terms} positions={positions} onUpdate={load} />} />
      <Route path="*" element={<Navigate to="members" replace />} />
    </Routes>
  );
}
