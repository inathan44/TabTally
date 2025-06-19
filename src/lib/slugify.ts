/**
 * Utility functions for creating URL-friendly slugs
 */

/**
 * Simple slugify function (or install the slugify package)
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-_]+/g, "-") // Replace special chars with dashes (preserve word chars, dashes, underscores)
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

/**
 * Create a unique slug for a group using name + ID
 */
export function createGroupSlug(name: string, id: number): string {
  const baseSlug = slugify(name);

  // Limit base slug length to leave room for ID
  const truncatedSlug = baseSlug.substring(0, 80);

  // Combine with ID for uniqueness
  return `${truncatedSlug}-${id}`;
}

/**
 * Extract group ID from slug
 */
export function extractGroupIdFromSlug(slug: string): number {
  const parts = slug.split("-");
  const idString = parts[parts.length - 1];

  // Check if the ID string is empty or undefined
  if (!idString || idString.trim() === "") {
    throw new Error(`Invalid slug format: ${slug}`);
  }

  // Check if it's a valid integer string (no decimal points, no non-numeric chars)
  if (!/^\d+$/.test(idString)) {
    throw new Error(`Invalid slug format: ${slug}`);
  }

  const id = parseInt(idString, 10);

  if (isNaN(id)) {
    throw new Error(`Invalid slug format: ${slug}`);
  }

  return id;
}

/**
 * Generate group URL from group data
 */
export function generateGroupUrl(group: { id: number; name: string }): string {
  const slug = createGroupSlug(group.name, group.id);
  return `/groups/${slug}`;
}
