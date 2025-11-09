import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    Timestamp,
} from 'firebase/firestore';
import { Room } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET /api/room/[roomCode] - Get room details by room code
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ roomCode: string }> | { roomCode: string } }
) {
    try {
        // Handle both Promise and direct params (Next.js 13+ compatibility)
        const resolvedParams = params instanceof Promise ? await params : params;
        const { roomCode } = resolvedParams;

        if (!roomCode || roomCode.trim() === '') {
            return NextResponse.json(
                { error: 'Room code is required' },
                { status: 400 }
            );
        }

        const roomCodeUpper = roomCode.toUpperCase().trim();
        const roomsRef = collection(db, 'rooms');
        const q = query(roomsRef, where('room_code', '==', roomCodeUpper));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return NextResponse.json(
                { error: 'Room not found' },
                { status: 404 }
            );
        }

        const docSnapshot = snapshot.docs[0];
        const data = docSnapshot.data();

        const room: Room = {
            id: docSnapshot.id,
            room_code: data.room_code,
            host_id: data.host_id,
            guest_id: data.guest_id || '',
            is_started: data.is_started || false,
            is_finished: data.is_finished || false,
            host_score: data.host_score || 0,
            guest_score: data.guest_score || 0,
            host_name: data.host_name || '',
            guest_name: data.guest_name || '',
            host_skipped: data.host_skipped || false,
            guest_skipped: data.guest_skipped || false,
            host_given_up: data.host_given_up || false,
            guest_given_up: data.guest_given_up || false,
            goal_score: data.goal_score || 10,
            current_problem: data.current_problem || undefined,
            last_solved_by: data.last_solved_by || undefined,
            created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        };

        return NextResponse.json({ room });
    } catch (error) {
        console.error('Error fetching room:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ roomCode: string }> | { roomCode: string } }
) {
    try {
        const resolvedParams = params instanceof Promise ? await params : params;
        const { roomCode } = resolvedParams;

        if (!roomCode) {
            return NextResponse.json(
                { error: 'Room code is required' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Error deleting room:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PUT( req: NextRequest, { params }: { params: Promise<{ roomCode: string }> | { roomCode: string } } ) {
    // update the room details
    try {
        const resolvedParams = params instanceof Promise ? await params : params;
        const { roomCode } = resolvedParams;
        const body = await req.json();

        // Find room by room_code
        const roomsRef = collection(db, 'rooms');
        const q = query(roomsRef, where('room_code', '==', roomCode.toUpperCase()));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return NextResponse.json(
                { error: 'Room not found' },
                { status: 404 }
            );
        }

        const docSnapshot = snapshot.docs[0];
        const roomRef = doc(db, 'rooms', docSnapshot.id);
        
        await updateDoc(roomRef, {
           ...body,
           updated_at: Timestamp.now(),
        });
        
        return NextResponse.json({
            detail: 'Room updated successfully',
        },
        { status: 200 }
    );
    } catch (error) {
        console.error('Error updating room:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}