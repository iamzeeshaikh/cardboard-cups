/**
 * Blog post loader. Posts live as markdown files in src/data/blog/; the
 * filename (minus .md) is the slug, mirroring how products.json drives
 * product routes. Sorted newest first for the listing page.
 */

export interface BlogPostModule {
  frontmatter: {
    title: string;
    metaTitle: string;
    metaDescription: string;
    date: string;
    image: string;
    imageAlt: string;
  };
  Content: any;
}

const files = import.meta.glob<BlogPostModule>('../data/blog/*.md', { eager: true });

export const BLOG_POSTS = Object.entries(files)
  .map(([path, mod]) => ({
    slug: path.split('/').pop()!.replace(/\.md$/, ''),
    url: `/blog/${path.split('/').pop()!.replace(/\.md$/, '')}/`,
    ...mod.frontmatter,
    Content: mod.Content,
  }))
  .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
