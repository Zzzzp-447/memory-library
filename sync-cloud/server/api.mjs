const API = '/api/v1';
const encoder = new TextEncoder();
const HEX = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const SESSION_MS = 30 * 86400000;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
const random = size => hex(crypto.getRandomValues(new Uint8Array(size)));
const digest = async value => hex(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? encoder.encode(value) : value));
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: 100000, salt: encoder.encode(salt) }, key, 256));
}
function equal(a, b) { let difference = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return difference === 0; }
function text(value, limit = 200) { return typeof value === 'string' && value.length > 0 && value.length <= limit; }
function validId(value) { return typeof value === 'string' && ID.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value); }
function number(value) { return Number.isSafeInteger(value) && value >= 0; }
async function bytes(request, limit) {
  const chunks = []; let size = 0;
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > limit) { await reader.cancel(); fail(413, '上传内容过大，原资料仍保存在本机。'); } chunks.push(next.value); }
  const data = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; } return data;
}
async function body(request, limit = 1048576) {
  try { return JSON.parse(new TextDecoder().decode(await bytes(request, limit))); }
  catch (error) { if (error.status) throw error; fail(400, '请求格式不正确。'); }
}
async function rate(env, request, action, limit, windowMs) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const id = await digest(`${action}:${ip}:${Math.floor(Date.now() / windowMs)}`);
  const row = await env.DB.prepare('INSERT INTO rate_limits(id,count,reset_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(id, Date.now() + windowMs).first();
  if (row.count > limit) fail(429, '请求过于频繁，请稍后再试。');
}
async function auth(env, request) {
  const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) fail(401, '请先登录同步账号。');
  const tokenHash = await digest(token);
  const user = await env.DB.prepare('SELECT users.id,users.email,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?').bind(tokenHash, Date.now()).first();
  if (!user) fail(401, '登录已过期，请重新登录；未上传资料仍保留在本机。');
  return { ...user, tokenHash };
}
function credentials(data, registration = false) {
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, '请输入有效的邮箱作为账号。');
  if (typeof data.password !== 'string' || data.password.length > 128 || data.password.length < (registration ? 12 : 1)) fail(400, '密码需要 12–128 个字符。');
  return { email, password: data.password };
}
function validateTree(value) {
  const stack = [value]; let count = 0;
  while (stack.length) {
    const item = stack.pop(); if (!item || typeof item !== 'object') continue;
    if (++count > 30000) fail(400, '导图内容过多，请拆分后同步。');
    for (const [key, child] of Object.entries(item)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail(400, '资料含有不支持的字段。');
      if (key === 'hyperLink' && child && (typeof child !== 'string' || !/^https?:\/\//i.test(child))) fail(400, '导图链接只支持 HTTP 或 HTTPS 地址。');
      if (child && typeof child === 'object') stack.push(child);
    }
  }
}
function mapAssets(data) {
  const keys = new Set(), stack = [data.nodeData];
  while (stack.length) { const node = stack.pop(); for (const image of [node?.image, node?.metadata?.imageAttachment]) { const match = /^memory-asset:([a-f0-9]{64})$/.exec(image?.url || ''); if (match) keys.add(match[1]); } if (Array.isArray(node?.children)) stack.push(...node.children); }
  return [...keys];
}
function validateOperation(op) {
  if (!op || !validId(op.id) || !number(op.at) || !text(op.device, 80) || !op.body || typeof op.body !== 'object') fail(400, '同步记录格式异常。');
  const b = op.body;
  if (JSON.stringify(b).length > 500000) fail(413, '单份导图过大，请拆分；本机资料不会被删除。');
  validateTree(b);
  if (op.kind === 'subject') {
    if (!validId(b.id) || !text(b.name, 120) || !['blue', 'yellow', 'cream', 'red'].includes(b.color)) fail(400, '学科记录无效。');
  } else if (op.kind === 'chapter') {
    if (!validId(b.id) || !validId(b.subjectId) || !text(b.name, 120)) fail(400, '章节记录无效。');
  } else if (op.kind === 'card') {
    if (!validId(b.id) || !validId(b.subjectId) || !validId(b.chapterId) || !HEX.test(b.frontHash) || !HEX.test(b.backHash) || !number(b.createdAt) || !number(b.correct) || !number(b.wrong) || !Array.isArray(b.tags) || b.tags.length > 100 || b.tags.some(tag => !text(tag, 300))) fail(400, '卡片记录无效。');
    for (const key of ['nextReviewAt', 'lastReviewedAt', 'reviewStep', 'reviewStreak']) if (b[key] !== undefined && !number(b[key])) fail(400, '复习记录无效。');
    if (b.mapSupplement !== undefined && (!b.mapSupplement || !['knowledge', 'technique'].includes(b.mapSupplement.kind) || !text(b.mapSupplement.text, 300))) fail(400, '知识点或解题技巧格式无效。');
  } else if (op.kind === 'review') {
    if (!validId(b.cardId) || !['correct', 'wrong'].includes(b.result) || !number(b.at)) fail(400, '复习结果无效。');
  } else if (op.kind === 'goal') {
    if (!Number.isInteger(b.value) || b.value < 2 || b.value > 12) fail(400, '复习门槛无效。');
  } else if (op.kind === 'map') {
    if (!validId(b.subjectId) || !Array.isArray(b.parents) || b.parents.length > 100 || b.parents.some(id => !validId(id)) || !b.value?.data?.nodeData || !text(b.value.data.nodeData.topic, 4000)) fail(400, '导图记录无效。');
  } else fail(400, '不支持的同步记录类型。');
  return { id: op.id, at: op.at, device: op.device, kind: op.kind, body: b };
}
function imageMime(data) {
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg';
  if (data[0] === 137 && String.fromCharCode(...data.slice(1, 4)) === 'PNG') return 'image/png';
  if (String.fromCharCode(...data.slice(0, 3)) === 'GIF') return 'image/gif';
  if (String.fromCharCode(...data.slice(0, 4)) === 'RIFF' && String.fromCharCode(...data.slice(8, 12)) === 'WEBP') return 'image/webp';
  if (data[0] === 66 && data[1] === 77) return 'image/bmp';
  fail(400, '仅支持图片文件，不能上传网页或脚本。');
}

export async function handleApi(request, env) {
  const url = new URL(request.url), path = url.pathname.slice(API.length);
  const origin = request.headers.get('origin');
  const allowedOrigin = !origin || origin === url.origin || origin === 'https://appassets.androidplatform.net' || (env.LOCAL_DEV && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin));
  const cors = { 'Access-Control-Allow-Origin': allowedOrigin && origin ? origin : url.origin, 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Vary': 'Origin' };
  let response;
  try {
    if (!allowedOrigin) fail(403, '这个来源没有被允许访问同步服务。');
    if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
    else if (!env.DB || !env.BUCKET) fail(503, '云端存储尚未配置。');
    else if (path === '/health') response = json({ ok: true, protocol: 1 });
    else if (['/register', '/login', '/reset-password'].includes(path) && request.method === 'POST') {
      await rate(env, request, 'auth', 60, 900000);
      const input = await body(request, 4096), { email, password } = credentials(input, path !== '/login');
      let user = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
      const token = random(32), tokenHash = await digest(token), expiresAt = Date.now() + SESSION_MS;
      let recoveryCode;
      if (path === '/register') {
        await rate(env, request, 'register', 5, 3600000);
        if (user) fail(409, '这个邮箱无法注册，请尝试登录。');
        const id = crypto.randomUUID(), salt = random(16); recoveryCode = random(24);
        const hash = await passwordHash(password, salt), recoveryHash = await digest(recoveryCode);
        await env.DB.batch([
          env.DB.prepare('INSERT INTO users(id,email,password_hash,salt,recovery_hash,created_at) VALUES(?,?,?,?,?,?)').bind(id, email, hash, salt, recoveryHash, Date.now()),
          env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(tokenHash, id, expiresAt),
        ]);
        user = { id, email };
      } else if (path === '/reset-password') {
        if (!text(input.recoveryCode, 100) || !user || !equal(await digest(input.recoveryCode.trim()), user.recovery_hash)) fail(401, '邮箱或恢复码不正确。');
        const salt = random(16), hash = await passwordHash(password, salt);
        await env.DB.batch([
          env.DB.prepare('UPDATE users SET password_hash=?,salt=? WHERE id=?').bind(hash, salt, user.id),
          env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id),
          env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(tokenHash, user.id, expiresAt),
        ]);
      } else {
        const hash = await passwordHash(password, user?.salt || 'invalid-user-dummy-salt');
        if (!user || !equal(hash, user.password_hash)) fail(401, '邮箱或密码不正确。');
        await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(tokenHash, user.id, expiresAt).run();
      }
      response = json({ user: { id: user.id, email: user.email }, token, expiresAt, ...(recoveryCode ? { recoveryCode } : {}) });
    } else {
      const user = await auth(env, request);
      if (path === '/me' && request.method === 'GET') response = json({ user: { id: user.id, email: user.email }, expiresAt: user.expires_at });
      else if (path === '/logout' && request.method === 'POST') {
        await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.tokenHash).run(); response = json({ ok: true });
      } else if (path.startsWith('/assets/') && HEX.test(path.slice(8))) {
        const hash = path.slice(8), key = `u/${user.id}/${hash}`;
        if (request.method === 'PUT') {
          const data = await bytes(request, 10 * 1024 * 1024);
          if (await digest(data) !== hash) fail(400, '图片校验失败，请重新上传。');
          const mime = imageMime(data);
          const old = await env.DB.prepare('SELECT size FROM assets WHERE user_id=? AND hash=?').bind(user.id, hash).first();
          if (!old) {
            const total = await env.DB.prepare('SELECT COALESCE(SUM(size),0) AS size FROM assets WHERE user_id=?').bind(user.id).first();
            if (total.size + data.byteLength > 500 * 1024 * 1024) fail(413, '账号图片存储已达到 500 MB；未上传资料仍保留在本机。');
          }
          await env.BUCKET.put(key, data, { httpMetadata: { contentType: mime } });
          await env.DB.prepare('INSERT OR IGNORE INTO assets(user_id,hash,size,mime) VALUES(?,?,?,?)').bind(user.id, hash, data.byteLength, mime).run();
          response = json({ hash, size: data.byteLength });
        } else if (request.method === 'GET') {
          const record = await env.DB.prepare('SELECT mime FROM assets WHERE user_id=? AND hash=?').bind(user.id, hash).first();
          const object = record && await env.BUCKET.get(key);
          if (!object) fail(404, '图片尚未上传完整，请稍后重试同步。');
          response = new Response(object.body || await object.arrayBuffer(), { headers: { 'Content-Type': record.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
        } else fail(405, '不支持这个请求方法。');
      } else if (path === '/operations' && request.method === 'GET') {
        const cursor = Number(url.searchParams.get('cursor') || 0);
        if (!number(cursor)) fail(400, '同步位置无效。');
        const result = await env.DB.prepare('SELECT seq,op_id,kind,payload,client_at,device FROM operations WHERE user_id=? AND seq>? ORDER BY seq LIMIT 51').bind(user.id, cursor).all();
        const rows = result.results.slice(0, 50), head = await env.DB.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM operations WHERE user_id=?').bind(user.id).first();
        response = json({ userId: user.id, operations: rows.map(row => ({ seq: row.seq, id: row.op_id, kind: row.kind, at: row.client_at, device: row.device, body: JSON.parse(row.payload) })), nextCursor: rows.at(-1)?.seq ?? cursor, head: head.seq, hasMore: result.results.length > 50 });
      } else if (path === '/operations' && request.method === 'POST') {
        await rate(env, request, `write:${user.id}`, 600, 60000);
        const input = await body(request);
        if (!Array.isArray(input.operations) || input.operations.length < 1 || input.operations.length > 100) fail(400, '每次同步需要 1–100 条记录。');
        const ops = input.operations.map(validateOperation), statements = [];
        for (const op of ops) {
          const hash = await digest(JSON.stringify(op));
          const old = await env.DB.prepare('SELECT hash FROM operations WHERE user_id=? AND op_id=?').bind(user.id, op.id).first();
          if (old && old.hash !== hash) fail(409, '同步记录编号冲突，本机记录已保留。');
          for (const image of op.kind === 'card' ? [op.body.frontHash, op.body.backHash] : op.kind === 'map' ? mapAssets(op.body.value.data) : []) {
            const asset = await env.DB.prepare('SELECT hash FROM assets WHERE user_id=? AND hash=?').bind(user.id, image).first();
            if (!asset) fail(409, '图片未上传完整，卡片暂未提交。');
          }
          statements.push(env.DB.prepare('INSERT OR IGNORE INTO operations(user_id,op_id,kind,payload,client_at,device,hash) VALUES(?,?,?,?,?,?,?)').bind(user.id, op.id, op.kind, JSON.stringify(op.body), op.at, op.device, hash));
        }
        await env.DB.batch(statements);
        const acknowledged = [];
        for (const op of ops) {
          const row = await env.DB.prepare('SELECT seq,hash FROM operations WHERE user_id=? AND op_id=?').bind(user.id, op.id).first();
          if (row.hash !== await digest(JSON.stringify(op))) fail(409, '同步记录编号冲突，本机记录已保留。');
          acknowledged.push({ id: op.id, seq: row.seq });
        }
        response = json({ userId: user.id, acknowledged });
      } else fail(404, '没有这个同步接口。');
    }
  } catch (error) {
    if (!error.status) console.error('Sync API error:', error?.name || 'Error');
    response = json({ error: error.status ? error.message : '云端暂时未能完成操作，未上传资料仍保留在本机。' }, error.status || 500);
  }
  for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
  return response;
}
