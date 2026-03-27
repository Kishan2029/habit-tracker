import api from './axios.js';

export const shareHabit = (habitId) =>
  api.post('/shared/share', { habitId });

export const joinByInviteCode = (inviteCode) =>
  api.post('/shared/join', { inviteCode });

export const inviteMember = (habitId, email, role = 'member') =>
  api.post('/shared/invite', { habitId, email, role });

export const respondToInvite = (habitId, accept) =>
  api.post('/shared/respond', { habitId, accept });

export const removeMember = (habitId, userId) =>
  api.delete(`/shared/${habitId}/members/${userId}`);

export const leaveHabit = (habitId) =>
  api.delete(`/shared/${habitId}/leave`);

export const updateMemberRole = (habitId, userId, role) =>
  api.put(`/shared/${habitId}/members/${userId}/role`, { role });

export const transferOwnership = (habitId, newOwnerId) =>
  api.put(`/shared/${habitId}/transfer`, { newOwnerId });

export const getSharedWithMe = () =>
  api.get('/shared/with-me');

export const getPendingInvites = () =>
  api.get('/shared/pending');

export const getSharingInfo = (habitId) =>
  api.get(`/shared/${habitId}`);

export const regenerateInviteCode = (habitId) =>
  api.post(`/shared/${habitId}/regenerate-code`);

export const unshareHabit = (habitId) =>
  api.delete(`/shared/${habitId}`);
