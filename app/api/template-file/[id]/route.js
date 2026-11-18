// Unduh isi file DOCX sebuah template (publik — template memang dokumen
// publik). Dipakai pratinjau kustom (mammoth) dan unduhan DOCX.

export const dynamic = 'force-dynamic';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { BUILTIN_TEMPLATE } from '../../../lib/builtinTemplate.js';
import { kvConfigured, kvGetRaw } from '../../../lib/kv.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function GET(request, { params }) {
  const { id } = await params;
  if (id === BUILTIN_TEMPLATE.id) {
    try {
      const buf = await readFile(path.join(process.cwd(), 'public', 'surat-template.docx'));
      return new Response(buf, {
        headers: {
          'Content-Type': DOCX_MIME,
          'Content-Disposition': 'attachment; filename="surat-template.docx"',
        },
      });
    } catch {
      return Response.json({ error: 'template tidak ditemukan' }, { status: 404 });
    }
  }
  if (!kvConfigured()) return Response.json({ error: 'database belum dikonfigurasi' }, { status: 503 });
  const b64 = await kvGetRaw(`surat-aktif:template-file:${id}`);
  if (!b64) return Response.json({ error: 'file template tidak ditemukan' }, { status: 404 });
  const buf = Buffer.from(b64, 'base64');
  return new Response(buf, {
    headers: {
      'Content-Type': DOCX_MIME,
      'Content-Disposition': `attachment; filename="${id}.docx"`,
    },
  });
}
