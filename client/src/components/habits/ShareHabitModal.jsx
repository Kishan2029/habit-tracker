import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  shareHabit,
  getSharingInfo,
  inviteMember,
  removeMember,
  updateMemberRole,
  regenerateInviteCode,
  unshareHabit,
  transferOwnership,
} from '../../api/sharedHabitApi';

export default function ShareHabitModal({ habit, onClose }) {
  const [tab, setTab] = useState('link');
  const [loading, setLoading] = useState(true);
  const [sharingData, setSharingData] = useState(null);
  const [requesterRole, setRequesterRole] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  const clientUrl = window.location.origin;

  useEffect(() => {
    fetchSharingInfo();
  }, []);

  const fetchSharingInfo = async () => {
    setLoading(true);
    try {
      const { data: res } = await getSharingInfo(habit._id);
      setSharingData(res.data.shared);
      setRequesterRole(res.data.requesterRole);
    } catch (err) {
      if (err.response?.status === 404) {
        // Not shared yet — create sharing
        try {
          const { data: res } = await shareHabit(habit._id);
          setSharingData(res.data.shared);
          setRequesterRole('owner');
        } catch (shareErr) {
          toast.error('Failed to share habit');
          onClose();
        }
      } else {
        toast.error('Failed to load sharing info');
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!sharingData?.inviteCode) return;
    const link = `${clientUrl}/join/${sharingData.inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateCode = async () => {
    try {
      const { data: res } = await regenerateInviteCode(habit._id);
      setSharingData(res.data.shared);
      toast.success('Invite code regenerated');
    } catch {
      toast.error('Failed to regenerate code');
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteMember(habit._id, inviteEmail, inviteRole);
      toast.success('Invite sent');
      setInviteEmail('');
      fetchSharingInfo();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId, name) => {
    if (!confirm(`Remove ${name} from this shared habit?`)) return;
    try {
      await removeMember(habit._id, userId);
      toast.success('Member removed');
      fetchSharingInfo();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateMemberRole(habit._id, userId, newRole);
      toast.success('Role updated');
      fetchSharingInfo();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleTransferOwnership = async (userId, name) => {
    if (!confirm(`Transfer ownership to ${name}? You will become an admin.`)) return;
    try {
      await transferOwnership(habit._id, userId);
      toast.success('Ownership transferred');
      fetchSharingInfo();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to transfer');
    }
  };

  const handleUnshare = async () => {
    if (!confirm('Stop sharing this habit? All members will lose access.')) return;
    try {
      await unshareHabit(habit._id);
      toast.success('Habit unshared');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unshare');
    }
  };

  const canInvite = requesterRole === 'owner' || requesterRole === 'admin';
  const canChangeRoles = requesterRole === 'owner';
  const canRemove = requesterRole === 'owner' || requesterRole === 'admin';

  const members = sharingData?.sharedWith?.filter((m) => m.status === 'accepted') || [];
  const pendingMembers = sharingData?.sharedWith?.filter((m) => m.status === 'pending') || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-xl">{habit.icon}</span>
            <h2 className="font-semibold text-gray-900 dark:text-white">Share "{habit.name}"</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Tabs */}
            {canInvite && (
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setTab('link')}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
                    tab === 'link'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Invite Link
                </button>
                <button
                  onClick={() => setTab('email')}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
                    tab === 'email'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Invite by Email
                </button>
              </div>
            )}

            {/* Invite Link Tab */}
            {tab === 'link' && canInvite && sharingData?.inviteCode && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Share this link to invite people:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${clientUrl}/join/${sharingData.inviteCode}`}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition whitespace-nowrap"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={handleRegenerateCode}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  Regenerate link
                </button>
              </div>
            )}

            {/* Invite by Email Tab */}
            {tab === 'email' && canInvite && (
              <form onSubmit={handleInvite} className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="member">Member (can log)</option>
                    <option value="viewer">Viewer (read-only)</option>
                    <option value="admin">Admin (can invite & manage)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {inviting ? 'Sending...' : 'Send Invite'}
                </button>
              </form>
            )}

            {/* Members List */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Members ({members.length})
              </h3>
              {members.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No members yet. Share the invite link!</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.userId?._id || member.userId}
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-medium text-indigo-600 dark:text-indigo-400">
                          {(member.userId?.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {member.userId?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {member.userId?.email || ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {canChangeRoles ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.userId?._id || member.userId, e.target.value)}
                            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 capitalize">
                            {member.role}
                          </span>
                        )}
                        {canRemove && !(requesterRole === 'admin' && member.role === 'admin') && (
                          <button
                            onClick={() => handleRemoveMember(member.userId?._id || member.userId, member.userId?.name)}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 transition"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        {canChangeRoles && member.status === 'accepted' && (
                          <button
                            onClick={() => handleTransferOwnership(member.userId?._id || member.userId, member.userId?.name)}
                            className="text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                            title="Transfer ownership"
                          >
                            👑
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Invites */}
            {pendingMembers.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pending ({pendingMembers.length})
                </h3>
                <div className="space-y-2">
                  {pendingMembers.map((member) => (
                    <div
                      key={member.userId?._id || member.userId}
                      className="flex items-center justify-between p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/10"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-sm text-yellow-600">
                          ⏳
                        </div>
                        <div>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {member.userId?.name || member.userId?.email || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                        </div>
                      </div>
                      {canRemove && (
                        <button
                          onClick={() => handleRemoveMember(member.userId?._id || member.userId, member.userId?.name)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unshare button (owner only) */}
            {requesterRole === 'owner' && (
              <button
                onClick={handleUnshare}
                className="w-full py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                Stop Sharing
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
