// STUB (lead): replaced by the Animals agent.
export function mergeLook(species, partial) { return { ...species.defaults, ...(partial || {}), accessories: { ...species.defaults.accessories, ...(partial?.accessories || {}) } }; }
export function validateLook(look) { return look; }
