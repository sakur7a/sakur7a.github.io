import { blogDateLabel } from '../config/site.js';

export type SiteDate = string | Date;
export const dateLabel = blogDateLabel;
export const isoDate = (date: SiteDate) => new Date(date).toISOString();
