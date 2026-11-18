import { BLOG_ASSETS, blogPaths, siteOwner } from '../../config/site.js';

export const blog = {
  title: 'Sakura',
  description: '记录技术、生活和一些长期有效的小想法',
  author: 'Sakura',
  categories: [
    { name: '随笔', slug: 'essays', description: '日常观察、生活片段和那些暂时不急着下结论的想法。' },
    { name: '学习', slug: 'study', description: '读书、课程、技术笔记和阶段性复盘。' },
  ],
  navigation: [
    { label: 'Archive', href: blogPaths.archive },
    { label: 'About', href: blogPaths.about },
    { label: 'GitHub', href: siteOwner.github, external: true },
  ],
  heroes: {
    index: {
      image: `${BLOG_ASSETS}/images/site/home-hero.png`,
      position: '50% 10%',
    },
    archive: { image: `${BLOG_ASSETS}/images/site/wallhaven-6l21lx-1778342041220.png` },
  },
};
