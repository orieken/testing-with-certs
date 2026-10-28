export const apiCases = [
  'RFC8705 signed cnf and matching-certificate access across all APIs',
  'RFC8705 same-identity different valid leaf rejected; spoofed thumbprint replaced',
  'RFC8705 valid bound token cannot pass the shop without a client certificate',
];
export const browserCases = [
  'RFC8705 browser matching certificate grants access',
  'RFC8705 browser different same-user certificate rejects token replay',
  'RFC8705 browser missing certificate rejects a valid token',
];
