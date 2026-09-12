export function isPhoneDevice({ userAgent = '', maxTouchPoints = 0, width = Infinity } = {}) {
  const agent = String(userAgent);
  if (/iPhone|iPod|Windows Phone|Android.*Mobile/i.test(agent)) return true;
  return Number(maxTouchPoints) > 0 && Number(width) <= 600;
}
