export function validExpenseDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

export function referenceDate(timeZone = 'Africa/Casablanca') {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    throw new Error('Invalid time zone');
  }
}

// Conservative fallback: leave dates we cannot resolve for the user to review.
export function extractLocalDate(text, today) {
  const pattern = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|day before yesterday|yesterday|today|tomorrow|\d+ days? ago|(?:(?:last|this|next)\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi;
  const matches = [...text.matchAll(pattern)];
  const dates = matches.map(([raw]) => {
    const value = raw.toLowerCase();
    if (value.includes('/')) {
      const [day, month, year = today.slice(0, 4)] = value.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    if (/^\d{4}-/.test(value)) return value;
    const weekday = value.match(/^(?:(last|this|next)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
    if (weekday) {
      const date = new Date(`${today}T12:00:00Z`);
      const target = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(weekday[2]);
      // Bare weekdays mean the most recent occurrence, including today.
      let offset = -((date.getUTCDay() - target + 7) % 7);
      if (weekday[1] === 'last' && offset === 0) offset = -7;
      if (weekday[1] === 'next') offset = (target - date.getUTCDay() + 7) % 7 || 7;
      if (weekday[1] === 'this') offset = (target + 6) % 7 - (date.getUTCDay() + 6) % 7;
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    }
    const offset = { today: 0, yesterday: -1, tomorrow: 1, 'day before yesterday': -2 }[value]
      ?? -Number(value.match(/^\d+/)?.[0]);
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  });
  const unique = [...new Set(dates)];
  return {
    date: unique.length === 1 && validExpenseDate(unique[0]) ? unique[0] : null,
    hasDate: matches.length > 0,
    text: text.replace(new RegExp(`\\b(?:on|at)\\s+(?=${pattern.source})`, 'gi'), '')
      .replace(pattern, '').replace(/^\s*[:,]\s*/, '').trim()
  };
}
