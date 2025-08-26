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
  const params = new URLSearchParams({
    sw: phoneNumber,
    amt: amount.toString(),
    cur: currency,
    msg: message,
    edit: allowEditAmount ? "amt" : "",
    src: source
  });
  
  return `https://app.swish.nu/1/p/sw/?${params.toString()}`;
}
