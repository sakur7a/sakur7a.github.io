import type { APIRoute, InferGetStaticPropsType } from 'astro';
import { getPostRoutes } from '../../../features/blog/content';
import { legacyPostRedirect } from '../../../features/blog/endpoints';

export const getStaticPaths = getPostRoutes;
type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export const GET: APIRoute<Props> = ({ props }) => legacyPostRedirect(props.entry.data.permalink);
