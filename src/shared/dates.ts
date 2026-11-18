import { SITE_TIME_ZONE } from '../config/site.js';

const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: SITE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export type SiteDate = string | Date;
export const dateLabel = (date: SiteDate) => dateFormatter.format(new Date(date));
export const isoDate = (date: SiteDate) => new Date(date).toISOString();
