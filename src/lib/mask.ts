export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2)
  return `${visible}***@${domain}`
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return phone
  const last4 = digits.slice(-4)
  const first = digits.slice(0, digits.length - 8)
  return first ? `${first}-****-${last4}` : `****-${last4}`
}
