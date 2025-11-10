import { NextRequest, NextResponse } from 'next/server';

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
    try {
        const response = NextResponse.json({ detail: 'Logged out successfully' });
        
        // Delete both session cookies by setting them to empty with expired dates
        // This ensures they're cleared across all browsers
        response.cookies.set('_signwave_session', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0, // Expire immediately
            path: '/',
        });
        
        response.cookies.set('_signwave_user', '', {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0, // Expire immediately
            path: '/',
        });
        
        return response;
    } catch (error) {
        console.error('Error during logout:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
