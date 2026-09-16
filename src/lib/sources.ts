/** Where the AI is allowed to look for a given interest. */
export const ALL_SOURCES = ["news", "blogs", "x", "reddit", "youtube", "papers"] as const;
export type SourceOption = (typeof ALL_SOURCES)[number];

export const SOURCE_LABELS: Record<SourceOption, string> = {
  news: "News sites",
  blogs: "Blogs & newsletters",
  x: "X posts",
  reddit: "Reddit",
  youtube: "YouTube",
  papers: "Research papers",
};
