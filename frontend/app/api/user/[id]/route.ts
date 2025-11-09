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

// Get the user's information by id
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params;

        const usersRef = collection(db, 'users');
        let q = query(usersRef, where('id', '==', id));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        const docSnapshot = snapshot.docs[0];
        const data = docSnapshot.data();
        const user: User = {
            id: docSnapshot.id,
            email: data.email,
            name: data.name,
            username: data.username,
            role: data.role || 'user',
            password: '',
        };

        return NextResponse.json({ user });
    } catch (error) {
        console.error('Error fetching user:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}