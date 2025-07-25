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

export type DBFinanceCashFlow = {
    year: number;
    month: number;
    income: number;
    outcome: number;
    data_type: string;
};

export type DBFinanceClosingBalance = {
    year: number;
    total_income: number;
    data_type: string;
};

export type FinanceDataApiResponse = {
    year: number;
    type: FinanceReportType;
    monthlyData: FinanceMonthlyData[];
};

export type FinanceSummaryApiResponse = {
    year: number;
    [FinanceReportType.OPERASIONAL]: {
        monthlyData: FinanceMonthlySummary[];
        lastyearIncomeBalance: number;
    };
    [FinanceReportType.PRS]: {
        monthlyData: FinanceMonthlySummary[];
        lastyearIncomeBalance: number;
    };
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

export type FinanceMonthlySummary = {
    month: number;
    [FinanceCashFlowType.INFLOW]: number;
    [FinanceCashFlowType.OUTFLOW]: number;
};

export type FinanceLedgerData = {
    ledgerId: number;
    total: number;
};

export enum FinanceReportType {
    PRS = 'prs',
    OPERASIONAL = 'operational',
}

export enum FinanceCashFlowType {
    INFLOW = 'inflow',
    OUTFLOW = 'outflow',
}
