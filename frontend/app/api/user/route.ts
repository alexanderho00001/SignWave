import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
} from 'firebase/firestore';
import { User } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Create a new user
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, name, username, password } = body;
        const role = 'user';

        // Validate required fields
        if (!email || !name || !username || !password) {
            return NextResponse.json(
                { error: 'email, name, username, and password are required' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Check if email already exists
        const usersRef = collection(db, 'users');
        const emailQuery = query(usersRef, where('email', '==', email.toLowerCase()));
        const emailSnapshot = await getDocs(emailQuery);
        
        if (!emailSnapshot.empty) {
            return NextResponse.json(
                { error: 'Email already exists' },
                { status: 409 }
            );
        }

        // Check if username already exists
        const usernameQuery = query(usersRef, where('username', '==', username.toLowerCase()));
        const usernameSnapshot = await getDocs(usernameQuery);
        
        if (!usernameSnapshot.empty) {
            return NextResponse.json(
                { error: 'Username already exists' },
                { status: 409 }
            );
        }

        // Create user document
        const userData: Omit<User, 'id'> & { created_at: Timestamp; updated_at: Timestamp } = {
            email: email.toLowerCase(),
            name,
            username: username.toLowerCase(),
            password, // Note: In production, this should be hashed before storing
            role: role || 'user',
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
        };

        const docRef = await addDoc(collection(db, 'users'), userData);

        // Return user without password
        const user: Omit<User, 'password'> & { id: string } = {
            id: docRef.id,
            email: userData.email,
            name: userData.name,
            username: userData.username,
            role: userData.role,
        };

        return NextResponse.json(
            {
                detail: 'User created successfully',
                user,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/user - List users
 * Query params: 
 *   ?limit=50 (default: 50)
 *   ?role=user (filter by role)
 *   ?search=username (search by username or name)
 */
export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const limitParam = parseInt(searchParams.get('limit') || '50', 10);
        const roleFilter = searchParams.get('role');
        const searchTerm = searchParams.get('search')?.toLowerCase();

        const usersRef = collection(db, 'users');
        let q = query(usersRef, orderBy('created_at', 'desc'), limit(Math.min(limitParam, 100)));

        // If filtering by role, we need to add where clause
        // Note: Firestore requires composite index for multiple where + orderBy
        // For now, we'll filter in memory if role filter is provided
        const snapshot = await getDocs(q);

        let users = snapshot.docs.map((docSnapshot) => {
            const data = docSnapshot.data();
            return {
                id: docSnapshot.id,
                email: data.email,
                name: data.name,
                username: data.username,
                role: data.role || 'user',
                // Don't return password
            };
        });

        // Filter by role if provided
        if (roleFilter) {
            users = users.filter((user) => user.role === roleFilter);
        }

        // Filter by search term if provided
        if (searchTerm) {
            users = users.filter(
                (user) =>
                    user.username.toLowerCase().includes(searchTerm) ||
                    user.name.toLowerCase().includes(searchTerm) ||
                    user.email.toLowerCase().includes(searchTerm)
            );
        }

        return NextResponse.json({
            users,
            count: users.length,
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

