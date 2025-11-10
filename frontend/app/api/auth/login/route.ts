import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
    collection,
    query,
    where,
    getDocs,
} from 'firebase/firestore';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * POST /api/auth/login - Login user
 * Body: {
 *   username: string;
 *   password: string;
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json(
                { error: 'Username and password are required' },
                { status: 400 }
            );
        }

        // Find user by username
        const usersRef = collection(db, 'users');
        const usernameQuery = query(usersRef, where('username', '==', username.toLowerCase()));
        const snapshot = await getDocs(usernameQuery);

        if (snapshot.empty) {
            return NextResponse.json(
                { error: 'Invalid username or password' },
                { status: 401 }
            );
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        // Check password (in production, passwords should be hashed)
        // For now, we'll do a simple comparison
        if (userData.password !== password) {
            return NextResponse.json(
                { error: 'Invalid username or password' },
                { status: 401 }
            );
        }

        // Create session (using cookies)
        const response = NextResponse.json({
            detail: 'Logged in',
            user: {
                id: userDoc.id,
                username: userData.username,
                email: userData.email,
                name: userData.name,
                role: userData.role || 'user',
            },
        });

        // Set session cookie
        response.cookies.set('_signwave_session', userDoc.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        // Also set user data in a separate cookie for easy access (non-sensitive data only)
        response.cookies.set('_signwave_user', JSON.stringify({
            id: userDoc.id,
            username: userData.username,
            name: userData.name,
        }), {
            httpOnly: false, // Allow client-side access
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Error during login:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

