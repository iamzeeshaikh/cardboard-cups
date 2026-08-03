/**
 * Enquiry endpoint. Runs on the server only — SMTP credentials are read from
 * the environment and never reach the browser bundle.
 *
 * Protections: honeypot, per-IP rate limit, strict field validation,
 * allow-listed upload types with a magic-byte check, sanitised filenames,
 * and header-injection-safe mail composition.
 */
import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

export const prerender = false;

const MAX_UPLOAD = 8 * 1024 * 1024;
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 5 };

/** Extension -> allowed MIME types. Anything executable is absent by design. */
const ALLOWED_UPLOADS: Record<string, string[]> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  webp: ['image/webp'],
  svg: ['image/svg+xml'],
  ai: ['application/pdf', 'application/postscript', 'application/illustrator'],
  eps: ['application/postscript', 'image/x-eps'],
};

/** Leading bytes we insist on, so a renamed .exe cannot pose as a PDF. */
const MAGIC: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]],
  png: [[0x89, 0x50, 0x4e, 0x47]],
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  webp: [[0x52, 0x49, 0x46, 0x46]],
  ai: [[0x25, 0x50, 0x44, 0x46], [0x25, 0x21, 0x50, 0x53]],
  eps: [[0x25, 0x21, 0x50, 0x53], [0xc5, 0xd0, 0xd3, 0xc6]],
};

const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (!times.some((t) => now - t < RATE_LIMIT.windowMs)) hits.delete(key);
    }
  }
  return recent.length > RATE_LIMIT.max;
}

/** Drop control characters; keep tabs/newlines and every printable character. */
const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, max) : '';

/** Strip CR/LF so a submitted value can never inject a mail header. */
const headerSafe = (v: string) => v.replace(/[\r\n]+/g, ' ').trim();

const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function sanitiseFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? 'upload';
  const ext = base.includes('.') ? base.split('.').pop()!.toLowerCase() : '';
  const stem = base.slice(0, base.length - (ext ? ext.length + 1 : 0));
  const safeStem = stem.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[.-]+/, '').slice(0, 80) || 'artwork';
  return { filename: ext ? `${safeStem}.${ext}` : safeStem, ext };
}

function startsWithAny(bytes: Uint8Array, patterns: number[][]) {
  return patterns.some((p) => p.every((b, i) => bytes[i] === b));
}

function env(key: string) {
  return process.env[key] ?? (import.meta.env as Record<string, string | undefined>)[key];
}

function reply(request: Request, ok: boolean, message: string, status: number) {
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
  if (wantsJson) {
    return new Response(JSON.stringify({ ok, message }), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  const target = ok ? '/get-free-quote/?sent=1' : '/get-free-quote/?error=1';
  return new Response(null, { status: 303, headers: { Location: target, 'cache-control': 'no-store' } });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? clientAddress ?? 'unknown';

  if (rateLimited(ip)) {
    return reply(request, false, 'Too many enquiries from this connection. Please try again shortly.', 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(request, false, 'That submission could not be read. Please try again.', 400);
  }

  // Honeypot — a filled hidden field means a bot, answered with a plain success.
  if (clean(form.get('company_url'), 200)) {
    return reply(request, true, 'Thank you — your enquiry has been sent.', 200);
  }

  const name = clean(form.get('name'), 120);
  const email = clean(form.get('email'), 180);
  const phone = clean(form.get('phone'), 40);
  const productName = clean(form.get('product'), 160);
  const message = clean(form.get('message'), 4000);
  const source = clean(form.get('source'), 200);

  const errors: string[] = [];
  if (name.length < 2) errors.push('a name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('a valid email address');
  if (message.length < 10) errors.push('a message of at least 10 characters');
  if (errors.length) {
    return reply(request, false, `Please provide ${errors.join(', ')}.`, 400);
  }

  const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
  const upload = form.get('artwork');
  if (upload instanceof File && upload.size > 0) {
    if (upload.size > MAX_UPLOAD) {
      return reply(request, false, 'That artwork file is larger than 8 MB.', 413);
    }
    const { filename, ext } = sanitiseFilename(upload.name);
    const allowedTypes = ALLOWED_UPLOADS[ext];
    if (!allowedTypes) {
      return reply(request, false, 'That file type is not accepted. Use PDF, PNG, JPG, WebP, AI, EPS or SVG.', 415);
    }
    const buf = Buffer.from(await upload.arrayBuffer());
    const declared = (upload.type || '').toLowerCase();
    if (declared && !allowedTypes.includes(declared)) {
      return reply(request, false, 'That file did not match its type. Please re-export and try again.', 415);
    }
    if (MAGIC[ext] && !startsWithAny(buf, MAGIC[ext])) {
      return reply(request, false, 'That file did not match its type. Please re-export and try again.', 415);
    }
    if (ext === 'svg' && /<script|javascript:|on\w+\s*=/i.test(buf.toString('utf8', 0, 8192))) {
      return reply(request, false, 'That SVG contains scripting and was not accepted.', 415);
    }
    attachments.push({ filename, content: buf, contentType: allowedTypes[0] });
  }

  const host = env('SMTP_HOST');
  const port = Number(env('SMTP_PORT') ?? 587);
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASS');
  const to = env('SMTP_TO');
  const fromEmail = env('SMTP_FROM_EMAIL');
  const fromName = env('SMTP_FROM_NAME') ?? 'Cardboard Cups Website';

  if (!host || !user || !pass || !to || !fromEmail) {
    console.error('[quote] SMTP environment is incomplete — enquiry not sent');
    return reply(request, false, 'The enquiry service is not available right now. Please email info@cardboardcups.com.', 503);
  }

  const rows: [string, string][] = [
    ['Name', name],
    ['Email', email],
    ['Phone', phone || '—'],
    ['Product', productName || '—'],
    ['Submitted from', source || '/'],
  ];

  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transport.sendMail({
      from: { name: headerSafe(fromName), address: fromEmail },
      to,
      replyTo: { name: headerSafe(name), address: email },
      subject: headerSafe(
        productName ? `Quote request: ${productName}` : `Website enquiry from ${name}`,
      ),
      text: [...rows.map(([k, v]) => `${k}: ${v}`), '', 'Message:', message].join('\n'),
      html: [
        '<table cellpadding="6" style="font-family:system-ui,sans-serif;font-size:14px">',
        ...rows.map(([k, v]) => `<tr><th align="left">${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`),
        `<tr><th align="left" valign="top">Message</th><td>${escapeHtml(message).replace(/\n/g, '<br>')}</td></tr>`,
        '</table>',
      ].join(''),
      attachments,
    });
  } catch (err) {
    console.error('[quote] send failed:', err);
    return reply(request, false, 'Sorry, your enquiry could not be sent. Please email info@cardboardcups.com.', 502);
  }

  return reply(request, true, 'Thank you — your enquiry has been sent. We reply within one business day.', 200);
};

export const GET: APIRoute = () =>
  new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
