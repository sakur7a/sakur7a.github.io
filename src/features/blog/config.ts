import { blogPaths, siteOwner } from '../../config/site.js';

export const blog = {
  title: 'Sakura',
  description: 'Sakura 的个人博客',
  author: 'Sakura',
  categories: [
    { name: '随笔', slug: 'essays' },
    { name: '学习', slug: 'study' },
  ],
  navigation: [
    { label: 'Archive', href: blogPaths.archive },
    { label: 'About', href: blogPaths.about },
    { label: 'GitHub', href: siteOwner.github },
    { label: 'RSS', href: blogPaths.feed },
  ],
};
