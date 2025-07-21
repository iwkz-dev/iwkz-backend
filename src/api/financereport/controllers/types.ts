export type DBFinanceDataResponse = {
    list: DBFinanceData[];
    pageInfo: {
        isLastPage: boolean;
    };
};

export type DBFinanceData = {
    year: number;
    month: number;
    date: string;
    income: number;
    outcome: number;
    ledger_id: number;
};

export type FinanceDataApiResponse = {
    year: number;
    type: FinanceReportType;
    monthlyData: FinanceMonthlyData[];
};

export type FinanceMonthlyData = {
    month: number;
    ledgerData: FinanceLedgerData[];
};

export type FinanceLedgerData = {
    ledgerId: number;
    total: number;
};

export enum FinanceReportType {
    PRS = 'PRS',
    OPERASIONAL = 'OPERASIONAL',
}
