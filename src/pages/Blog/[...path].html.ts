import type { APIRoute, InferGetStaticPropsType } from 'astro';
import { BLOG_ROOT, blogPaths, pagePermalink } from '../../config/site.js';
import { getPages } from '../../features/blog/content';
import { legacyBlogRedirect } from '../../features/blog/endpoints';

export async function getStaticPaths() {
  const pages = await getPages();
  const permalinks = [blogPaths.archive, blogPaths.searchPage, ...pages.map(entry => pagePermalink(entry.id))];
  return permalinks.map(permalink => ({
    params: { path: permalink.slice(BLOG_ROOT.length, -1) },
    props: { permalink },
  }));
}

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
export const GET: APIRoute<Props> = ({ props }) => legacyBlogRedirect(props.permalink);
