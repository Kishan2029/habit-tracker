const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAMED_ADDRESS_REGEX = /^(?:"?([^"]*)"?\s*)<([^<>]+)>$/;

export const parseEmailAddress = (value) => {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const namedMatch = raw.match(NAMED_ADDRESS_REGEX);
  if (namedMatch) {
    const [, name = '', email = ''] = namedMatch;
    const normalizedEmail = email.trim();
    if (!SIMPLE_EMAIL_REGEX.test(normalizedEmail)) return null;
    const normalizedName = name.trim();
    return {
      name: normalizedName || null,
      email: normalizedEmail,
      raw: normalizedName ? `${normalizedName} <${normalizedEmail}>` : normalizedEmail,
    };
  }

  if (!SIMPLE_EMAIL_REGEX.test(raw)) return null;

  return {
    name: null,
    email: raw,
    raw,
  };
};

export const formatEmailAddress = (address) => {
  if (!address) return '';
  return address.name ? `${address.name} <${address.email}>` : address.email;
};
