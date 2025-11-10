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
import { Room } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Generate a unique 8-character room code
 */
function generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Check if room code already exists
 */
async function roomCodeExists(roomCode: string): Promise<boolean> {
    const roomsRef = collection(db, 'rooms');
    const q = query(roomsRef, where('room_code', '==', roomCode));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
}

/**
 * Generate a unique room code
 */
async function generateUniqueRoomCode(): Promise<string> {
    let code = generateRoomCode();
    let attempts = 0;
    const maxAttempts = 10;

    while (await roomCodeExists(code) && attempts < maxAttempts) {
        code = generateRoomCode();
        attempts++;
    }

    if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique room code');
    }

    return code;
}

/**
 * POST /api/room - Create a new game room
 * Body: {
 *   host_id: string;
 *   host_name?: string;
 *   goal_score?: number;
 *   room_code: string; // Required - room code from frontend
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { host_id, host_name, goal_score, room_code } = body;

        if (!host_id) {
            return NextResponse.json(
                { error: 'host_id is required' },
                { status: 400 }
            );
        }

        if (!room_code) {
            return NextResponse.json(
                { error: 'room_code is required' },
                { status: 400 }
            );
        }

        // Validate room code format (8 characters, alphanumeric)
        const roomCodeUpper = room_code.toUpperCase();
        if (!/^[A-Z0-9]{8}$/.test(roomCodeUpper)) {
            return NextResponse.json(
                { error: 'room_code must be 8 alphanumeric characters' },
                { status: 400 }
            );
        }

        // Check if room code already exists
        if (await roomCodeExists(roomCodeUpper)) {
            return NextResponse.json(
                { error: 'Room code already exists. Please generate a new one.' },
                { status: 409 }
            );
        }

        // Validate inputs
        const finalGoalScore = goal_score || 10;

        if (!Number.isInteger(finalGoalScore) || finalGoalScore < 1) {
            return NextResponse.json(
                { error: 'goal_score must be a positive integer' },
                { status: 400 }
            );
        }

        // Use the provided room code
        const roomCode = roomCodeUpper;

        // Generate initial problem
        const problemTypes: ('alphabet' | 'number' | 'word')[] = ['alphabet', 'number', 'word'];
        const type = problemTypes[Math.floor(Math.random() * problemTypes.length)];
        let initialProblem: { type: 'alphabet' | 'number' | 'word'; question: string; answer: string | number };

        if (type === 'alphabet') {
            const letter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
            initialProblem = { type: 'alphabet' as const, question: `Sign the letter: ${letter}`, answer: letter };
        } else if (type === 'number') {
            const number = Math.floor(Math.random() * 10) + 1;
            initialProblem = { type: 'number' as const, question: `Sign the number: ${number}`, answer: number };
        } else {
            const words = ['HELLO', 'THANK', 'YOU', 'YES', 'NO', 'PLEASE', 'SORRY', 'HELP', 'WATER', 'FOOD'];
            const word = words[Math.floor(Math.random() * words.length)];
            initialProblem = { type: 'word' as const, question: `Sign the word: ${word}`, answer: word };
        }

        // Create room document
        const roomData: Omit<Room, 'id' | 'created_at'> & { created_at: Timestamp } = {
            room_code: roomCode,
            host_id,
            guest_id: '',
            is_started: false,
            is_finished: false,
            host_score: 0,
            guest_score: 0,
            host_name: host_name || 'anonymous',
            guest_name: '',
            host_skipped: false,
            guest_skipped: false,
            host_given_up: false,
            guest_given_up: false,
            goal_score: finalGoalScore,
            current_problem: initialProblem,
            created_at: Timestamp.now(),
        };

        const docRef = await addDoc(collection(db, 'rooms'), roomData);

        // Return room with id and ISO string for created_at
        const room: Room = {
            ...roomData,
            id: docRef.id,
            created_at: roomData.created_at.toDate().toISOString(),
        };

        return NextResponse.json(
            {
                detail: 'Room created successfully',
                room,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating room:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/room - List available rooms
 * Query params: ?available_only=true
 */
export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const availableOnly = searchParams.get('available_only') !== 'false';

        const roomsRef = collection(db, 'rooms');
        let q = query(roomsRef, orderBy('created_at', 'desc'), limit(50));

        // For available_only, we'll filter in memory to avoid composite index requirements
        // Firestore requires composite indexes for multiple where clauses with orderBy
        const snapshot = await getDocs(q);
        
        let rooms: Room[] = snapshot.docs.map((docSnapshot) => {
            const data = docSnapshot.data();
            return {
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
                created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
            };
        });

        // Filter for available rooms if requested
        if (availableOnly) {
            rooms = rooms.filter(
                (room) =>
                    !room.is_started &&
                    !room.is_finished &&
                    room.guest_id === ''
            );
        }

        return NextResponse.json({
            rooms,
            count: rooms.length,
        });
    } catch (error) {
        console.error('Error fetching rooms:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
