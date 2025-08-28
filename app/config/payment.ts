export const paymentConfig = {
  swish: {
    phoneNumber: "0723733290",
    amount: 400,
    alcoholCost: 75,
    currency: "SEK",
    message: "Defence Party",
    allowEditAmount: true,
    source: "qr"
  }
} as const;

export function buildSwishUrl(alcoholPreference: boolean = false): string {
  const { phoneNumber, amount, alcoholCost, currency, message, allowEditAmount, source } = paymentConfig.swish;
  
  // Calculate total amount based on alcohol preference
  const totalAmount = alcoholPreference ? amount + alcoholCost : amount;
  
  const params = [
    `sw=${encodeURIComponent(phoneNumber)}`,
    `amt=${encodeURIComponent(totalAmount.toString())}`,
    `cur=${encodeURIComponent(currency)}`,
    `msg=${encodeURIComponent(message)}`,
    `edit=${encodeURIComponent(allowEditAmount ? "amt" : "")}`,
    `src=${encodeURIComponent(source)}`
  ].join('&');
  
  return `https://app.swish.nu/1/p/sw/?${params}`;
}
