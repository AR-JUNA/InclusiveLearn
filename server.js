const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

const root = path.resolve(__dirname);
const dataDir = path.resolve(process.env.INCLUSIVELEARN_DATA_DIR || path.join(root, '.data'));
const usersFile = path.join(dataDir, 'users.json');
const messagesFile = path.join(dataDir, 'messages.json');
const platformFile = path.join(dataDir, 'platform.json');
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm'
};
const sessions = new Map();
const oauthStates = new Map();
const loginAttempts = new Map();
const ttl = 12 * 60 * 60 * 1000;
let port = Number(process.env.PORT || 3000);

fs.mkdirSync(dataDir, { recursive: true });
function loadUsers() {
  try { return JSON.parse(fs.readFileSync(usersFile, 'utf8')); }
  catch { return []; }
}
let users = loadUsers();
let messages = (() => { try { return JSON.parse(fs.readFileSync(messagesFile, 'utf8')); } catch { return []; } })();
function saveMessages() { const temporary = messagesFile + '.tmp'; fs.writeFileSync(temporary, JSON.stringify(messages, null, 2), { mode: 0o600 }); fs.renameSync(temporary, messagesFile); }
let sharedPlatform = (() => { try { return JSON.parse(fs.readFileSync(platformFile, 'utf8')); } catch { return { submissions: [], published: [], assignments: [], assignmentResponses: [], notifications: [], activity: [] }; } })();
function savePlatform() { const temporary = platformFile + '.tmp'; fs.writeFileSync(temporary, JSON.stringify(sharedPlatform, null, 2), { mode: 0o600 }); fs.renameSync(temporary, platformFile); }
function saveUsers() {
  const temporary = `${usersFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(users, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, usersFile);
}
function sendJson(res, status, data, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(JSON.stringify(data));
}
function setCookie(req, res, value, maxAge = ttl) {
  const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `ila_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(maxAge / 1000)}${secure}`);
}
function clearCookie(req, res) { setCookie(req, res, '', 0); }
function getSession(req) {
  const cookie = req.headers.cookie || '';
  const token = cookie.split(';').map(v => v.trim()).find(v => v.startsWith('ila_session='))?.slice('ila_session='.length);
  const session = token && sessions.get(token);
  if (!session || session.expires < Date.now()) { if (token) sessions.delete(token); return null; }
  session.expires = Date.now() + ttl;
  return { token, session, user: users.find(user => user.id === session.userId) };
}
function publicUser(user) { return { id: user.id, name: user.name, identifier: user.identifier, role: user.role, language: user.language || 'English', accessibility: user.accessibility || {} }; }
function accountKey(identifier) { return identifier.includes('@') ? identifier.trim().toLowerCase() : identifier.replace(/[\s().-]/g, ''); }
function validIdentifier(identifier) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier) || /^\+?[\d\s().-]{7,20}$/.test(identifier); }
function roleValid(role) { return ['Student', 'Educator', 'Parent'].includes(role); }
async function makeUser({ name, identifier, password, role, provider }) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return { id: crypto.randomUUID(), name: String(name).trim().slice(0, 100), identifier: accountKey(identifier), role, salt, passwordHash: hash.toString('hex'), provider: provider || 'password', language: 'English', accessibility: {}, createdAt: new Date().toISOString() };
}
function createSession(req, res, user) {
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { userId: user.id, expires: Date.now() + ttl });
  setCookie(req, res, token);
}
async function readBody(req, maxBytes = 25000) {
  let raw = '';
  for await (const part of req) { raw += part; if (raw.length > maxBytes) throw new Error('Request is too large.'); }
  return raw ? JSON.parse(raw) : {};
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return new URL(origin).host === req.headers.host;
}
function tooManyAttempts(req) {
  const ip = req.socket.remoteAddress || 'unknown';
  const record = loginAttempts.get(ip) || { count: 0, reset: Date.now() + 2 * 60 * 1000 };
  if (Date.now() > record.reset) { record.count = 0; record.reset = Date.now() + 2 * 60 * 1000; }
  record.count += 1; loginAttempts.set(ip, record);
  return record.count > 12;
}
function oauthConfig(provider, req) {
  const origin = `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
  if (provider === 'google') return {
    clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/oauth/google/callback`,
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', userInfo: 'https://openidconnect.googleapis.com/v1/userinfo', scope: 'openid email profile'
  };
  if (provider === 'facebook') return {
    clientId: process.env.FACEBOOK_APP_ID, clientSecret: process.env.FACEBOOK_APP_SECRET,
    redirectUri: process.env.FACEBOOK_REDIRECT_URI || `${origin}/api/auth/oauth/facebook/callback`,
    authorize: 'https://www.facebook.com/v21.0/dialog/oauth', token: 'https://graph.facebook.com/v21.0/oauth/access_token', userInfo: 'https://graph.facebook.com/me?fields=id,name,email', scope: 'email,public_profile'
  };
  return null;
}
function safeReturnUri(req) { return `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}/`; }
async function startOAuth(req, res, url, provider) {
  const config = oauthConfig(provider, req);
  if (!config?.clientId || !config.clientSecret) { res.writeHead(302, { Location: `/?authError=provider_setup&provider=${provider}` }); res.end(); return; }
  const role = url.searchParams.get('role');
  if (!roleValid(role)) { sendJson(res, 400, { error: 'Choose a valid account role.' }); return; }
  const state = crypto.randomBytes(24).toString('base64url');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  oauthStates.set(state, { provider, role, verifier, created: Date.now(), returnTo: safeReturnUri(req) });
  const target = new URL(config.authorize);
  target.searchParams.set('client_id', config.clientId);
  target.searchParams.set('redirect_uri', config.redirectUri);
  target.searchParams.set('response_type', 'code');
  target.searchParams.set('scope', config.scope);
  target.searchParams.set('state', state);
  target.searchParams.set('code_challenge', challenge);
  target.searchParams.set('code_challenge_method', 'S256');
  if (provider === 'google') target.searchParams.set('prompt', 'select_account');
  res.writeHead(302, { Location: target.toString(), 'Cache-Control': 'no-store' }); res.end();
}
async function finishOAuth(req, res, url, provider) {
  const config = oauthConfig(provider, req);
  const state = url.searchParams.get('state');
  const saved = state && oauthStates.get(state);
  if (state) oauthStates.delete(state);
  if (!config?.clientId || !config.clientSecret || !saved || saved.provider !== provider || Date.now() - saved.created > 10 * 60 * 1000 || url.searchParams.has('error')) { res.writeHead(302, { Location: `/?authError=social_signin_failed` }); res.end(); return; }
  try {
    const tokenResponse = await fetch(config.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: url.searchParams.get('code'), client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code', code_verifier: saved.verifier }) });
    if (!tokenResponse.ok) throw new Error('OAuth token request failed');
    const token = await tokenResponse.json();
    const profileResponse = await fetch(config.userInfo, { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!profileResponse.ok) throw new Error('OAuth profile request failed');
    const profile = await profileResponse.json();
    const identifier = profile.email;
    if (!identifier || (provider === 'google' && profile.email_verified !== true)) throw new Error('A verified email address is required');
    const providerId = String(profile.sub || profile.id || '');
    if (!providerId) throw new Error('The provider did not return an account identifier');
    let user = users.find(item => item.socialIds?.[provider] === providerId);
    if (!user) {
      const existing = users.find(item => item.identifier === accountKey(identifier));
      if (existing && existing.provider !== provider) throw new Error('Sign in with the existing method before linking another provider');
      user = existing || await makeUser({ name: profile.name || profile.given_name || 'Learner', identifier, password: crypto.randomBytes(48).toString('hex'), role: saved.role, provider });
      if (user.role !== saved.role) throw new Error('Choose the role linked to this account');
      user.socialIds = { ...(user.socialIds || {}), [provider]: providerId };
      if (!existing) users.push(user); saveUsers();
    }
    createSession(req, res, user);
    res.writeHead(302, { Location: `${saved.returnTo}?social=connected`, 'Cache-Control': 'no-store' }); res.end();
  } catch { res.writeHead(302, { Location: `/?authError=social_signin_failed` }); res.end(); }
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/admin/usage' && req.method === 'GET') {
    const auth = getSession(req);
    if (!auth?.user) { sendJson(res, 401, { error: 'Sign in to view platform usage.' }); return true; }
    if (auth.user.role !== 'Admin') { sendJson(res, 403, { error: 'Admin access is required.' }); return true; }
    const days = Math.max(1, Math.min(365, Number(url.searchParams.get('days')) || 30));
    const cutoff = Date.now() - days * 86400000;
    const byRole = Object.fromEntries(['Student', 'Educator', 'Parent', 'Admin'].map(role => [role, users.filter(user => user.role === role).length]));
    const studentData = users.filter(user => user.role === 'Student').map(user => ({
      progress: Object.values(user.learning?.progress || {}).map(Number).filter(Number.isFinite),
      saved: user.learning?.saved?.length || 0,
      updatedAt: user.learning?.updatedAt || null
    }));
    const allProgress = studentData.flatMap(student => student.progress);
    const activeLearners = studentData.filter(student => student.updatedAt && Date.parse(student.updatedAt) >= cutoff).length;
    const submissions = sharedPlatform.submissions || [];
    const responses = sharedPlatform.assignmentResponses || [];
    sendJson(res, 200, {
      generatedAt: new Date().toISOString(), days, byRole,
      activeLearners,
      engagement: { lessonsStarted: allProgress.filter(value => value > 0).length, lessonsCompleted: allProgress.filter(value => value >= 100).length, savedOffline: studentData.reduce((sum, student) => sum + student.saved, 0) },
      content: { published: (sharedPlatform.published || []).length, pending: submissions.filter(item => item.status === 'Pending').length, rejected: submissions.filter(item => item.status === 'Rejected').length, submitted: submissions.length },
      communication: { messages: messages.length },
      assignments: { created: (sharedPlatform.assignments || []).length, responses: responses.length },
      recentActivity: (sharedPlatform.activity || []).slice(0, 12)
    }); return true;
  }
  if (url.pathname === '/api/notifications/read' && req.method === 'POST') {
    const auth = getSession(req);
    if (!auth?.user) { sendJson(res, 401, { error: 'Sign in to update notifications.' }); return true; }
    if (!sameOrigin(req)) { sendJson(res, 403, { error: 'Request origin could not be verified.' }); return true; }
    let body; try { body = await readBody(req, 5000); } catch { sendJson(res, 400, { error: 'Notifications could not be updated.' }); return true; }
    for (const item of sharedPlatform.notifications || []) {
      const visible = item.role === auth.user.role && (!item.accountId || item.accountId === auth.user.id);
      if (visible && (body.all === true || (Array.isArray(body.ids) && body.ids.includes(item.id)))) item.read = true;
    }
    savePlatform(); sendJson(res, 200, { ok: true }); return true;
  }
  if (url.pathname === '/api/content/submissions' && req.method === 'POST') {
    const auth = getSession(req);
    if (!auth?.user) { sendJson(res, 401, { error: 'Sign in as an educator to submit learning content.' }); return true; }
    if (auth.user.role !== 'Educator') { sendJson(res, 403, { error: 'Only educators can submit content for review.' }); return true; }
    if (!sameOrigin(req)) { sendJson(res, 403, { error: 'Request origin could not be verified.' }); return true; }
    let body; try { body = await readBody(req, 100000); } catch { sendJson(res, 400, { error: 'The lesson could not be read. Please review the form and try again.' }); return true; }
    const title = String(body.title || '').trim();
    const required = ['grade', 'duration', 'description', 'objectives', 'content', 'activity', 'assessment'];
    if (!title || title.length > 90 || required.some(key => !String(body[key] || '').trim())) { sendJson(res, 400, { error: 'Complete the title, grade, time, description, objectives, teaching content, activity, and success criteria.' }); return true; }
    const now = new Date().toLocaleString();
    const resource = { ...body, id: crypto.randomUUID(), title, author: auth.user.name, authorEmail: auth.user.identifier, authorId: auth.user.id, authorRole: 'Educator', status: 'Pending', createdAt: now, reviewNote: '' };
    sharedPlatform.submissions = sharedPlatform.submissions || [];
    sharedPlatform.submissions.unshift(resource);
    sharedPlatform.notifications = sharedPlatform.notifications || [];
    sharedPlatform.notifications.unshift({ id: `submitted-${resource.id}`, role: 'Admin', title: `Content submitted: ${resource.title}`, body: `${resource.type || 'Lesson'} · ${resource.subject || 'Learning'} · ${resource.grade}`, target: 'Content review', read: false, time: now });
    sharedPlatform.activity = sharedPlatform.activity || [];
    sharedPlatform.activity.unshift({ text: `${auth.user.name} submitted “${resource.title}” for admin review`, time: now });
    savePlatform(); sendJson(res, 201, { submission: resource }); return true;
  }  const reviewSubmission = url.pathname.match(/^\/api\/content\/submissions\/([^/]+)\/review$/);
  if (reviewSubmission && req.method === 'POST') {
    const auth = getSession(req);
    if (!auth?.user) { sendJson(res, 401, { error: 'Sign in as an administrator to review content.' }); return true; }
    if (auth.user.role !== 'Admin') { sendJson(res, 403, { error: 'Only administrators can approve or reject content.' }); return true; }
    if (!sameOrigin(req)) { sendJson(res, 403, { error: 'Request origin could not be verified.' }); return true; }
    let body; try { body = await readBody(req, 5000); } catch { sendJson(res, 400, { error: 'The review decision could not be read.' }); return true; }
    let id; try { id = decodeURIComponent(reviewSubmission[1]); } catch { sendJson(res, 400, { error: 'Invalid submission reference.' }); return true; }
    const item = (sharedPlatform.submissions || []).find(entry => entry.id === id);
    if (!item) { sendJson(res, 404, { error: 'This submission is no longer in the review queue.' }); return true; }
    if (item.status !== 'Pending') { sendJson(res, 409, { error: 'This submission has already been reviewed.' }); return true; }
    if (!['Approved', 'Rejected'].includes(body.decision)) { sendJson(res, 400, { error: 'Choose approve or reject for this submission.' }); return true; }
    const now = new Date().toLocaleString();
    item.status = body.decision; item.reviewedAt = now; item.reviewNote = String(body.reviewNote || '').slice(0, 1200);
    sharedPlatform.notifications = sharedPlatform.notifications || [];
    if (body.decision === 'Approved') {
      sharedPlatform.published = sharedPlatform.published || [];
      if (!sharedPlatform.published.some(resource => resource.id === item.id)) sharedPlatform.published.unshift({ ...item, status: 'Published' });
      if (['Assignment', 'Project'].includes(item.type)) { sharedPlatform.assignments = sharedPlatform.assignments || []; if (!sharedPlatform.assignments.some(task => task.contentId === item.id)) sharedPlatform.assignments.unshift({ id: `task-${item.id}`, contentId: item.id, title: item.title, grade: item.grade, dueDate: item.dueDate || '', assignedAt: now, author: item.author, completedBy: [] }); }
      sharedPlatform.notifications.unshift({ id: `approved-${item.id}`, role: 'Student', title: `New approved ${(item.type || 'learning resource').toLowerCase()}: ${item.title}`, body: `${item.subject || 'Learning'} · ${item.grade || 'All levels'} is now available in My learning.`, target: 'My learning', read: false, time: now });
    }
    sharedPlatform.notifications = sharedPlatform.notifications || [];
    sharedPlatform.notifications.unshift({ id: `decision-${item.id}-${Date.now()}`, role: 'Educator', accountId: item.authorId || null, title: `Content ${body.decision.toLowerCase()}: ${item.title}`, body: body.decision === 'Approved' ? 'Your resource is published to learner spaces.' : 'Open your content library to review the decision.', target: 'Content library', read: false, time: now });
    sharedPlatform.activity = sharedPlatform.activity || [];
    sharedPlatform.activity.unshift({ text: `Admin ${body.decision.toLowerCase()} “${item.title}”`, time: now });
    savePlatform(); sendJson(res, 200, { submission: item }); return true;
  }  if (url.pathname === '/api/platform') {
    const auth = getSession(req);
    if (!auth?.user) { sendJson(res, 401, { error: 'Sign in to open the learning platform.' }); return true; }
    const role = auth.user.role;
    if (req.method === 'GET') {
      const view = { published: sharedPlatform.published || [], assignments: sharedPlatform.assignments || [], notifications: (sharedPlatform.notifications || []).filter(item => item.role === role && (!item.accountId || item.accountId === auth.user.id)), activity: role === 'Admin' ? sharedPlatform.activity || [] : [] };
      if (role === 'Admin') view.submissions = sharedPlatform.submissions || [];
      else if (role === 'Educator') view.submissions = (sharedPlatform.submissions || []).filter(item => item.authorId === auth.user.id);
      else view.assignmentResponses = (sharedPlatform.assignmentResponses || []).filter(item => item.studentId === auth.user.id);
      sendJson(res, 200, view); return true;
    }
    if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
    if (!sameOrigin(req)) { sendJson(res, 403, { error: 'Request origin could not be verified.' }); return true; }
    let body; try { body = await readBody(req, 500000); } catch { sendJson(res, 400, { error: 'Platform update could not be saved.' }); return true; }
    if (role === 'Educator') {
      for (const input of (Array.isArray(body.submissions) ? body.submissions : []).slice(0, 100)) {
        if (!input || input.authorId !== auth.user.id || typeof input.title !== 'string') continue;
        const resource = { ...input, authorId: auth.user.id, author: auth.user.name, authorEmail: auth.user.identifier, status: 'Pending' };
        if (!sharedPlatform.submissions.some(item => item.id === resource.id)) sharedPlatform.submissions.push(resource);
        if (!sharedPlatform.notifications.some(item => item.id === `submitted-${resource.id}`)) sharedPlatform.notifications.unshift({ id: `submitted-${resource.id}`, role: 'Admin', title: `Content submitted: ${resource.title}`, body: `${resource.type} · ${resource.subject} · ${resource.grade}`, target: 'Content review', read: false, time: new Date().toLocaleString() });
      }
    } else if (role === 'Admin') {
      for (const update of (Array.isArray(body.submissions) ? body.submissions : []).slice(0, 500)) {
        const item = sharedPlatform.submissions.find(entry => entry.id === update.id);
        if (!item || !['Approved', 'Rejected', 'Pending'].includes(update.status)) continue;
        const changed = item.status !== update.status; item.status = update.status;
        item.reviewNote = String(update.reviewNote || '').slice(0, 1200); item.reviewedAt = update.reviewedAt || new Date().toLocaleString();
        if (changed && update.status === 'Approved' && !sharedPlatform.published.some(resource => resource.id === item.id)) sharedPlatform.published.push({ ...item, status: 'Published' });
        if (changed && update.status === 'Approved') sharedPlatform.notifications.unshift({ id: `approved-${item.id}-${Date.now()}`, role: 'Student', title: `New approved ${String(item.type || 'learning resource').toLowerCase()}: ${item.title}`, body: `${item.subject || 'Learning'} · ${item.grade || 'All levels'} is now available in My learning.`, target: 'My learning', read: false, time: new Date().toLocaleString() });
        if (changed && update.status === 'Rejected') sharedPlatform.published = sharedPlatform.published.filter(resource => resource.id !== item.id);
        if (changed) sharedPlatform.notifications.unshift({ id: `decision-${item.id}-${Date.now()}`, role: item.authorRole || 'Educator', accountId: item.authorId || null, title: `Content ${update.status.toLowerCase()}: ${item.title}`, body: update.status === 'Approved' ? 'Your resource is published to learner spaces.' : 'Open your content library to review the decision.', target: 'Content library', read: false, time: new Date().toLocaleString() });
      }
      sharedPlatform.activity = (Array.isArray(body.activity) ? body.activity : sharedPlatform.activity).slice(0, 500);
      sharedPlatform.assignments = (Array.isArray(body.assignments) ? body.assignments : sharedPlatform.assignments).slice(0, 500);
    } else if (role === 'Student') {
      for (const input of (Array.isArray(body.assignmentResponses) ? body.assignmentResponses : []).slice(0, 500)) {
        if (!input || input.studentId !== auth.user.id || !(sharedPlatform.assignments || []).some(task => task.id === input.taskId)) continue;
        if (!sharedPlatform.assignmentResponses.some(response => response.taskId === input.taskId && response.studentId === auth.user.id)) sharedPlatform.assignmentResponses.unshift({ ...input, studentId: auth.user.id, student: auth.user.name });
      }
      for (const task of sharedPlatform.assignments || []) { const completed = sharedPlatform.assignmentResponses.some(response => response.taskId === task.id && response.studentId === auth.user.id); if (completed) task.completedBy = [...new Set([...(task.completedBy || []), auth.user.id])]; }
    }
    savePlatform(); sendJson(res, 200, { ok: true }); return true;
  }
  const publishedDelete = url.pathname.match(/^\/api\/platform\/published\/([^/]+)$/);
  if (publishedDelete && req.method === 'DELETE') {
    const auth = getSession(req);
    if (!auth?.user) { sendJson(res, 401, { error: 'Sign in to manage published content.' }); return true; }
    if (!sameOrigin(req)) { sendJson(res, 403, { error: 'Request origin could not be verified.' }); return true; }
    if (!['Admin', 'Educator'].includes(auth.user.role)) { sendJson(res, 403, { error: 'Only an administrator or the publishing educator can remove published content.' }); return true; }
    let id; try { id = decodeURIComponent(publishedDelete[1]); } catch { sendJson(res, 400, { error: 'Invalid content reference.' }); return true; }
    const index = (sharedPlatform.published || []).findIndex(item => item.id === id);
    if (index < 0) { sendJson(res, 404, { error: 'This published item could not be found.' }); return true; }
    const item = sharedPlatform.published[index];
    if (auth.user.role === 'Educator' && item.authorId !== auth.user.id) { sendJson(res, 403, { error: 'Educators can remove only content they created.' }); return true; }
    sharedPlatform.published.splice(index, 1);
    const submission = (sharedPlatform.submissions || []).find(entry => entry.id === id);
    if (submission) { submission.status = 'Removed'; submission.reviewedAt = new Date().toLocaleString(); }
    const taskIds = new Set((sharedPlatform.assignments || []).filter(task => task.contentId === id || task.id === `task-${id}`).map(task => task.id));
    sharedPlatform.assignments = (sharedPlatform.assignments || []).filter(task => !taskIds.has(task.id));
    const now = new Date().toLocaleString();
    sharedPlatform.activity = sharedPlatform.activity || [];
    sharedPlatform.activity.unshift({ text: `${auth.user.name} removed published content “${item.title}”`, time: now });
    if (item.authorId) sharedPlatform.notifications.unshift({ id: `removed-${id}-${Date.now()}`, role: 'Educator', accountId: item.authorId, title: `Published content removed: ${item.title}`, body: 'The item is no longer visible to learners.', target: 'Content library', read: false, time: now });
    savePlatform(); sendJson(res, 200, { ok: true, removedId: id }); return true;
  }
  if (url.pathname === '/api/messages') {
    const auth = getSession(req);
    if (!auth?.user) { sendJson(res, 401, { error: 'Sign in to open your inbox.' }); return true; }
    if (req.method === 'GET') {
      const visible = messages.filter(message => message.fromUserId === auth.user.id || message.toUserId === auth.user.id || (!message.toUserId && message.toRole === auth.user.role));
      sendJson(res, 200, { messages: visible }); return true;
    }
    if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
    if (!sameOrigin(req)) { sendJson(res, 403, { error: 'Request origin could not be verified.' }); return true; }
    let body; try { body = await readBody(req, 5000); } catch { sendJson(res, 400, { error: 'Message could not be sent.' }); return true; }
    const roles = ['Student', 'Educator', 'Parent'];
    const recipient = users.find(user => user.id === String(body.recipientId || ''));
    const recipientRole = String(body.recipientRole || '');
    const text = String(body.text || '').trim();
    if (!roles.includes(recipientRole) || recipientRole === auth.user.role || !recipient || recipient.role !== recipientRole || recipient.id === auth.user.id || !text || text.length > 1200) { sendJson(res, 400, { error: 'Choose a specific person and write a message up to 1,200 characters.' }); return true; }
    const message = { id: crypto.randomUUID(), fromUserId: auth.user.id, from: auth.user.name, fromRole: auth.user.role, toUserId: recipient.id, to: recipient.name, toRole: recipientRole, text, kind: body.kind === 'family-update' ? 'family-update' : 'message', time: new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) };
    messages.unshift(message); saveMessages();
    sharedPlatform.notifications.unshift({ id: `message-${message.id}`, role: recipient.role, accountId: recipient.id, title: message.kind === 'family-update' ? 'Family learning update' : `Message from ${auth.user.name}`, body: text.slice(0, 110), target: 'Messages', read: false, time: message.time });
    savePlatform(); sendJson(res, 201, { message }); return true;
  }
  if (url.pathname === '/api/contacts' && req.method === 'GET') {
    const auth = getSession(req);
    if (!auth?.user) { sendJson(res, 401, { error: 'Sign in to view your learning community.' }); return true; }
    const allowed = auth.user.role === 'Student' ? ['Educator', 'Parent'] : auth.user.role === 'Parent' ? ['Educator', 'Student'] : auth.user.role === 'Educator' ? ['Student', 'Parent'] : ['Student', 'Educator', 'Parent'];
    sendJson(res, 200, { contacts: users.filter(user => user.id !== auth.user.id && allowed.includes(user.role)).map(user => ({ id: user.id, name: user.name, role: user.role })) }); return true;
  }
  if (url.pathname === '/api/parent/link' && req.method === 'POST') {
    const auth = getSession(req);
    if (!auth?.user) { sendJson(res, 401, { error: 'Sign in to link a learner.' }); return true; }
    if (auth.user.role !== 'Parent') { sendJson(res, 403, { error: 'Only a parent account can request a learner link.' }); return true; }
    if (!sameOrigin(req)) { sendJson(res, 403, { error: 'Request origin could not be verified.' }); return true; }
    let body; try { body = await readBody(req, 5000); } catch { sendJson(res, 400, { error: 'Enter the learner’s sign-in email or phone number.' }); return true; }
    const identifier = String(body.identifier || '').trim();
    if (!validIdentifier(identifier)) { sendJson(res, 400, { error: 'Enter a valid learner email address or phone number.' }); return true; }
    const learner = users.find(user => user.role === 'Student' && user.identifier === accountKey(identifier));
    if (!learner) { sendJson(res, 404, { error: 'No learner account matched that email or phone number.' }); return true; }
    if (learner.guardianIdentifier === auth.user.identifier) { sendJson(res, 200, { ok: true, status: 'Approved', learner: learner.name }); return true; }
    learner.linkRequests = learner.linkRequests || [];
    let request = learner.linkRequests.find(item => item.parentId === auth.user.id && item.status === 'Pending');
    if (!request) {
      request = { id: crypto.randomUUID(), parentId: auth.user.id, parentName: auth.user.name, status: 'Pending', createdAt: new Date().toISOString() };
      learner.linkRequests.unshift(request); saveUsers();
        if (changed && update.status === 'Approved') sharedPlatform.notifications.unshift({ id: `approved-${item.id}-${Date.now()}`, role: 'Student', title: `New approved ${String(item.type || 'learning resource').toLowerCase()}: ${item.title}`, body: `${item.subject || 'Learning'} · ${item.grade || 'All levels'} is now available in My learning.`, target: 'My learning', read: false, time: new Date().toLocaleString() });
    }
    sendJson(res, 200, { ok: true, status: request.status, learner: learner.name }); return true;
  }
  if (url.pathname === '/api/parent/requests' && req.method === 'GET') {
    const auth = getSession(req);
    if (!auth?.user || auth.user.role !== 'Parent') { sendJson(res, auth?.user ? 403 : 401, { error: 'Parent sign-in is required.' }); return true; }
    const requests = users.filter(user => user.role === 'Student').flatMap(user => (user.linkRequests || []).filter(item => item.parentId === auth.user.id).map(item => ({ id: item.id, learnerId: user.id, learner: user.name, status: item.status, createdAt: item.createdAt })));
    sendJson(res, 200, { requests }); return true;
  }
  if (url.pathname === '/api/parent/link-requests' && req.method === 'GET') {
    const auth = getSession(req);
    if (!auth?.user || auth.user.role !== 'Student') { sendJson(res, auth?.user ? 403 : 401, { error: 'Learner sign-in is required.' }); return true; }
    sendJson(res, 200, { requests: (auth.user.linkRequests || []).filter(item => item.status === 'Pending').map(({ id, parentName, createdAt }) => ({ id, parentName, createdAt })) }); return true;
  }
  if (url.pathname === '/api/parent/link-requests/respond' && req.method === 'POST') {
    const auth = getSession(req);
    if (!auth?.user || auth.user.role !== 'Student') { sendJson(res, auth?.user ? 403 : 401, { error: 'Learner sign-in is required.' }); return true; }
    if (!sameOrigin(req)) { sendJson(res, 403, { error: 'Request origin could not be verified.' }); return true; }
    let body; try { body = await readBody(req, 5000); } catch { sendJson(res, 400, { error: 'Request could not be updated.' }); return true; }
    const request = (auth.user.linkRequests || []).find(item => item.id === body.id && item.status === 'Pending');
    if (!request || !['Approved', 'Declined'].includes(body.decision)) { sendJson(res, 404, { error: 'That access request is no longer available.' }); return true; }
    request.status = body.decision; request.respondedAt = new Date().toISOString();
    if (body.decision === 'Approved') auth.user.guardianIdentifier = users.find(user => user.id === request.parentId)?.identifier || '';
    sharedPlatform.notifications.unshift({ id: `link-response-${request.id}`, role: 'Parent', accountId: request.parentId, title: body.decision === 'Approved' ? 'Learner linked successfully' : 'Learner access request declined', body: body.decision === 'Approved' ? `${auth.user.name} approved progress sharing.` : `${auth.user.name} declined the progress sharing request.`, target: 'Child progress', read: false, time: new Date().toLocaleString() });
    saveUsers(); savePlatform(); sendJson(res, 200, { ok: true, status: request.status }); return true;
  }
  if (url.pathname === '/api/parent/child' && req.method === 'GET') {
    const auth = getSession(req);
    if (!auth?.user) { sendJson(res, 401, { error: 'Sign in to view family progress.' }); return true; }
    if (auth.user.role !== 'Parent') { sendJson(res, 403, { error: 'This role cannot view family progress.' }); return true; }
    const child = users.find(user => user.role === 'Student' && user.guardianIdentifier === auth.user.identifier);
    sendJson(res, 200, { child: child ? { id: child.id, name: child.name, progress: child.learning?.progress || {}, saved: child.learning?.saved || [], updatedAt: child.learning?.updatedAt || null } : null }); return true;
  }  if (url.pathname === '/api/classroom/progress' && req.method === 'GET') {
    const auth = getSession(req);
    if (!auth?.user) { sendJson(res, 401, { error: 'Sign in to view classroom progress.' }); return true; }
    if (auth.user.role !== 'Educator' && auth.user.role !== 'Admin') { sendJson(res, 403, { error: 'This role cannot view classroom progress.' }); return true; }
    const students = users.filter(user => user.role === 'Student').map(user => ({ id: user.id, name: user.name, progress: user.learning?.progress || {}, completed: Object.values(user.learning?.progress || {}).filter(value => Number(value) >= 100).length, updatedAt: user.learning?.updatedAt || null }));
    sendJson(res, 200, { students }); return true;
  }  if (url.pathname === '/api/sync') {
    const auth = getSession(req);
    if (!auth?.user) { sendJson(res, 401, { error: 'Sign in to synchronize your learning.' }); return true; }
    if (req.method === 'GET') { sendJson(res, 200, { learning: auth.user.learning || {}, preferences: auth.user.accessibility || {}, guardianIdentifier: auth.user.guardianIdentifier || '' }); return true; }
    if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed.' }); return true; }
    if (!sameOrigin(req)) { sendJson(res, 403, { error: 'Request origin could not be verified.' }); return true; }
    let body; try { body = await readBody(req, 12000); } catch { sendJson(res, 400, { error: 'Learning data could not be saved.' }); return true; }
    const progress = {};
    if (body.progress && typeof body.progress === 'object') for (const [id, value] of Object.entries(body.progress).slice(0, 200)) if (/^[a-zA-Z0-9_-]{1,100}$/.test(id) && Number.isFinite(Number(value))) progress[id] = Math.max(0, Math.min(100, Number(value)));
    const saved = Array.isArray(body.saved) ? [...new Set(body.saved.filter(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id)))].slice(0, 200) : [];
    const language = ['English', 'Yorùbá', 'Kiswahili', 'Français'].includes(body.language) ? body.language : (auth.user.language || 'English');
    auth.user.guardianIdentifier = String(body.guardianIdentifier || '').trim() && validIdentifier(String(body.guardianIdentifier).trim()) ? accountKey(String(body.guardianIdentifier).trim()) : '';
    const accessibility = body.accessibility && typeof body.accessibility === 'object' ? { font: [100,112,125].includes(Number(body.accessibility.font)) ? Number(body.accessibility.font) : 100, contrast: Boolean(body.accessibility.contrast), tts: Boolean(body.accessibility.tts), stt: Boolean(body.accessibility.stt) } : (auth.user.accessibility || {});
    auth.user.learning = { progress, saved, updatedAt: new Date().toISOString() };
    auth.user.language = language; auth.user.accessibility = accessibility;
    if (typeof body.name === 'string' && body.name.trim().length >= 2) auth.user.name = body.name.trim().slice(0, 100);
    saveUsers(); sendJson(res, 200, { ok: true, updatedAt: auth.user.learning.updatedAt }); return true;
  }  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    const auth = getSession(req);
    sendJson(res, 200, { user: auth?.user ? publicUser(auth.user) : null }); return true;
  }
  if (req.method === 'GET' && url.pathname === '/api/auth/oauth/google') { await startOAuth(req, res, url, 'google'); return true; }
  if (req.method === 'GET' && url.pathname === '/api/auth/oauth/facebook') { await startOAuth(req, res, url, 'facebook'); return true; }
  if (req.method === 'GET' && url.pathname === '/api/auth/oauth/google/callback') { await finishOAuth(req, res, url, 'google'); return true; }
  if (req.method === 'GET' && url.pathname === '/api/auth/oauth/facebook/callback') { await finishOAuth(req, res, url, 'facebook'); return true; }
  if (req.method === 'POST' && ['/api/auth/register', '/api/auth/login', '/api/auth/logout'].includes(url.pathname)) {
    if (!sameOrigin(req)) { sendJson(res, 403, { error: 'Request origin could not be verified.' }); return true; }
    let body; try { body = await readBody(req); } catch { sendJson(res, 400, { error: 'Check the form and try again.' }); return true; }
    if (url.pathname === '/api/auth/logout') { const auth = getSession(req); if (auth) sessions.delete(auth.token); clearCookie(req, res); sendJson(res, 200, { ok: true }); return true; }
    if (tooManyAttempts(req)) { sendJson(res, 429, { error: 'Too many attempts. Wait 2 minutes and try again.' }); return true; }
    const identifier = String(body.identifier || '').trim();
    if (!validIdentifier(identifier)) { sendJson(res, 400, { error: 'Enter a valid email address or phone number.' }); return true; }
    const key = accountKey(identifier);
    if (url.pathname.endsWith('/register')) {
      if (!roleValid(body.role)) { sendJson(res, 400, { error: 'Choose Student, Educator, or Parent. Admin accounts must be provisioned by the server owner.' }); return true; }
      if (String(body.name || '').trim().length < 2) { sendJson(res, 400, { error: 'Enter your full name.' }); return true; }
      if (String(body.password || '').length < 8) { sendJson(res, 400, { error: 'Use a password with at least 8 characters.' }); return true; }
      if (users.some(user => user.identifier === key)) { sendJson(res, 409, { error: 'An account already uses this email or phone number. Sign in instead.' }); return true; }
      const user = await makeUser({ name: body.name, identifier, password: body.password, role: body.role }); users.push(user); saveUsers(); createSession(req, res, user); sendJson(res, 201, { user: publicUser(user) }); return true;
    }
    const user = users.find(item => item.identifier === key);
    let accepted = false;
    if (user && user.passwordHash) { const hash = await scrypt(String(body.password || ''), user.salt, 64); accepted = crypto.timingSafeEqual(hash, Buffer.from(user.passwordHash, 'hex')); }
    if (!accepted || !user || user.role !== body.role) { sendJson(res, 401, { error: 'Those sign-in details do not match an account for this role.' }); return true; }
    createSession(req, res, user); sendJson(res, 200, { user: publicUser(user) }); return true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
  catch { res.writeHead(400).end('Bad request'); return; }
  try { if (url.pathname.startsWith('/api/')) { if (!await handleApi(req, res, url)) sendJson(res, 404, { error: 'API route not found.' }); return; } }
  catch { if (!res.headersSent) sendJson(res, 500, { error: 'The request could not be completed.' }); return; }
  let requested;
  try { requested = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end('Bad request'); return; }
  const file = path.resolve(root, `.${requested === '/' ? '/index.html' : requested}`);
  if (!file.startsWith(root + path.sep) || file.startsWith(dataDir + path.sep) || file === usersFile) { res.writeHead(403).end('Forbidden'); return; }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
    fs.createReadStream(file).pipe(res);
  });
});
async function start() {
  const adminIdentifier = String(process.env.ADMIN_EMAIL || 'admin@inclusivelearn.africa').trim();
  const adminPassword = String(process.env.ADMIN_PASSWORD || 'admin@123');
  if (adminIdentifier && adminPassword) {
    if (!validIdentifier(adminIdentifier) || (process.env.ADMIN_PASSWORD && adminPassword.length < 12)) throw new Error('ADMIN_EMAIL must be valid and a custom ADMIN_PASSWORD must be at least 12 characters.');
    const key = accountKey(adminIdentifier);
    if (!users.some(user => user.identifier === key)) {
      users.push(await makeUser({ name: process.env.ADMIN_NAME || 'Platform Administrator', identifier: adminIdentifier, password: adminPassword, role: 'Admin' }));
      saveUsers();
    }
  }
  listenOnAvailablePort(port, !process.env.PORT);
}
function listenOnAvailablePort(candidatePort, allowFallback) {
  const onListening = () => {
    const address = server.address();
    if (address && typeof address === 'object' && address.port === candidatePort) {
      console.log(`InclusiveLearn Africa is running at http://localhost:${address.port}`);
    }
  };
  const onError = error => {
    // A failed listen never emits `listening`; remove this attempt's callback
    // before trying the next port so retries do not accumulate listeners.
    server.removeListener('listening', onListening);
    if (error.code === 'EADDRINUSE' && allowFallback && candidatePort < port + 50) {
      console.log(`Port ${candidatePort} is already in use; trying ${candidatePort + 1}.`);
      setImmediate(() => listenOnAvailablePort(candidatePort + 1, allowFallback));
      return;
    }
    console.error(error.message);
    process.exitCode = 1;
  };
  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(candidatePort, '0.0.0.0');
}
start().catch(error => { console.error(error.message); process.exitCode = 1; });
