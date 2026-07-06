// Model-id → filesystem slug. Must stay identical to nim-lib's profile-cache
// slug so artifacts for one model always share one name.
export function slugify(modelId) {
  return modelId.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
}
