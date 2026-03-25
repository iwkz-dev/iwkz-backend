/**
 * jadwalshalat service
 */

import axios from 'axios';
import {
  IslamicFinderApiResponse,
  NocoDBPrayingTimeResponse,
  ResponseOutput,
} from '../controllers/types';
import { driveCache } from '../../../helpers/googleDriveCache';

const DRIVE_CACHE_FOLDER_ID = process.env.GOOGLE_DRIVE_CACHE_HIJRIAH_DATE;
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

export const getJadwalShalatToday = async () => {
  const today = new Date();
  const date = today.getDate();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  const data = await getJadwalShalatByMonthAndYear(month, year);
  const todayHijriahData = data.find(
    (d) => d.day === date && d.month === month
  );

  return getResponseData(todayHijriahData);
};

export const getJadwalShalatByMonthAndYear = async (
  month: number,
  year: number
): Promise<ResponseOutput[]> => {
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
};

const getHijriahDatesByMonth = async (
  month: number,
  year: number
): Promise<IslamicFinderApiResponse> => {
  if (month < 1 || month > 12) {
    throw new Error('Bulan harus antara 1 dan 12.');
  }
  const monthKey = month < 10 ? `0${month}` : `${month}`;
  const cacheFileName = `${year}-${monthKey}.json`;

  if (!DRIVE_CACHE_FOLDER_ID) {
    strapi.log.warn(
      'GOOGLE_DRIVE_CACHE_HIJRIAH_DATE is not set. Skipping Google Drive cache.'
    );
  } else {
    try {
      const cachedData = await driveCache.read<IslamicFinderApiResponse>(
        DRIVE_CACHE_FOLDER_ID,
        cacheFileName
      );

      if (cachedData) {
        strapi.log.info(
          `CACHE HIT (Drive): Data untuk ${cacheFileName} ditemukan. Mengambil dari Google Drive.`
        );
        return cachedData;
      }

      strapi.log.info(
        `CACHE MISS (Drive): Data untuk ${cacheFileName} tidak ditemukan. Mengambil dari API.`
      );
    } catch (error) {
      strapi.log.error('Gagal membaca cache dari Google Drive:', error);
    }
  }

  //make an API request if data not exist on cache
  const monthName = monthNames[month - 1];
  const rootApiUrl = process.env.HIJRIAH_API_URL;
  const apiUrl = `${rootApiUrl}&month=${monthName}&year=${year}`;

  let apiResponse: IslamicFinderApiResponse = {} as IslamicFinderApiResponse;
  try {
    const response = await axios.get(apiUrl, {
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en,de;q=0.9,de-DE;q=0.8,en-US;q=0.7',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        Referer: 'https://www.islamicfinder.org/',
      },
    });
    apiResponse = (await response.data) as IslamicFinderApiResponse;
  } catch (error) {
    strapi.log.error('Gagal mengambil data dari API IslamicFinder:', error);
    return apiResponse;
  }

  if (DRIVE_CACHE_FOLDER_ID) {
    try {
      await driveCache.write(DRIVE_CACHE_FOLDER_ID, cacheFileName, apiResponse);
      strapi.log.info(
        `CACHE SAVED (Drive): Data untuk ${cacheFileName} telah disimpan ke Google Drive.`
      );
    } catch (error) {
      strapi.log.error('Gagal menyimpan data ke Google Drive:', error);
    }
  }

  return apiResponse;
};

const getPrayingTime = async (
  month: number,
  year: number
): Promise<NocoDBPrayingTimeResponse> => {
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const tableId = isLeapYear
    ? process.env.IWKZ_NOCODB_TABLE_JADWAL_SHALAT_LEAPDAY
    : process.env.IWKZ_NOCODB_TABLE_JADWAL_SHALAT;
  const strMonth = month < 10 ? `0${month}` : month;
  const apiURL = `${process.env.IWKZ_NOCODB_API}/tables/${tableId}/records?where=%28date%2Clike%2C%25.${strMonth}%29&limit=31&shuffle=0&offset=0`;

  let apiResponse: NocoDBPrayingTimeResponse;

  try {
    const response = await axios.get(apiURL, {
      headers: {
        accept: 'application/json',
        'xc-token': process.env.IWKZ_NOCODB_API_TOKEN,
      },
    });
    apiResponse = (await response.data) as NocoDBPrayingTimeResponse;
  } catch (error) {
    strapi.log.error('Gagal mengambil data dari API IslamicFinder:', error);

    return apiResponse;
  }

  return apiResponse;
};

const getResponseData = (data) => {
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
};

const pickProperties = <T, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> => {
  return keys.reduce(
    (acc, key) => {
      if (obj.hasOwnProperty(key)) {
        acc[key] = obj[key];
      }
      return acc;
    },
    {} as Pick<T, K>
  );
};
