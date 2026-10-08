import { getCollection } from 'astro:content';
export const blog = {
  title: 'Sakura', description: '记录技术、生活和一些长期有效的小想法',
  site: 'https://sakur7a.github.io', email: 'sakur7a@outlook.com', author: 'Sakura',
  categories: [
    { name: '随笔', slug: 'essays', description: '日常观察、生活片段和那些暂时不急着下结论的想法。' },
    { name: '学习', slug: 'study', description: '读书、课程、技术笔记和阶段性复盘。' },
  ],
};
export const getPosts = async () => (await getCollection('posts')).sort((a, b) => timestamp(b.data.date) - timestamp(a.data.date));
export const timestamp = (date: string | Date) => new Date(date).getTime();
export const dateLabel = (date: string | Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
export const isoDate = (date: string | Date) => new Date(date).toISOString();
export const xml = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
