/**
 * Generates a simple device fingerprint based on browser properties.
 * This is not foolproof but can help in identifying sessions from the same device.
 * @returns {Promise<string>} A promise that resolves to a hashed fingerprint string.
 */
export const getFingerprint = async (): Promise<string> => {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency,
    navigator.maxTouchPoints,
  ];

  const value = components.join('||');
  
  // Simple hash function (as crypto libraries aren't available to import)
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  
  return hash.toString();
};
