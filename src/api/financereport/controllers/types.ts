export type DBFinanceDataResponse = {
    list: DBFinanceData[];
    pageInfo: {
        isLastPage: boolean;
    };
};

export type DBFinanceLedgerResponse = {
    list: DBFinanceData[];
    pageInfo: {
        isLastPage: boolean;
    };
};

export type DBLedgerData = {
    ledger_id: number;
    label: string;
    description: string;
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
    [FinanceCashFlowType.INFLOW]: {
        ledgerData: FinanceLedgerData[];
    };
    [FinanceCashFlowType.OUTFLOW]: {
        ledgerData: FinanceLedgerData[];
    };
};

export type FinanceLedgerData = {
    ledgerId: number;
    total: number;
};

export enum FinanceReportType {
    PRS = 'PRS',
    OPERASIONAL = 'OPERASIONAL',
}

export enum FinanceCashFlowType {
    INFLOW = 'inflow',
    OUTFLOW = 'outflow',
}
