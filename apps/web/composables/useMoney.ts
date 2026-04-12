// ============================================================================
// composables/useMoney
// ----------------------------------------------------------------------------
// Locale-aware money formatter. Wraps @lifeos/utils so we don't repeat
// Intl boilerplate in every component.
// ============================================================================

import { formatMoney, type Money, type SupportedLocale } from "@lifeos/utils";

export const useMoney = () => {
  const { locale } = useI18n();

  const format = (money: {
    amountMinor: string | bigint;
    currency: string;
  }): string => {
    const m: Money = {
      amountMinor: typeof money.amountMinor === "bigint"
        ? money.amountMinor
        : BigInt(money.amountMinor),
      currency: money.currency,
    };
    return formatMoney(m, locale.value as SupportedLocale);
  };

  return { format };
};
