import crypto from 'crypto';

export function generateFingerprint(date: string, amount: number, description: string, merchant?: string): string {
  const raw = `${date}|${amount}|${description || ''}|${merchant || ''}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}
