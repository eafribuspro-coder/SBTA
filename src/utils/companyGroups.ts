/** Utilities for rendering grouped company selectors in the Chargé d'Achat module */

export interface CompanyWithHierarchy {
  id: string
  name: string
  code: string
  parent_id?: string | null
  is_group?: boolean
}

export interface CompanyGroup {
  group: CompanyWithHierarchy
  subsidiaries: CompanyWithHierarchy[]
}

/**
 * Splits a flat list of companies into:
 *   - groups: array of { group, subsidiaries[] }
 *   - standalone: companies with no parent and not a group
 */
export function buildCompanyGroups(companies: CompanyWithHierarchy[]): {
  groups: CompanyGroup[]
  standalone: CompanyWithHierarchy[]
} {
  const groups: CompanyGroup[] = companies
    .filter(c => c.is_group)
    .map(g => ({
      group: g,
      subsidiaries: companies
        .filter(c => c.parent_id === g.id)
        .sort((a, b) => a.code.localeCompare(b.code)),
    }))

  const standalone = companies.filter(
    c => !c.is_group && !c.parent_id
  ).sort((a, b) => a.name.localeCompare(b.name))

  return { groups, standalone }
}

/**
 * Given a selected company_id, returns all IDs that should match in queries:
 * - if the selected company is a group → return its own id + all subsidiary ids
 * - otherwise → return [company_id]
 */
export function resolveCompanyIds(
  companyId: string,
  companies: CompanyWithHierarchy[]
): string[] {
  const selected = companies.find(c => c.id === companyId)
  if (!selected) return [companyId]
  if (selected.is_group) {
    const subIds = companies.filter(c => c.parent_id === selected.id).map(c => c.id)
    return [selected.id, ...subIds]
  }
  return [companyId]
}
