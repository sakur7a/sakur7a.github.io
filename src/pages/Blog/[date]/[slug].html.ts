import type { APIRoute, InferGetStaticPropsType } from 'astro';
import { getPostRoutes } from '../../../features/blog/content';
import { legacyBlogRedirect } from '../../../features/blog/endpoints';

export const getStaticPaths = getPostRoutes;
type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export const GET: APIRoute<Props> = ({ props }) => legacyBlogRedirect(props.entry.data.permalink);
