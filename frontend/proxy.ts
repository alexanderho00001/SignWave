import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Public routes that don't require authentication
    const publicRoutes = [
        '/',
        '/register',
        '/api/auth/login',
        '/api/user', // Allow user registration
    ];

    // Check if the current path is a public route
    const isPublicRoute = publicRoutes.some(route => 
        pathname === route || pathname.startsWith('/api/auth/') || pathname.startsWith('/api/user')
    );

    // Check if the current path is an API route
    const isApiRoute = pathname.startsWith('/api/');

    // Allow public routes and API routes (API routes handle their own auth)
    if (isPublicRoute || isApiRoute) {
        return NextResponse.next();
    }

    // Check for authentication cookie
    const sessionCookie = request.cookies.get('_signwave_session');
    const userCookie = request.cookies.get('_signwave_user');

    // If no session cookie, redirect to login
    if (!sessionCookie && !userCookie) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // User is authenticated, allow access
    return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (public folder)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};

