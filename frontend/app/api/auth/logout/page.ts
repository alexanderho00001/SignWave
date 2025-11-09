import { NextRequest, NextResponse } from 'next/server';

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
    try {
        const response = new NextResponse();
        response.cookies.delete('_signwave_session');
        return response;
    } catch (error) {
        console.error('Error during logout:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}