/**
 * ================================================================
 * PINNACLE BOOKKEEPING — CLIENT PORTAL LOGIC
 * ================================================================
 * Handles: Authentication, Firestore CRUD, file upload to Google Drive
 *          via Cloud Functions, duplicate detection, role-based views,
 *          messaging, task tracking, notifications, user management.
 * ================================================================
 */

/* ── INITIALIZE FIREBASE ── */
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();

/* ── APP STATE ── */
let currentUser = null;   // Firebase auth user
let userProfile = null;   // Firestore user doc { name, role, business, assignedClients, ... }
let currentView = 'dashboard';
let stagedFiles = [];     // Files waiting to be uploaded
let activeFileId = null;  // File currently open in detail modal
let activeChatId = null;  // Active message thread

/* ================================================================
   AUTH — LOGIN CHECK & REDIRECT
   ================================================================ */

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    // Not logged in — redirect to login page
    window.location.href = 'portal-login.html';
    return;
  }
  currentUser = user;

  // Fetch user profile from Firestore
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists) {
      showToast('Account not found. Contact Pinnacle for assistance.', 'error');
      auth.signOut();
      return;
    }
    userProfile = doc.data();

    // Check if user is disabled
    if (userProfile.disabled) {
      showToast('Your account has been disabled. Contact Pinnacle.', 'error');
      auth.signOut();
      return;
    }

    initPortal();
  } catch (err) {
    console.error('Error loading profile:', err);
    showToast('Error loading your profile. Please try again.', 'error');
  }
});

/* ================================================================
   PORTAL INIT — Setup UI based on role
   ================================================================ */

function initPortal() {
  const app = document.getElementById('portal-app');
  app.style.display = 'flex';

  // Set user info in sidebar
  document.getElementById('sidebar-user-name').textContent = userProfile.name || currentUser.email;
  const roleEl = document.getElementById('sidebar-user-role');
  roleEl.textContent = userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1);
  roleEl.className = 'sidebar-user-role role-' + userProfile.role;

  // Set topbar avatar
  const initials = (userProfile.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  document.getElementById('topbar-avatar').textContent = initials;

  // Set dashboard greeting
  const firstName = (userProfile.name || '').split(' ')[0] || 'there';
  document.getElementById('dash-username').textContent = firstName;

  // Set settings fields
  document.getElementById('settings-name').value = userProfile.name || '';
  document.getElementById('settings-email').value = currentUser.email;
  document.getElementById('settings-business').value = userProfile.business || '';
  document.getElementById('settings-phone').value = userProfile.phone || '';

  // Role-based UI
  if (userProfile.role === 'admin') {
    document.getElementById('admin-nav-section').style.display = 'block';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-flex');
  } else if (userProfile.role === 'employee') {
    // Employees only see Client Overview, not Manage Users
    document.getElementById('admin-nav-section').style.display = 'block';
    document.querySelector('[data-view="admin-users"]').style.display = 'none';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-flex');

    // Admin: "new message" recipients = all clients
    // Employee: only assigned clients
    loadAdminRecipients();
  }

  if (userProfile.role === 'client') {
    // Clients only message Pinnacle
    document.getElementById('new-msg-to-field').style.display = 'none';
  }

  // Load data
  loadDashboard();
  loadFiles();
  loadMessages();
  loadTasks();
  loadNotifications();

  // Setup upload drag/drop
  setupUploadZone();
}

/* ================================================================
   NAVIGATION
   ================================================================ */

const viewTitles = {
  'dashboard': 'Dashboard',
  'upload': 'Upload Documents',
  'messages': 'Messages',
  'tasks': 'Task Tracker',
  'notifications': 'Notifications',
  'settings': 'Settings',
  'admin-users': 'Manage Users',
  'admin-clients': 'Client Overview'
};

function switchView(viewName) {
  // Hide all views
  document.querySelectorAll('.portal-view').forEach(v => v.classList.remove('active'));

  // Show target view
  const target = document.getElementById('view-' + viewName);
  if (target) target.classList.add('active');

  // Update sidebar active state
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector('.sidebar-link[data-view="' + viewName + '"]');
  if (activeLink) activeLink.classList.add('active');

  // Update topbar title
  document.getElementById('topbar-title').textContent = viewTitles[viewName] || 'Portal';
  currentView = viewName;

  // Close sidebar on mobile
  closeSidebar();

  // Refresh data for certain views
  if (viewName === 'admin-users') loadUsers();
  if (viewName === 'admin-clients') loadClientOverview();
}

function toggleSidebar() {
  document.getElementById('portal-sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('portal-sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}
document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

/* ================================================================
   DASHBOARD — Load stats & recent items
   ================================================================ */

async function loadDashboard() {
  try {
    const uid = currentUser.uid;
    let filesQuery;

    if (userProfile.role === 'client') {
      filesQuery = db.collection('files').where('clientUid', '==', uid);
    } else if (userProfile.role === 'employee') {
      const assignedIds = userProfile.assignedClients || [];
      if (assignedIds.length === 0) {
        updateDashStats(0, 0, 0, 0);
        return;
      }
      filesQuery = db.collection('files').where('clientUid', 'in', assignedIds.slice(0, 10));
    } else {
      // Admin sees all
      filesQuery = db.collection('files');
    }

    const snap = await filesQuery.orderBy('uploadedAt', 'desc').limit(100).get();
    let total = 0, pending = 0, processed = 0;

    snap.forEach(doc => {
      total++;
      const d = doc.data();
      if (d.status === 'unprocessed') pending++;
      if (d.status === 'done') processed++;
    });

    updateDashStats(total, pending, processed, 0);

    // Recent files (top 5)
    const recentContainer = document.getElementById('dash-recent-files');
    if (snap.size > 0) {
      let html = '<div class="file-list">';
      let count = 0;
      snap.forEach(doc => {
        if (count >= 5) return;
        html += renderFileItem(doc.id, doc.data());
        count++;
      });
      html += '</div>';
      recentContainer.innerHTML = html;
    }

    // Count unread messages
    let msgQuery;
    if (userProfile.role === 'client') {
      msgQuery = db.collection('messages')
        .where('participants', 'array-contains', uid)
        .orderBy('lastMessageAt', 'desc').limit(20);
    } else {
      msgQuery = db.collection('messages').orderBy('lastMessageAt', 'desc').limit(50);
    }
    const msgSnap = await msgQuery.get();
    let unreadCount = 0;
    msgSnap.forEach(doc => {
      const d = doc.data();
      if (d.unreadBy && d.unreadBy.includes(uid)) unreadCount++;
    });
    document.getElementById('stat-messages').textContent = unreadCount;
    updateBadge('msg-badge', unreadCount);

  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function updateDashStats(total, pending, processed, messages) {
  document.getElementById('stat-uploads').textContent = total;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-processed').textContent = processed;
}

function updateBadge(id, count) {
  const badge = document.getElementById(id);
  if (!badge) return;
  if (count > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = count;
  } else {
    badge.style.display = 'none';
  }
}

/* ================================================================
   FILE UPLOAD — Drag/Drop, Staging, Duplicate Check, Upload
   ================================================================ */

function setupUploadZone() {
  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('file-input');

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFileSelection(e.dataTransfer.files);
  });
  input.addEventListener('change', () => {
    handleFileSelection(input.files);
    input.value = '';
  });
}

async function handleFileSelection(fileList) {
  if (!fileList || fileList.length === 0) return;

  const newFiles = Array.from(fileList);
  let duplicatesFound = [];

  // Check for duplicates against existing uploads
  for (const file of newFiles) {
    const isDup = await checkDuplicate(file.name, file.size);
    if (isDup) {
      duplicatesFound.push(file.name);
    } else {
      stagedFiles.push(file);
    }
  }

  // Show duplicate warning
  if (duplicatesFound.length > 0) {
    const warn = document.getElementById('dup-warning');
    const warnText = document.getElementById('dup-warning-text');
    warn.style.display = 'flex';
    warnText.textContent = 'Duplicate detected: ' + duplicatesFound.join(', ') + ' — already uploaded.';
  } else {
    document.getElementById('dup-warning').style.display = 'none';
  }

  // Show staging area
  if (stagedFiles.length > 0) {
    document.getElementById('upload-staging').style.display = 'block';
    renderStagedFiles();
  }
}

async function checkDuplicate(fileName, fileSize) {
  try {
    const uid = currentUser.uid;
    const clientUid = userProfile.role === 'client' ? uid : null;

    let query = db.collection('files')
      .where('fileName', '==', fileName)
      .where('fileSize', '==', fileSize);

    if (clientUid) {
      query = query.where('clientUid', '==', clientUid);
    }

    const snap = await query.limit(1).get();
    return !snap.empty;
  } catch (err) {
    console.error('Duplicate check error:', err);
    return false;
  }
}

function renderStagedFiles() {
  const container = document.getElementById('staged-file-list');
  let html = '';
  stagedFiles.forEach((file, index) => {
    html += `
      <div class="file-item">
        <div class="file-icon">${getFileIcon(file.name)}</div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(file.name)}</div>
          <div class="file-meta">
            <span>${formatFileSize(file.size)}</span>
          </div>
        </div>
        <button class="file-action-btn danger" title="Remove" onclick="removeStagedFile(${index})">✕</button>
      </div>`;
  });
  container.innerHTML = html;
}

function removeStagedFile(index) {
  stagedFiles.splice(index, 1);
  if (stagedFiles.length === 0) {
    document.getElementById('upload-staging').style.display = 'none';
  } else {
    renderStagedFiles();
  }
}

function clearStaging() {
  stagedFiles = [];
  document.getElementById('upload-staging').style.display = 'none';
  document.getElementById('dup-warning').style.display = 'none';
}

async function confirmUpload() {
  if (stagedFiles.length === 0) return;

  const category = document.getElementById('upload-category').value;
  const comment = document.getElementById('upload-comment').value.trim();

  showToast('Uploading ' + stagedFiles.length + ' file(s)...', 'info');

  for (const file of stagedFiles) {
    try {
      // Upload file via Cloud Function (to Google Drive)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientUid', userProfile.role === 'client' ? currentUser.uid : '');
      formData.append('category', category);
      formData.append('uploaderUid', currentUser.uid);

      const response = await fetch(FUNCTIONS_BASE_URL + '/uploadFile', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + await currentUser.getIdToken()
        },
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();

      // Save file metadata to Firestore
      const fileDoc = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'unknown',
        category: category,
        status: 'unprocessed',
        clientUid: userProfile.role === 'client' ? currentUser.uid : '',
        uploaderUid: currentUser.uid,
        uploaderName: userProfile.name || currentUser.email,
        storagePath: result.storagePath || '',
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        comments: comment ? [{
          author: userProfile.name || currentUser.email,
          authorUid: currentUser.uid,
          text: comment,
          timestamp: new Date().toISOString()
        }] : []
      };

      await db.collection('files').add(fileDoc);

      // Create notification for admin
      if (userProfile.role === 'client') {
        await createNotification(
          'admin',
          null,
          '📤 New document uploaded by ' + (userProfile.name || currentUser.email) + ': ' + file.name,
          'upload'
        );
      }

    } catch (err) {
      console.error('Upload error for ' + file.name + ':', err);
      showToast('Failed to upload ' + file.name, 'error');
    }
  }

  showToast('Upload complete!', 'success');
  clearStaging();
  document.getElementById('upload-comment').value = '';
  loadFiles();
  loadDashboard();
}

/* ── LOAD FILES ── */

async function loadFiles() {
  try {
    let query;
    if (userProfile.role === 'client') {
      query = db.collection('files')
        .where('clientUid', '==', currentUser.uid)
        .orderBy('uploadedAt', 'desc');
    } else if (userProfile.role === 'employee') {
      const assigned = userProfile.assignedClients || [];
      if (assigned.length === 0) return;
      query = db.collection('files')
        .where('clientUid', 'in', assigned.slice(0, 10))
        .orderBy('uploadedAt', 'desc');
    } else {
      query = db.collection('files').orderBy('uploadedAt', 'desc');
    }

    const snap = await query.limit(200).get();
    const container = document.getElementById('uploaded-file-list');

    if (snap.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📂</div>
          <div class="empty-state-title">No documents uploaded yet</div>
          <div class="empty-state-text">Files you upload will appear here.</div>
        </div>`;
      return;
    }

    let html = '';
    snap.forEach(doc => {
      html += renderFileItem(doc.id, doc.data());
    });
    container.innerHTML = html;

  } catch (err) {
    console.error('Load files error:', err);
  }
}

function renderFileItem(id, data) {
  const canDelete = data.status === 'unprocessed' &&
    (data.uploaderUid === currentUser.uid || userProfile.role === 'admin');
  const statusClass = data.status === 'done' ? 'done' :
    data.status === 'processing' ? 'processing' : 'unprocessed';

  const dateStr = data.uploadedAt ? formatDate(data.uploadedAt.toDate()) : '—';
  const commentCount = (data.comments || []).length;

  return `
    <div class="file-item" data-category="${data.category || 'other'}">
      <div class="file-icon">${getFileIcon(data.fileName)}</div>
      <div class="file-info">
        <div class="file-name">${escapeHtml(data.fileName)}</div>
        <div class="file-meta">
          <span>${formatFileSize(data.fileSize)}</span>
          <span>${dateStr}</span>
          <span>${getCategoryLabel(data.category)}</span>
          ${commentCount > 0 ? '<span>💬 ' + commentCount + '</span>' : ''}
        </div>
      </div>
      <span class="file-status status-${statusClass}">${statusLabel(data.status)}</span>
      <div class="file-actions">
        <button class="file-action-btn" title="Download" onclick="downloadFile('${id}')">⬇️</button>
        <button class="file-action-btn" title="Details & Comments" onclick="openFileDetail('${id}')">💬</button>
        ${canDelete ? '<button class="file-action-btn danger" title="Delete" onclick="deleteFile(\'' + id + '\')">🗑️</button>' : ''}
      </div>`;
    </div>`;
}

function filterCategory(btn) {
  document.querySelectorAll('.upload-category-bar .cat-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const cat = btn.dataset.category;
  document.querySelectorAll('#uploaded-file-list .file-item').forEach(item => {
    if (cat === 'all' || item.dataset.category === cat) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

/* ── FILE DETAIL & COMMENTS ── */

async function openFileDetail(fileId) {
  activeFileId = fileId;
  try {
    const doc = await db.collection('files').doc(fileId).get();
    if (!doc.exists) return;
    const data = doc.data();

    document.getElementById('file-detail-name').textContent = data.fileName;
    document.getElementById('file-detail-category').textContent = getCategoryLabel(data.category);
    document.getElementById('file-detail-size').textContent = formatFileSize(data.fileSize);
    document.getElementById('file-detail-date').textContent = data.uploadedAt ? formatDate(data.uploadedAt.toDate()) : '—';
    document.getElementById('file-detail-status').textContent = statusLabel(data.status);

    // Render comments
    const thread = document.getElementById('file-comment-thread');
    const comments = data.comments || [];
    if (comments.length === 0) {
      thread.innerHTML = '<p style="font-size:0.85rem; color:var(--muted);">No comments yet.</p>';
    } else {
      let html = '';
      comments.forEach(c => {
        const isAdmin = c.authorUid !== data.clientUid;
        html += `
          <div class="comment-item">
            <div class="comment-avatar ${isAdmin ? 'admin-avatar' : ''}">${(c.author || 'U')[0].toUpperCase()}</div>
            <div class="comment-body">
              <div class="comment-author">${escapeHtml(c.author)}</div>
              <div class="comment-text">${escapeHtml(c.text)}</div>
              <div class="comment-time">${c.timestamp ? formatDate(new Date(c.timestamp)) : ''}</div>
            </div>
          </div>`;
      });
      thread.innerHTML = html;
      thread.scrollTop = thread.scrollHeight;
    }

    openModal('modal-file-detail');
  } catch (err) {
    console.error('File detail error:', err);
    showToast('Error loading file details.', 'error');
  }
}

async function addFileComment() {
  if (!activeFileId) return;
  const input = document.getElementById('file-comment-input');
  const text = input.value.trim();
  if (!text) return;

  try {
    await db.collection('files').doc(activeFileId).update({
      comments: firebase.firestore.FieldValue.arrayUnion({
        author: userProfile.name || currentUser.email,
        authorUid: currentUser.uid,
        text: text,
        timestamp: new Date().toISOString()
      })
    });

    input.value = '';
    openFileDetail(activeFileId); // Refresh
    showToast('Comment added.', 'success');
  } catch (err) {
    console.error('Add comment error:', err);
    showToast('Error adding comment.', 'error');
  }
}

async function downloadFile(fileId) {
  try {
    const doc = await db.collection('files').doc(fileId).get();
    if (!doc.exists) return;
    const data = doc.data();
    if (!data.storagePath) {
      showToast('No file path found.', 'error');
      return;
    }
    showToast('Generating download link...', 'info');
    const response = await fetch(FUNCTIONS_BASE_URL + '/getDownloadUrl', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + await currentUser.getIdToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ storagePath: data.storagePath })
    });
    if (!response.ok) throw new Error('Failed to get download link');
    const result = await response.json();
    const link = document.createElement('a');
    link.href = result.url;
    link.download = data.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Download error:', err);
    showToast('Error downloading file.', 'error');
  }
}

async function deleteFile(fileId) {
  if (!confirm('Delete this file? This cannot be undone.')) return;
  try {
    // Also delete from Drive via Cloud Function
    const doc = await db.collection('files').doc(fileId).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.storagePath) {
        await fetch(FUNCTIONS_BASE_URL + '/deleteFile', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + await currentUser.getIdToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ storagePath: data.storagePath })
        });
      }
    }

    await db.collection('files').doc(fileId).delete();
    showToast('File deleted.', 'success');
    loadFiles();
    loadDashboard();
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Error deleting file.', 'error');
  }
}

/* ================================================================
   MESSAGES
   ================================================================ */

async function loadMessages() {
  try {
    let query;
    if (userProfile.role === 'client') {
      query = db.collection('messages')
        .where('participants', 'array-contains', currentUser.uid)
        .orderBy('lastMessageAt', 'desc');
    } else {
      // Admin/employee see all messages (or assigned)
      query = db.collection('messages').orderBy('lastMessageAt', 'desc').limit(50);
    }

    const snap = await query.get();
    const container = document.getElementById('msg-list');

    if (snap.empty) {
      container.innerHTML = '<div class="empty-state" style="padding:2rem 1rem;"><div class="empty-state-icon">💬</div><div class="empty-state-text">No messages yet</div></div>';
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const d = doc.data();
      const isUnread = d.unreadBy && d.unreadBy.includes(currentUser.uid);
      html += `
        <div class="msg-item ${activeChatId === doc.id ? 'active' : ''}" onclick="openChat('${doc.id}')">
          <div class="msg-item-name">
            ${isUnread ? '<span class="unread-badge"></span>' : ''}
            ${escapeHtml(d.subject || 'No subject')}
          </div>
          <span class="msg-item-time">${d.lastMessageAt ? formatRelative(d.lastMessageAt.toDate()) : ''}</span>
          <div class="msg-item-preview">${escapeHtml(d.lastMessageText || '')}</div>
        </div>`;
    });
    container.innerHTML = html;

  } catch (err) {
    console.error('Load messages error:', err);
  }
}

async function openChat(chatId) {
  activeChatId = chatId;
  document.querySelectorAll('.msg-item').forEach(i => i.classList.remove('active'));

  try {
    const doc = await db.collection('messages').doc(chatId).get();
    if (!doc.exists) return;
    const data = doc.data();

    document.getElementById('chat-recipient').textContent = data.subject || 'Conversation';
    document.getElementById('msg-chat-input').style.display = 'flex';

    // Mark as read
    if (data.unreadBy && data.unreadBy.includes(currentUser.uid)) {
      await db.collection('messages').doc(chatId).update({
        unreadBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
      });
    }

    // Load chat messages
    const msgSnap = await db.collection('messages').doc(chatId)
      .collection('thread').orderBy('sentAt', 'asc').get();

    const chatBody = document.getElementById('msg-chat-body');
    if (msgSnap.empty) {
      chatBody.innerHTML = '<p style="padding:1rem; color:var(--muted);">No messages in this thread yet.</p>';
      return;
    }

    let html = '';
    msgSnap.forEach(m => {
      const msg = m.data();
      const isMine = msg.senderUid === currentUser.uid;
      html += `
        <div class="chat-msg ${isMine ? 'sent' : 'received'}">
          ${escapeHtml(msg.text)}
          <div class="chat-msg-time">${msg.sentAt ? formatRelative(msg.sentAt.toDate()) : ''}</div>
        </div>`;
    });
    chatBody.innerHTML = html;
    chatBody.scrollTop = chatBody.scrollHeight;

    loadMessages(); // Refresh list
  } catch (err) {
    console.error('Open chat error:', err);
  }
}

async function sendMessage() {
  if (!activeChatId) return;
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;

  try {
    // Add to thread
    await db.collection('messages').doc(activeChatId)
      .collection('thread').add({
        text: text,
        senderUid: currentUser.uid,
        senderName: userProfile.name || currentUser.email,
        sentAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    // Update parent doc
    const parentDoc = await db.collection('messages').doc(activeChatId).get();
    const participants = parentDoc.data().participants || [];
    const otherParticipants = participants.filter(p => p !== currentUser.uid);

    await db.collection('messages').doc(activeChatId).update({
      lastMessageText: text.substring(0, 100),
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
      unreadBy: otherParticipants
    });

    input.value = '';
    openChat(activeChatId);
  } catch (err) {
    console.error('Send message error:', err);
    showToast('Error sending message.', 'error');
  }
}

function openNewMessage() {
  openModal('modal-new-message');
}

async function sendNewMessage() {
  const subject = document.getElementById('new-msg-subject').value.trim();
  const body = document.getElementById('new-msg-body').value.trim();
  if (!subject || !body) {
    showToast('Please fill in subject and message.', 'warning');
    return;
  }

  try {
    // Determine recipient
    let recipientUid = 'pinnacle'; // Default for client
    const toSelect = document.getElementById('new-msg-to');
    if (toSelect) recipientUid = toSelect.value;

    const participants = [currentUser.uid];
    if (recipientUid !== 'pinnacle') participants.push(recipientUid);

    // Create conversation
    const convoRef = await db.collection('messages').add({
      subject: subject,
      participants: participants,
      createdBy: currentUser.uid,
      createdByName: userProfile.name || currentUser.email,
      lastMessageText: body.substring(0, 100),
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
      unreadBy: participants.filter(p => p !== currentUser.uid)
    });

    // Add first message
    await convoRef.collection('thread').add({
      text: body,
      senderUid: currentUser.uid,
      senderName: userProfile.name || currentUser.email,
      sentAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    closeModal('modal-new-message');
    document.getElementById('new-msg-subject').value = '';
    document.getElementById('new-msg-body').value = '';
    showToast('Message sent!', 'success');
    loadMessages();

    // Create notification
    await createNotification(
      userProfile.role === 'client' ? 'admin' : 'client',
      recipientUid !== 'pinnacle' ? recipientUid : null,
      '💬 New message from ' + (userProfile.name || currentUser.email) + ': ' + subject,
      'message'
    );
  } catch (err) {
    console.error('New message error:', err);
    showToast('Error sending message.', 'error');
  }
}

async function loadAdminRecipients() {
  try {
    const snap = await db.collection('users').where('role', '==', 'client').get();
    const select = document.getElementById('new-msg-to');
    select.innerHTML = '<option value="pinnacle">All Admins</option>';
    snap.forEach(doc => {
      const d = doc.data();
      if (userProfile.role === 'employee' && userProfile.assignedClients &&
        !userProfile.assignedClients.includes(doc.id)) return;
      select.innerHTML += `<option value="${doc.id}">${escapeHtml(d.name || d.email)} — ${escapeHtml(d.business || '')}</option>`;
    });
  } catch (err) {
    console.error('Load recipients error:', err);
  }
}

/* ================================================================
   TASKS
   ================================================================ */

async function loadTasks() {
  try {
    let query;
    if (userProfile.role === 'client') {
      query = db.collection('tasks')
        .where('clientUid', '==', currentUser.uid)
        .orderBy('createdAt', 'desc');
    } else if (userProfile.role === 'employee') {
      const assigned = userProfile.assignedClients || [];
      if (assigned.length === 0) return;
      query = db.collection('tasks')
        .where('clientUid', 'in', assigned.slice(0, 10))
        .orderBy('createdAt', 'desc');
    } else {
      query = db.collection('tasks').orderBy('createdAt', 'desc');
    }

    const snap = await query.limit(100).get();
    const container = document.getElementById('task-list');

    if (snap.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">No tasks yet</div>
          <div class="empty-state-text">Tasks will appear here once bookkeeping work is underway.</div>
        </div>`;
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const d = doc.data();
      const canEdit = userProfile.role === 'admin' || userProfile.role === 'employee';
      html += `
        <div class="task-item" data-status="${d.status}">
          <div class="task-status-dot ${d.status}"></div>
          <div class="task-info">
            <div class="task-name">${escapeHtml(d.name)}</div>
            <div class="task-desc">${escapeHtml(d.description || '')}</div>
          </div>
          <div class="task-due">${d.dueDate || '—'}</div>
          <span class="task-status-badge ${d.status}">${statusLabel(d.status)}</span>
          ${canEdit ? `
            <select class="p-select" style="width:auto; padding:0.35rem 0.5rem; font-size:0.78rem;" onchange="updateTaskStatus('${doc.id}', this.value)">
              <option value="pending" ${d.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="in-progress" ${d.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
              <option value="complete" ${d.status === 'complete' ? 'selected' : ''}>Complete</option>
            </select>` : ''}
        </div>`;
    });
    container.innerHTML = html;

    // Also update dashboard tasks
    const dashTasks = document.getElementById('dash-recent-tasks');
    if (snap.size > 0) {
      let dashHtml = '<div class="task-list">';
      let count = 0;
      snap.forEach(doc => {
        if (count >= 3) return;
        const d = doc.data();
        dashHtml += `
          <div class="task-item">
            <div class="task-status-dot ${d.status}"></div>
            <div class="task-info">
              <div class="task-name">${escapeHtml(d.name)}</div>
              <div class="task-desc">${escapeHtml(d.description || '')}</div>
            </div>
            <span class="task-status-badge ${d.status}">${statusLabel(d.status)}</span>
          </div>`;
        count++;
      });
      dashHtml += '</div>';
      dashTasks.innerHTML = dashHtml;
    }

  } catch (err) {
    console.error('Load tasks error:', err);
  }
}

function filterTasks(btn) {
  document.querySelectorAll('[data-task-filter]').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const filter = btn.dataset.taskFilter;
  document.querySelectorAll('#task-list .task-item').forEach(item => {
    if (filter === 'all' || item.dataset.status === filter) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

function openAddTask() {
  // Populate client dropdown
  loadClientDropdown('task-client');
  openModal('modal-add-task');
}

async function addTask() {
  const name = document.getElementById('task-name').value.trim();
  const desc = document.getElementById('task-desc').value.trim();
  const clientUid = document.getElementById('task-client').value;
  const status = document.getElementById('task-status').value;
  const dueDate = document.getElementById('task-due').value;

  if (!name) {
    showToast('Please enter a task name.', 'warning');
    return;
  }

  try {
    await db.collection('tasks').add({
      name: name,
      description: desc,
      clientUid: clientUid,
      status: status,
      dueDate: dueDate || '',
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    closeModal('modal-add-task');
    document.getElementById('task-name').value = '';
    document.getElementById('task-desc').value = '';
    showToast('Task created!', 'success');
    loadTasks();

    // Notify client
    if (clientUid) {
      await createNotification('client', clientUid, '📋 New task: ' + name, 'task');
    }
  } catch (err) {
    console.error('Add task error:', err);
    showToast('Error creating task.', 'error');
  }
}

async function updateTaskStatus(taskId, newStatus) {
  try {
    await db.collection('tasks').doc(taskId).update({ status: newStatus });
    showToast('Task updated.', 'success');
    loadTasks();
  } catch (err) {
    console.error('Update task error:', err);
    showToast('Error updating task.', 'error');
  }
}

/* ================================================================
   NOTIFICATIONS
   ================================================================ */

async function loadNotifications() {
  try {
    let query;
    if (userProfile.role === 'client') {
      query = db.collection('notifications')
        .where('targetUid', '==', currentUser.uid)
        .orderBy('createdAt', 'desc').limit(30);
    } else if (userProfile.role === 'admin') {
      query = db.collection('notifications')
        .where('targetRole', '==', 'admin')
        .orderBy('createdAt', 'desc').limit(50);
    } else {
      query = db.collection('notifications')
        .where('targetUid', '==', currentUser.uid)
        .orderBy('createdAt', 'desc').limit(30);
    }

    const snap = await query.get();
    const container = document.getElementById('notif-list');
    let unreadCount = 0;

    if (snap.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔔</div>
          <div class="empty-state-title">No notifications</div>
          <div class="empty-state-text">Updates will appear here.</div>
        </div>`;
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const d = doc.data();
      if (!d.read) unreadCount++;
      const iconMap = { upload: '📤', message: '💬', task: '📋', system: '🔔' };
      html += `
        <div class="notif-item ${d.read ? '' : 'unread'}" onclick="markNotifRead('${doc.id}')">
          <div class="notif-icon">${iconMap[d.type] || '🔔'}</div>
          <div class="notif-content">
            <div class="notif-text">${escapeHtml(d.text)}</div>
            <div class="notif-time">${d.createdAt ? formatRelative(d.createdAt.toDate()) : ''}</div>
          </div>
        </div>`;
    });
    container.innerHTML = html;

    updateBadge('notif-badge', unreadCount);
    const dot = document.getElementById('topbar-notif-dot');
    if (dot) dot.classList.toggle('show', unreadCount > 0);

  } catch (err) {
    console.error('Load notifications error:', err);
  }
}

async function markNotifRead(notifId) {
  try {
    await db.collection('notifications').doc(notifId).update({ read: true });
    loadNotifications();
  } catch (err) {
    console.error('Mark notification read error:', err);
  }
}

async function createNotification(targetRole, targetUid, text, type) {
  try {
    await db.collection('notifications').add({
      targetRole: targetRole,
      targetUid: targetUid || '',
      text: text,
      type: type,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error('Create notification error:', err);
  }
}

/* ================================================================
   SETTINGS
   ================================================================ */

async function saveProfile() {
  const name = document.getElementById('settings-name').value.trim();
  const business = document.getElementById('settings-business').value.trim();
  const phone = document.getElementById('settings-phone').value.trim();

  try {
    await db.collection('users').doc(currentUser.uid).update({
      name: name,
      business: business,
      phone: phone
    });
    userProfile.name = name;
    userProfile.business = business;
    userProfile.phone = phone;

    document.getElementById('sidebar-user-name').textContent = name;
    showToast('Profile updated!', 'success');
  } catch (err) {
    console.error('Save profile error:', err);
    showToast('Error saving profile.', 'error');
  }
}

async function changePassword() {
  const current = document.getElementById('settings-pw-current').value;
  const newPw = document.getElementById('settings-pw-new').value;
  const confirm = document.getElementById('settings-pw-confirm').value;

  if (!current || !newPw || !confirm) {
    showToast('Please fill in all password fields.', 'warning');
    return;
  }
  if (newPw !== confirm) {
    showToast('New passwords do not match.', 'error');
    return;
  }
  if (newPw.length < 8) {
    showToast('Password must be at least 8 characters.', 'warning');
    return;
  }

  try {
    // Re-authenticate
    const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, current);
    await currentUser.reauthenticateWithCredential(credential);

    // Update password
    await currentUser.updatePassword(newPw);

    document.getElementById('settings-pw-current').value = '';
    document.getElementById('settings-pw-new').value = '';
    document.getElementById('settings-pw-confirm').value = '';
    showToast('Password updated!', 'success');
  } catch (err) {
    console.error('Change password error:', err);
    if (err.code === 'auth/wrong-password') {
      showToast('Current password is incorrect.', 'error');
    } else {
      showToast('Error updating password: ' + err.message, 'error');
    }
  }
}

function togglePwVis(btn) {
  const input = btn.previousElementSibling;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🔒';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

/* ================================================================
   ADMIN — USER MANAGEMENT
   ================================================================ */

async function loadUsers() {
  if (userProfile.role !== 'admin' && userProfile.role !== 'employee') return;

  try {
    const snap = await db.collection('users').orderBy('name').get();
    const tbody = document.getElementById('user-table-body');

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;">No users found.</td></tr>';
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const d = doc.data();
      const roleClass = d.role;
      const assignedCount = d.assignedClients ? d.assignedClients.length : (d.role === 'admin' ? 'All' : '—');
      html += `
        <tr data-role="${d.role}">
          <td><strong>${escapeHtml(d.name || '—')}</strong></td>
          <td>${escapeHtml(d.email || '—')}</td>
          <td><span class="user-role-tag ${roleClass}">${d.role}</span></td>
          <td>${assignedCount}</td>
          <td>${d.disabled ? '<span style="color:var(--red);">Disabled</span>' : '<span style="color:var(--green);">Active</span>'}</td>
          <td>
            <button class="p-btn p-btn-outline p-btn-sm" onclick="openEditUser('${doc.id}')">Edit</button>
          </td>
        </tr>`;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error('Load users error:', err);
  }
}

function filterUsers(btn) {
  document.querySelectorAll('[data-user-filter]').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const filter = btn.dataset.userFilter;
  document.querySelectorAll('#user-table-body tr').forEach(row => {
    if (filter === 'all' || row.dataset.role === filter) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function openCreateUser() {
  // Reset form
  document.getElementById('new-user-name').value = '';
  document.getElementById('new-user-email').value = '';
  document.getElementById('new-user-password').value = '';
  document.getElementById('new-user-role').value = 'client';
  document.getElementById('new-user-business').value = '';
  toggleClientAssignment();
  openModal('modal-create-user');
}

function toggleClientAssignment() {
  const role = document.getElementById('new-user-role').value;
  document.getElementById('new-user-assign-wrap').style.display = role === 'employee' ? 'block' : 'none';
  document.getElementById('new-user-admin-wrap').style.display = role === 'admin' ? 'block' : 'none';
  document.getElementById('new-user-business-field').style.display = role === 'client' ? 'block' : 'none';

  if (role === 'employee') {
    loadClientCheckboxes('new-user-client-checkboxes');
  }
}

function toggleEditClientAssignment() {
  const role = document.getElementById('edit-user-role').value;
  document.getElementById('edit-user-assign-wrap').style.display = role === 'employee' ? 'block' : 'none';
  document.getElementById('edit-user-business-field').style.display = role === 'client' ? 'block' : 'none';

  if (role === 'employee') {
    loadClientCheckboxes('edit-user-client-checkboxes');
  }
}

async function loadClientCheckboxes(containerId) {
  try {
    const snap = await db.collection('users').where('role', '==', 'client').get();
    const container = document.getElementById(containerId);
    if (snap.empty) {
      container.innerHTML = '<p style="font-size:0.82rem; color:var(--muted);">No clients yet.</p>';
      return;
    }
    let html = '';
    snap.forEach(doc => {
      const d = doc.data();
      html += `
        <label class="p-checkbox-row" style="padding:0.35rem 0;">
          <input type="checkbox" value="${doc.id}" class="client-assign-checkbox">
          ${escapeHtml(d.name || d.email)} ${d.business ? '— ' + escapeHtml(d.business) : ''}
        </label>`;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error('Load client checkboxes error:', err);
  }
}

async function loadClientDropdown(selectId) {
  try {
    const snap = await db.collection('users').where('role', '==', 'client').get();
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Select client...</option>';
    snap.forEach(doc => {
      const d = doc.data();
      select.innerHTML += `<option value="${doc.id}">${escapeHtml(d.name || d.email)} ${d.business ? '— ' + escapeHtml(d.business) : ''}</option>`;
    });
  } catch (err) {
    console.error('Load client dropdown error:', err);
  }
}

async function createUser() {
  const name = document.getElementById('new-user-name').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-password').value;
  const role = document.getElementById('new-user-role').value;
  const business = document.getElementById('new-user-business').value.trim();

  if (!name || !email || !password) {
    showToast('Please fill in name, email, and password.', 'warning');
    return;
  }
  if (password.length < 8) {
    showToast('Password must be at least 8 characters.', 'warning');
    return;
  }

  try {
    // Create user via Cloud Function (admin SDK needed for creating other users)
    const response = await fetch(FUNCTIONS_BASE_URL + '/createUser', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + await currentUser.getIdToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, name, role, business })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Failed to create user');
    }

    const result = await response.json();
    const newUid = result.uid;

    // Get assigned clients for employees
    let assignedClients = [];
    if (role === 'employee') {
      document.querySelectorAll('#new-user-client-checkboxes .client-assign-checkbox:checked').forEach(cb => {
        assignedClients.push(cb.value);
      });
    }

    // Save to Firestore
    await db.collection('users').doc(newUid).set({
      name: name,
      email: email,
      role: role,
      business: business,
      assignedClients: assignedClients,
      disabled: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUser.uid
    });

    // If client, create their Drive folder via Cloud Function
    if (role === 'client') {
      await fetch(FUNCTIONS_BASE_URL + '/createClientFolder', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + await currentUser.getIdToken(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientUid: newUid, clientName: name, businessName: business })
      });
    }

    closeModal('modal-create-user');
    showToast('User created: ' + name, 'success');
    loadUsers();
  } catch (err) {
    console.error('Create user error:', err);
    showToast('Error: ' + err.message, 'error');
  }
}

async function openEditUser(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) return;
    const d = doc.data();

    document.getElementById('edit-user-uid').value = uid;
    document.getElementById('edit-user-name').value = d.name || '';
    document.getElementById('edit-user-email').value = d.email || '';
    document.getElementById('edit-user-role').value = d.role;
    document.getElementById('edit-user-business').value = d.business || '';

    toggleEditClientAssignment();

    // Pre-check assigned clients
    if (d.role === 'employee' && d.assignedClients) {
      setTimeout(() => {
        d.assignedClients.forEach(clientId => {
          const cb = document.querySelector('#edit-user-client-checkboxes input[value="' + clientId + '"]');
          if (cb) cb.checked = true;
        });
      }, 300);
    }

    openModal('modal-edit-user');
  } catch (err) {
    console.error('Open edit user error:', err);
  }
}

async function saveUserEdit() {
  const uid = document.getElementById('edit-user-uid').value;
  const name = document.getElementById('edit-user-name').value.trim();
  const role = document.getElementById('edit-user-role').value;
  const business = document.getElementById('edit-user-business').value.trim();

  let assignedClients = [];
  if (role === 'employee') {
    document.querySelectorAll('#edit-user-client-checkboxes .client-assign-checkbox:checked').forEach(cb => {
      assignedClients.push(cb.value);
    });
  }

  try {
    await db.collection('users').doc(uid).update({
      name: name,
      role: role,
      business: business,
      assignedClients: assignedClients
    });

    closeModal('modal-edit-user');
    showToast('User updated.', 'success');
    loadUsers();
  } catch (err) {
    console.error('Save user edit error:', err);
    showToast('Error saving changes.', 'error');
  }
}

async function disableUser() {
  const uid = document.getElementById('edit-user-uid').value;
  if (!confirm('Disable this user? They will no longer be able to log in.')) return;

  try {
    await db.collection('users').doc(uid).update({ disabled: true });

    // Also disable in Firebase Auth via Cloud Function
    await fetch(FUNCTIONS_BASE_URL + '/disableUser', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + await currentUser.getIdToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uid: uid })
    });

    closeModal('modal-edit-user');
    showToast('User disabled.', 'success');
    loadUsers();
  } catch (err) {
    console.error('Disable user error:', err);
    showToast('Error disabling user.', 'error');
  }
}

/* ── CLIENT OVERVIEW (Admin) ── */

async function loadClientOverview() {
  if (userProfile.role !== 'admin' && userProfile.role !== 'employee') return;

  try {
    let clientQuery;
    if (userProfile.role === 'employee') {
      const assigned = userProfile.assignedClients || [];
      if (assigned.length === 0) return;
      // Can't use 'in' with more than 10, so slice
      clientQuery = db.collection('users').where(firebase.firestore.FieldPath.documentId(), 'in', assigned.slice(0, 10));
    } else {
      clientQuery = db.collection('users').where('role', '==', 'client');
    }

    const clientSnap = await clientQuery.get();
    let totalClients = 0, totalUnprocessed = 0, totalProcessed = 0;

    const tbody = document.getElementById('client-overview-body');
    let html = '';

    for (const clientDoc of clientSnap.docs) {
      totalClients++;
      const cd = clientDoc.data();

      // Count files
      const filesSnap = await db.collection('files')
        .where('clientUid', '==', clientDoc.id).get();

      let unprocessed = 0, total = 0, lastUpload = null;
      filesSnap.forEach(f => {
        total++;
        const fd = f.data();
        if (fd.status === 'unprocessed') unprocessed++;
        if (fd.status === 'done') totalProcessed++;
        if (fd.uploadedAt && (!lastUpload || fd.uploadedAt.toDate() > lastUpload)) {
          lastUpload = fd.uploadedAt.toDate();
        }
      });
      totalUnprocessed += unprocessed;

      html += `
        <tr>
          <td><strong>${escapeHtml(cd.name || '—')}</strong></td>
          <td>${escapeHtml(cd.business || '—')}</td>
          <td>${unprocessed > 0 ? '<strong style="color:var(--amber);">' + unprocessed + '</strong>' : '0'}</td>
          <td>${total}</td>
          <td>${lastUpload ? formatDate(lastUpload) : 'Never'}</td>
          <td>
            <button class="p-btn p-btn-outline p-btn-sm" onclick="viewClientFiles('${clientDoc.id}')">View Files</button>
          </td>
        </tr>`;
    }

    tbody.innerHTML = html || '<tr><td colspan="6" style="text-align:center; padding:2rem;">No clients found.</td></tr>';

    document.getElementById('admin-stat-clients').textContent = totalClients;
    document.getElementById('admin-stat-unprocessed').textContent = totalUnprocessed;
    document.getElementById('admin-stat-processed').textContent = totalProcessed;

  } catch (err) {
    console.error('Client overview error:', err);
  }
}

function viewClientFiles(clientUid) {
  // Switch to upload view and filter by this client
  switchView('upload');
  // TODO: Could add client-specific filtering here
}

/* ================================================================
   MODALS
   ================================================================ */

function openModal(id) {
  document.getElementById(id).classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
  document.body.style.overflow = '';
}

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal.id);
  });
});

/* ================================================================
   TOASTS
   ================================================================ */

function showToast(message, type) {
  type = type || 'info';
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.innerHTML = '<span>' + (icons[type] || '') + '</span> ' + escapeHtml(message);
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(16px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ================================================================
   LOGOUT
   ================================================================ */

function handleLogout() {
  if (confirm('Sign out of the portal?')) {
    auth.signOut().then(() => {
      window.location.href = 'portal-login.html';
    });
  }
}

/* ================================================================
   UTILITY FUNCTIONS
   ================================================================ */

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatRelative(date) {
  if (!date) return '';
  const now = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return formatDate(date);
}

function getFileIcon(fileName) {
  if (!fileName) return '📄';
  const ext = fileName.split('.').pop().toLowerCase();
  const icons = {
    pdf: '📕', jpg: '🖼️', jpeg: '🖼️', png: '🖼️',
    csv: '📊', xlsx: '📊', xls: '📊',
    doc: '📝', docx: '📝'
  };
  return icons[ext] || '📄';
}

function getCategoryLabel(cat) {
  const labels = {
    'receipts': '🧾 Receipts',
    'invoices': '📄 Invoices',
    'bank-statements': '🏦 Bank Statements',
    'payroll': '👥 Payroll',
    'contracts': '📝 Contracts',
    'cra': '📬 CRA',
    'other': '📁 Other'
  };
  return labels[cat] || cat || '📁 Other';
}

function statusLabel(status) {
  const labels = {
    'unprocessed': 'Unprocessed',
    'processing': 'Processing',
    'in-progress': 'In Progress',
    'done': 'Complete',
    'complete': 'Complete',
    'pending': 'Pending'
  };
  return labels[status] || status || '—';
}
