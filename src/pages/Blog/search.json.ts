import { getPosts, dateLabel } from '../../lib/blog';
export async function GET() {
  return Response.json((await getPosts()).map(post => ({ title: post.data.title, url: post.data.permalink, date: dateLabel(post.data.date), summary: post.data.summary || '' })));
}
