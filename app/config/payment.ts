export const paymentConfig = {
  swish: {
    phoneNumber: "0723733290",
    amount: 400,
    currency: "SEK",
    message: "Defense Party",
    allowEditAmount: true,
    source: "qr"
  }
} as const;

export function buildSwishUrl(): string {
  const { phoneNumber, amount, currency, message, allowEditAmount, source } = paymentConfig.swish;
  
  const params = [
    `sw=${encodeURIComponent(phoneNumber)}`,
    `amt=${encodeURIComponent(amount.toString())}`,
    `cur=${encodeURIComponent(currency)}`,
    `msg=${encodeURIComponent(message)}`,
    `edit=${encodeURIComponent(allowEditAmount ? "amt" : "")}`,
    `src=${encodeURIComponent(source)}`
  ].join('&');
  
  return `https://app.swish.nu/1/p/sw/?${params}`;
}
