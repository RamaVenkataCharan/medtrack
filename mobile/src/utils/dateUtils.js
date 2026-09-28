/**
 * Formats timestamps reliably into device local time.
 * Solves the UTC-to-local shift on evening/night purchases.
 */

export function formatLocalDateTime(dateString) {
  if (!dateString) return '';

  // SQLite CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS" without Z.
  // If no 'Z' or offset is present, treat as UTC so JS parses correctly:
  let normalized = dateString;
  if (typeof dateString === 'string' && !dateString.includes('Z') && !dateString.includes('+')) {
    normalized = dateString.replace(' ', 'T') + 'Z';
  }

  const date = new Date(normalized);
  if (isNaN(date.getTime())) {
    return dateString;
  }

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Today, ${timeStr}`;
  }
  if (isYesterday) {
    return `Yesterday, ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });

  return `${dateStr}, ${timeStr}`;
}

export function formatDate(dateString) {
  if (!dateString) return '';
  let normalized = dateString;
  if (typeof dateString === 'string' && !dateString.includes('Z') && !dateString.includes('+')) {
    normalized = dateString.replace(' ', 'T') + 'Z';
  }
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return String(dateString);

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function calculateDaysLeft(dateString) {
  if (!dateString) return null;
  const target = new Date(dateString);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getCurrentLocalIso() {
  return new Date().toISOString();
}
