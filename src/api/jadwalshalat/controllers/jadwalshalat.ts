/**
 * A set of functions called "actions" for `jadwalshalat`
 */

import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.cache', 'hijriah-schedules');

interface ResponseOutput extends PrayingTimeResponse {
    day: number;
    month: number;
    year: number;
    hijriahDate: number;
    hijriahMonth: string;
    hijriahYear: number;
}
interface IslamicFinderApiResponse {
    firstMonth: string;
    firstMonthYear: number;
    secondMonth: string;
    secondMonthYear: number;
    secondMonthStartDate: number;
    secondaryMonthChangedate: number;
    numberOfDays: number;
}
interface PrayingTimeResponse {
    date: string;
    subuh: string;
    terbit: string;
    dzuhur: string;
    ashr: string;
    maghrib: string;
    isya: string;
}
interface NocoDBPrayingTimeResponse {
    list: PrayingTimeResponse[];
}

async function getHijriahDatesByMonth(
    month: number,
    year: number
): Promise<IslamicFinderApiResponse> {
    if (month < 1 || month > 12) {
        throw new Error('Bulan harus antara 1 dan 12.');
    }
    const cacheKey = `${year}-${month}`;
    const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);

    //check the data on the cache
    try {
        const cachedData = await fs.readFile(cacheFilePath, 'utf-8');
        console.log(
            `CACHE HIT: Data untuk ${cacheKey} ditemukan. Mengambil dari file.`
        );
        return JSON.parse(cachedData);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Gagal membaca cache:', error);
        }
        console.log(
            `CACHE MISS: Data untuk ${cacheKey} tidak ditemukan. Mengambil dari API.`
        );
    }

    //make an API request if data not exist on cache
    const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ];
    const monthName = monthNames[month - 1];
    const rootApiUrl = process.env.HIJRIAH_API_URL;
    const apiUrl = `${rootApiUrl}&month=${monthName}&year=${year}`;

    let apiResponse: IslamicFinderApiResponse;
    try {
        const response = await axios.get(apiUrl);
        apiResponse = (await response.data) as IslamicFinderApiResponse;
    } catch (error) {
        console.error('Gagal mengambil data dari API IslamicFinder:', error);
        return apiResponse;
    }

    //store the data into cache
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true }); // create a directory if not exist
        await fs.writeFile(
            cacheFilePath,
            JSON.stringify(apiResponse, null, 2),
            'utf-8'
        );
        console.log(
            `CACHE SAVED: Data untuk ${cacheKey} telah disimpan di ${cacheFilePath}`
        );
    } catch (error) {
        console.error('Gagal menyimpan data ke cache:', error);
    }

    return apiResponse;
}

async function getJadwalShalatByMonthAndYear(
    month: number,
    year: number
): Promise<ResponseOutput[]> {
    const results: ResponseOutput[] = [];
    const hijriahData = await getHijriahDatesByMonth(month, year);
    const { list: prayingTimeList } = await getPrayingTime(month, year);
    const {
        firstMonth,
        firstMonthYear,
        secondMonth,
        secondMonthYear,
        secondMonthStartDate,
        secondaryMonthChangedate,
        numberOfDays,
    } = hijriahData;

    for (let day = 1; day <= numberOfDays; day++) {
        let hijriahDate: number, hijriahMonth: string, hijriahYear: number;
        const strDay = day < 10 ? `0${day}` : day;
        const strMonth = month < 10 ? `0${month}` : month;
        const prayingTime = prayingTimeList.find(
            (d) => d.date === `${strDay}.${strMonth}`
        );

        if (day < secondaryMonthChangedate) {
            hijriahDate = secondMonthStartDate + day - 1;
            hijriahMonth = firstMonth;
            hijriahYear = firstMonthYear;
        } else {
            hijriahDate = day - secondaryMonthChangedate + 1;
            hijriahMonth = secondMonth;
            hijriahYear = secondMonthYear;
        }

        results.push(
            getResponseData({
                day,
                month,
                year,
                hijriahDate,
                hijriahMonth,
                hijriahYear,
                ...prayingTime,
            })
        );
    }

    return results;
}

async function getPrayingTime(
    month: number,
    year: number
): Promise<NocoDBPrayingTimeResponse> {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const tableId = isLeapYear
        ? process.env.JADWAL_SHALAT_LEAPDAY_TABLE_NOCODB
        : process.env.JADWAL_SHALAT_TABLE_NOCODB;
    const strMonth = month < 10 ? `0${month}` : month;
    const apiURL = `${process.env.JADWAL_SHALAT_NOCODB_API}/tables/${tableId}/records?where=%28date%2Clike%2C%25.${strMonth}%29&limit=31&shuffle=0&offset=0`;

    let apiResponse: NocoDBPrayingTimeResponse;

    try {
        const response = await axios.get(apiURL, {
            headers: {
                accept: 'application/json',
                'xc-token': process.env.JADWAL_SHALAT_NOCODB_API_TOKEN,
            },
        });
        apiResponse = (await response.data) as NocoDBPrayingTimeResponse;
    } catch (error) {
        console.error('Gagal mengambil data dari API IslamicFinder:', error);

        return apiResponse;
    }

    return apiResponse;
}

async function getJadwalShalatToday() {
    const today = new Date();
    const date = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const data = await getJadwalShalatByMonthAndYear(month, year);
    const todayHijriahData = data.find(
        (d) => d.day === date && d.month === month
    );

    return getResponseData(todayHijriahData);
}

function getResponseData(data) {
    return pickProperties(data, [
        'date',
        'subuh',
        'terbit',
        'dzuhur',
        'ashr',
        'maghrib',
        'isya',
        'day',
        'month',
        'year',
        'hijriahDate',
        'hijriahMonth',
        'hijriahYear',
    ]);
}

function pickProperties<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    return keys.reduce(
        (acc, key) => {
            if (obj.hasOwnProperty(key)) {
                acc[key] = obj[key];
            }
            return acc;
        },
        {} as Pick<T, K>
    );
}

async function getData(query) {
    if (query && query.month && query.year) {
        return await getJadwalShalatByMonthAndYear(query.month, query.year);
    }

    return getJadwalShalatToday();
}

export default {
    getData: async (ctx, next) => {
        try {
            ctx.body = await getData(ctx.query);
        } catch (err) {
            ctx.body = err;
            ctx.status = 500;
        }
    },
};
