import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
} from 'firebase/firestore';
import { Room } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * POST /api/room/[roomCode]/join - Join an existing room as guest
 * Body: {
 *   guest_id: string;
 *   guest_name?: string;
 * }
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ roomCode: string }> | { roomCode: string } }
) {
    try {
        const resolvedParams = params instanceof Promise ? await params : params;
        const { roomCode } = resolvedParams;
        const body = await req.json();
        const { guest_id, guest_name } = body;

        if (!roomCode) {
            return NextResponse.json(
                { error: 'Room code is required' },
                { status: 400 }
            );
        }

        if (!guest_id) {
            return NextResponse.json(
                { error: 'guest_id is required' },
                { status: 400 }
            );
        }

        // Find room by room code
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
        const roomData = docSnapshot.data();
        const roomRef = doc(db, 'rooms', docSnapshot.id);

        // Check if room is already full
        if (roomData.guest_id && roomData.guest_id !== '') {
            return NextResponse.json(
                { error: 'Room is already full' },
                { status: 400 }
            );
        }

        // Check if user is trying to join their own room
        if (roomData.host_id === guest_id) {
            return NextResponse.json(
                { error: 'Cannot join your own room' },
                { status: 400 }
            );
        }

        // Check if room is already started or finished
        if (roomData.is_started) {
            return NextResponse.json(
                { error: 'Room game has already started' },
                { status: 400 }
            );
        }

        if (roomData.is_finished) {
            return NextResponse.json(
                { error: 'Room game has already finished' },
                { status: 400 }
            );
        }

        // Join room
        await updateDoc(roomRef, {
            guest_id,
            guest_name: guest_name || 'Guest',
        });

        // Fetch updated room
        const updatedDoc = await getDocs(q);
        const updatedData = updatedDoc.docs[0].data();

        const room: Room = {
            id: docSnapshot.id,
            room_code: updatedData.room_code,
            host_id: updatedData.host_id,
            guest_id: updatedData.guest_id || '',
            is_started: updatedData.is_started || false,
            is_finished: updatedData.is_finished || false,
            host_score: updatedData.host_score || 0,
            guest_score: updatedData.guest_score || 0,
            host_name: updatedData.host_name || '',
            guest_name: updatedData.guest_name || '',
            host_skipped: updatedData.host_skipped || false,
            guest_skipped: updatedData.guest_skipped || false,
            host_given_up: updatedData.host_given_up || false,
            guest_given_up: updatedData.guest_given_up || false,
            goal_score: updatedData.goal_score || 10,
            current_problem: updatedData.current_problem || undefined,
            last_solved_by: updatedData.last_solved_by || undefined,
            created_at: updatedData.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        };

        return NextResponse.json({
            detail: 'Successfully joined room',
            room,
        });
    } catch (error) {
        console.error('Error joining room:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
