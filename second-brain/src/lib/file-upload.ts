import { getSupabase } from './supabase';
import type { Attachment } from '@/types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return '파일 크기는 10MB 이하여야 합니다.';
  if (!ALLOWED_TYPES.includes(file.type)) return '지원하지 않는 파일 형식입니다. (PDF, Excel, CSV, 이미지 가능)';
  return null;
}

export async function uploadFile(file: File, noteId: string): Promise<Attachment | null> {
  const sb = getSupabase();
  const id = generateId();
  const ext = file.name.split('.').pop() || '';
  const path = `${noteId}/${id}.${ext}`;

  if (sb) {
    const { error } = await sb.storage.from('attachments').upload(path, file);
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    const { data: urlData } = sb.storage.from('attachments').getPublicUrl(path);
    return {
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      url: urlData.publicUrl,
    };
  }

  // localStorage fallback: store as base64 data URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        url: reader.result as string,
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export async function deleteFile(attachment: Attachment, noteId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  if (attachment.url.startsWith('data:')) return true;

  const ext = attachment.name.split('.').pop() || '';
  const path = `${noteId}/${attachment.id}.${ext}`;
  const { error } = await sb.storage.from('attachments').remove([path]);
  return !error;
}

export function getFileIcon(type: string): string {
  if (type === 'application/pdf') return '📄';
  if (type.includes('spreadsheet') || type.includes('excel') || type === 'text/csv') return '📊';
  if (type.startsWith('image/')) return '🖼️';
  return '📎';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

const GDRIVE_PATTERNS = [
  { pattern: /https:\/\/docs\.google\.com\/spreadsheets\/d\/[^\s)]+/g, label: 'Google Sheets', icon: '📊' },
  { pattern: /https:\/\/docs\.google\.com\/document\/d\/[^\s)]+/g, label: 'Google Docs', icon: '📝' },
  { pattern: /https:\/\/docs\.google\.com\/presentation\/d\/[^\s)]+/g, label: 'Google Slides', icon: '📽️' },
  { pattern: /https:\/\/drive\.google\.com\/file\/d\/[^\s)]+/g, label: 'Google Drive', icon: '☁️' },
  { pattern: /https:\/\/drive\.google\.com\/drive\/folders\/[^\s)]+/g, label: 'Google Drive 폴더', icon: '📁' },
];

export interface DriveLink {
  url: string;
  label: string;
  icon: string;
}

export function extractDriveLinks(content: string): DriveLink[] {
  const links: DriveLink[] = [];
  for (const { pattern, label, icon } of GDRIVE_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      for (const url of matches) {
        if (!links.some((l) => l.url === url)) {
          links.push({ url, label, icon });
        }
      }
    }
  }
  return links;
}
