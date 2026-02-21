import { NextRequest, NextResponse } from 'next/server';

// Proxy for DaData Suggestions API to keep the token server-side
export async function POST(req: NextRequest) {
    const { query } = await req.json();

    const token = process.env.DADATA_API_KEY;
    if (!token) {
        return NextResponse.json({ suggestions: [] });
    }

    try {
        const res = await fetch(
            'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Token ${token}`,
                },
                body: JSON.stringify({
                    query,
                    count: 7,
                    locations: [{ country: 'Россия' }],
                }),
            }
        );

        const data = await res.json();
        return NextResponse.json({
            suggestions: (data.suggestions || []).map((s: any) => ({
                value: s.value,
                data: {
                    fias_id: s.data?.fias_id,
                    city: s.data?.city,
                    street: s.data?.street,
                    house: s.data?.house,
                    block: s.data?.block,
                    region: s.data?.region,
                },
            })),
        });
    } catch (e) {
        console.error('DaData error:', e);
        return NextResponse.json({ suggestions: [] });
    }
}
