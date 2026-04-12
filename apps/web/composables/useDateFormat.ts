import { formatDate, formatDateTime, type SupportedLocale } from "@lifeos/utils";

export const useDateFormat = () => {
  const { locale } = useI18n();

  return {
    date: (d: string | Date | null | undefined): string =>
      d ? formatDate(new Date(d), locale.value as SupportedLocale) : "",
    datetime: (d: string | Date | null | undefined): string =>
      d ? formatDateTime(new Date(d), locale.value as SupportedLocale) : "",
  };
};
