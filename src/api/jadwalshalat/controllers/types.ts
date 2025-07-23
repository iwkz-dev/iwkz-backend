export interface ResponseOutput extends PrayingTimeResponse {
    day: number;
    month: number;
    year: number;
    hijriahDate: number;
    hijriahMonth: string;
    hijriahYear: number;
}
export type IslamicFinderApiResponse = {
    firstMonth: string;
    firstMonthYear: number;
    secondMonth: string;
    secondMonthYear: number;
    secondMonthStartDate: number;
    secondaryMonthChangedate: number;
    numberOfDays: number;
};
export type PrayingTimeResponse = {
    date: string;
    subuh: string;
    terbit: string;
    dzuhur: string;
    ashr: string;
    maghrib: string;
    isya: string;
};
export type NocoDBPrayingTimeResponse = {
    list: PrayingTimeResponse[];
};
