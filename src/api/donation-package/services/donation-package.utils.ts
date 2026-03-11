export type ParsedDonationItem = {
    unique_code: string;
    total_order: number;
    total_price: number;
};

export const generateDonationCaptureId = (): string => {
    return `paypal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
};

export const roundToCurrency = (value: number): number => {
    return Math.round(value * 100) / 100;
};

export const ceilToCurrency = (value: number): number => {
    return Math.ceil(value * 100) / 100;
};

export const parseDescriptionsFromPaypal = (
    description: string | undefined,
): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    if (!description) return map;

    const regex = /([^,\[\]]+)\[([^\]]*)\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(description)) !== null) {
        const code = match[1]?.trim();
        if (!code) continue;

        const descs = match[2]
            .split(',')
            .map((d) => d.trim())
            .filter((d) => d.length > 0);

        map.set(code, descs);
    }

    return map;
};

export const parseItemsFromCustomId = (
    customId: string | undefined,
): ParsedDonationItem[] => {
    if (!customId) return [];

    return customId
        .split('|')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => {
            const [uniqueCode, totalOrderRaw, totalPriceRaw] = entry.split(':');
            const totalOrder = toNumber(totalOrderRaw);
            const totalPrice = toNumber(totalPriceRaw);

            return {
                unique_code: (uniqueCode ?? '').trim(),
                total_order: totalOrder,
                total_price: totalPrice,
            };
        })
        .filter(
            (item) =>
                item.unique_code.length > 0 &&
                item.total_order > 0 &&
                item.total_price > 0,
        );
};
