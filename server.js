const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 43127);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const SECRET = process.env.APP_SECRET || 'CHANGE_THIS_SECRET_IN_PRODUCTION';

// Change these passwords before exposing the app publicly.
const USERS = {
  amin:   { password: '123456', role: 'admin',  label: 'Amin' },
  viewer: { password: '123456', role: 'viewer', label: 'Viewer' },
  task:   { password: '123456', role: 'task',   label: 'Task' }
};

const PUBLIC_FILES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/style.css': 'style.css',
  '/app.js': 'app.js'
};

let writeQueue = Promise.resolve();

function blankState() {
  return { tasks: [], requests: [], dailyLogs: {} };
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(blankState(), null, 2), 'utf8');
  }
}

function normalizeState(data) {
  return {
    tasks: Array.isArray(data?.tasks) ? data.tasks : [],
    requests: Array.isArray(data?.requests) ? data.requests : [],
    dailyLogs: data?.dailyLogs && typeof data.dailyLogs === 'object' ? data.dailyLogs : {}
  };
}

function readState() {
  ensureDataFile();
  try {
    return normalizeState(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
  } catch (error) {
    console.error('Could not read data.json:', error);
    return blankState();
  }
}

function writeState(state) {
  const normalized = normalizeState(state);
  writeQueue = writeQueue.then(async () => {
    const temp = `${DATA_FILE}.tmp`;
    await fs.promises.writeFile(temp, JSON.stringify(normalized, null, 2), 'utf8');
    await fs.promises.rename(temp, DATA_FILE);
    return normalized;
  });
  return writeQueue;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(payload);
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({
    username: user.username,
    role: user.role,
    label: user.label,
    exp: Date.now() + 12 * 60 * 60 * 1000
  })).toString('base64url');

  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.exp || decoded.exp < Date.now()) return null;
    const account = USERS[decoded.username];
    if (!account) return null;
    return { username: decoded.username, role: account.role, label: account.label };
  } catch {
    return null;
  }
}

function authUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return verifyToken(header.slice(7));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeNotesForTask(currentTask, incomingTask) {
  const currentNotes = Array.isArray(currentTask.notes) ? currentTask.notes : [];
  const incomingNotes = Array.isArray(incomingTask.notes) ? incomingTask.notes : [];
  const currentById = new Map(currentNotes.map(n => [n.id, n]));
  const incomingById = new Map(incomingNotes.map(n => [n.id, n]));
  const result = [];

  // Existing notes: Amin's notes cannot be edited/deleted by Task.
  for (const oldNote of currentNotes) {
    if (oldNote.author !== 'task') {
      result.push(clone(oldNote));
      continue;
    }

    // Task may delete its own note by omitting it.
    const proposed = incomingById.get(oldNote.id);
    if (!proposed) continue;

    result.push({
      ...clone(oldNote),
      text: String(proposed.text || '').trim() || oldNote.text,
      tags: Array.isArray(proposed.tags) ? proposed.tags.map(String).slice(0, 100) : (oldNote.tags || []),
      author: 'task',
      updatedAt: proposed.updatedAt || new Date().toISOString()
    });
  }

  // New Task notes are allowed. The server forces ownership to task.
  for (const note of incomingNotes) {
    if (currentById.has(note.id)) continue;
    if (!note.id || !String(note.text || '').trim()) continue;
    const now = new Date().toISOString();
    result.push({
      id: String(note.id),
      text: String(note.text).trim(),
      tags: Array.isArray(note.tags) ? note.tags.map(String).slice(0, 100) : [],
      author: 'task',
      createdAt: note.createdAt || now,
      updatedAt: note.updatedAt || now
    });
  }

  return result;
}

function sanitizeTaskUserWrite(current, incoming) {
  const next = clone(current);
  const incomingTasks = Array.isArray(incoming.tasks) ? incoming.tasks : [];
  const incomingById = new Map(incomingTasks.map(t => [t.id, t]));

  // Task cannot directly create/delete/edit approved task fields.
  next.tasks = current.tasks.map(oldTask => {
    const proposed = incomingById.get(oldTask.id);
    if (!proposed) return clone(oldTask);
    return {
      ...clone(oldTask),
      notes: sanitizeNotesForTask(oldTask, proposed)
    };
  });

  // Task can create/update/delete only its own approval requests.
  const currentForeignRequests = current.requests.filter(r => r.createdBy !== 'task');
  const proposedOwnRequests = (Array.isArray(incoming.requests) ? incoming.requests : [])
    .filter(r => r.createdBy === 'task')
    .filter(r => ['create', 'edit', 'delete'].includes(r.type))
    .map(r => ({
      id: String(r.id || ''),
      type: r.type,
      taskId: r.taskId ? String(r.taskId) : null,
      taskTitle: String(r.taskTitle || ''),
      payload: r.payload && typeof r.payload === 'object' ? clone(r.payload) : null,
      createdAt: r.createdAt || new Date().toISOString(),
      createdBy: 'task'
    }))
    .filter(r => r.id);

  next.requests = [...currentForeignRequests, ...proposedOwnRequests];

  // Shared Amin daily log is read-only for Task.
  next.dailyLogs = clone(current.dailyLogs || {});

  return next;
}

function stateForUser(state, user) {
  if (user.role === 'viewer') {
    return {
      tasks: state.tasks.map(task => ({ ...clone(task), notes: [] })),
      requests: [],
      dailyLogs: { amin: clone(state.dailyLogs?.amin || {}) }
    };
  }

  if (user.role === 'task') {
    return {
      tasks: clone(state.tasks),
      requests: clone(state.requests),
      dailyLogs: { amin: clone(state.dailyLogs?.amin || {}) }
    };
  }

  return clone(state);
}

function mime(filename) {
  if (filename.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filename.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filename.endsWith('.js')) return 'application/javascript; charset=utf-8';
  return 'application/octet-stream';
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const mapped = PUBLIC_FILES[url.pathname];
  if (!mapped) return false;
  const file = path.join(ROOT, mapped);
  if (!fs.existsSync(file)) return false;

  const stat = fs.statSync(file);
  res.writeHead(200, {
    'Content-Type': mime(file),
    'Content-Length': stat.size,
    'Cache-Control': mapped === 'index.html' ? 'no-cache' : 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff'
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/login' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '').trim().toLowerCase();
      const account = USERS[username];

      if (!account || String(account.password).toLowerCase() !== password) {
        return sendJson(res, 401, { error: 'Invalid username or password.' });
      }

      const user = { username, role: account.role, label: account.label };
      return sendJson(res, 200, { token: signToken(user), user });
    }

    if (url.pathname === '/api/me' && req.method === 'GET') {
      const user = authUser(req);
      if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });
      return sendJson(res, 200, { user });
    }

    if (url.pathname === '/api/state' && req.method === 'GET') {
      const user = authUser(req);
      if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });
      return sendJson(res, 200, stateForUser(readState(), user));
    }

    if (url.pathname === '/api/state' && req.method === 'PUT') {
      const user = authUser(req);
      if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });
      if (user.role === 'viewer') return sendJson(res, 403, { error: 'Viewer is read-only.' });

      const incoming = normalizeState(await readJsonBody(req));
      const current = readState();
      const next = user.role === 'admin' ? incoming : sanitizeTaskUserWrite(current, incoming);
      const saved = await writeState(next);
      return sendJson(res, 200, { state: stateForUser(saved, user) });
    }

    if (url.pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: 'API route not found.' });
    }

    if (serveStatic(req, res)) return;
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (error) {
    console.error(error);
    if (!res.headersSent) sendJson(res, 500, { error: 'Server error.' });
    else res.end();
  }
});

ensureDataFile();
server.listen(PORT, HOST, () => {
  console.log(`Amin Workspace running on http://${HOST}:${PORT}`);
  if (SECRET === 'CHANGE_THIS_SECRET_IN_PRODUCTION') {
    console.warn('WARNING: set APP_SECRET before production use.');
  }
});
