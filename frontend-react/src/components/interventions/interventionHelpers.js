/**
 * Build a display label for an intervention product item.
 * Works for both API-enriched products and local form items.
 */
export function getPartialLabel(fp, stockResults, stockFilterOptions) {
  if (fp.product?.description) return fp.product.description;
  if (fp.product_id) {
    const sr = stockResults.find(r => r.product_id === fp.product_id);
    if (sr?.description) return sr.description;
  }
  const parts = [];
  const catName = fp.category?.description || stockFilterOptions.categories.find(c => c.id === fp.category_id)?.description;
  if (catName) parts.push(catName);
  const typName = fp.type_obj?.description || stockFilterOptions.types.find(t => t.id === fp.type_id)?.description;
  if (typName) parts.push(typName);
  const specName = fp.specification_obj?.description || stockFilterOptions.specifications.find(s => s.id === fp.specification_id)?.description;
  if (specName) parts.push(specName);
  return parts.join(' / ') || '—';
}

/**
 * Return badge { label, color } for a product's resolution level.
 * @param {boolean} dark - Use dark theme colors (for Light client)
 */
export function getResolutionBadge(fp, dark = false) {
  const colors = dark
    ? {
        instance: 'bg-blue-900/50 text-blue-400',
        product: 'bg-green-900/50 text-green-400',
        specification: 'bg-emerald-900/50 text-emerald-400',
        type: 'bg-amber-900/50 text-amber-400',
        category: 'bg-yellow-900/50 text-yellow-400',
        unknown: 'bg-slate-700 text-slate-400',
      }
    : {
        instance: 'bg-blue-100 text-blue-700',
        product: 'bg-green-100 text-green-700',
        specification: 'bg-emerald-100 text-emerald-700',
        type: 'bg-amber-100 text-amber-700',
        category: 'bg-yellow-100 text-yellow-700',
        unknown: 'bg-slate-100 text-slate-500',
      };

  if (fp.resolution === 'instance' || fp.serial_number || fp.instance_id)
    return { label: 'Instance', color: colors.instance };
  if (fp.resolution === 'product' || fp.product_id)
    return { label: 'Produit', color: colors.product };
  if (fp.resolution === 'specification' || fp.specification_id)
    return { label: dark ? 'Spec' : 'Spécification', color: colors.specification };
  if (fp.resolution === 'type' || fp.type_id)
    return { label: 'Modèle', color: colors.type };
  if (fp.resolution === 'category' || fp.category_id)
    return { label: 'Catégorie', color: colors.category };
  return { label: '?', color: colors.unknown };
}

/** Status color and label maps */
export const statusColors = {
  planned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const statusLabels = {
  planned: 'Planifiée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
};
